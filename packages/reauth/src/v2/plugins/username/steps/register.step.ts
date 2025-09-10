import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import { findTestUser } from '../utils';
import type { UsernamePasswordConfigV2 } from '../types';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { hashPassword, checkPasswordSafety } from '../../../../lib/password';

export type RegisterInput = {
  username: string;
  password: string;
  others?: Record<string, any>;
};

export const registerValidation = type({
  username: 'string',
  password: passwordSchema,
  others: 'object?',
});

export const registerStep: AuthStepV2<
  RegisterInput,
  AuthOutput,
  UsernamePasswordConfigV2
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
    'subject?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { username, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(username, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: username };

      let token = null;
      if (ctx.config?.loginOnRegister) {
        const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
        token = await ctx.engine.createSessionFor('subject', subjectRow.id, ttl);
      }

      const subject = {
        id: subjectRow.id,
        username,
        provider: 'username',
        verified: true,
        ...tu.profile,
      };

      return {
        success: true,
        message: 'Registration successful (test user)',
        status: 'su',
        token,
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
    const isSafe = await checkPasswordSafety(password);
    if (!isSafe) {
      return {
        success: false,
        message: 'Password has been found in data breaches. Please choose a stronger password.',
        status: 'pwr',
        others,
      };
    }

    // Create subject
    const subject = await orm.insertOne('subjects', {});
    const subjectId = subject.id;

    // Create credentials (hashed password)
    const passwordHash = await hashPassword(password);
    await orm.insertOne('credentials', {
      subject_id: subjectId,
      password_hash: passwordHash,
    });

    // Create identity (username doesn't need verification)
    const identity = await orm.insertOne('identities', {
      subject_id: subjectId,
      provider: 'username',
      identifier: username,
      verified: true, // Username is always verified (no verification flow)
    });

    // Create username metadata record (minimal)
    await orm.insertOne('username_identities', {
      identity_id: identity.id,
    });

    // Create session if loginOnRegister is true
    let token = null;
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