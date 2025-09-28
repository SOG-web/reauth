import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import { findTestUser } from '../utils';
import type { UsernamePasswordConfig } from '../types';
import { passwordSchema, usernameSchema } from '../../shared/validation';
import { hashPassword, haveIbeenPawned } from '../../../lib/password';

export type RegisterInput = {
  username: string;
  password: string;
  others?: Record<string, any>;
};

export const registerValidation = type({
  username: usernameSchema,
  password: passwordSchema,
  others: 'object?',
});

export const registerStep: AuthStep<
  UsernamePasswordConfig,
  RegisterInput,
  AuthOutput
> = {
  name: 'register',
  description: 'Register a new user with username and password',
  validationSchema: registerValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { alr: 409, pwr: 400, su: 201, ic: 400 },
    },
  },
  inputs: ['username', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': type({
      id: 'string',
      username: 'string',
      provider: 'string',
      verified: 'boolean',
      profile: 'object?',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { username, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(username, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: username };

      let token: string | null = null;
      if (ctx.config?.loginOnRegister) {
        const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
        token = await ctx.engine.createSessionFor(
          'subject',
          subjectRow.id,
          ttl,
        );
      }

      const subject = {
        id: subjectRow.id,
        username,
        provider: 'username',
        verified: true,
        profile: tu.profile,
      };

      return {
        success: true,
        message: 'Registration successful (test user)',
        status: 'su',
        ...(token ? { token } : {}),
        subject,
        others,
      };
    }

    // Check if username already exists
    const existingIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'username'), b('identifier', '=', username)),
    });

    if (existingIdentity) {
      return {
        success: false,
        message: 'Username already taken',
        status: 'alr',
        others,
      };
    }

    // Check password safety (HaveIBeenPwned)
    const isSafe = await haveIbeenPawned(password);
    if (!isSafe) {
      return {
        success: false,
        message:
          'Password has been found in data breaches. Please choose a stronger password.',
        status: 'pwr',
        others,
      };
    }

    // Create subject
    const subject = await orm.create('subjects', {});
    const subjectId = subject.id as string;

    // Create credentials (hashed password)
    const passwordHash = await hashPassword(password);
    await orm.create('credentials', {
      subject_id: subjectId,
      password_hash: passwordHash,
    });

    // Create identity (username doesn't need verification)
    const identity = await orm.create('identities', {
      subject_id: subjectId,
      provider: 'username',
      identifier: username,
      verified: true, //TODO: Username is always verified (no verification flow)
    });

    // Create username metadata record (minimal)
    await orm.create('username_identities', {
      identity_id: identity.id,
    });

    // Create session if loginOnRegister is true
    let token: string | null = null;
    if (ctx.config?.loginOnRegister) {
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
      token = await ctx.engine.createSessionFor('subject', subjectId, ttl);
    }

    return {
      success: true,
      message: 'Registration successful',
      status: 'su',
      token,
      subject: {
        id: subjectId,
        username,
        provider: 'username',
        verified: true,
      },
      others,
    };
  },
};
