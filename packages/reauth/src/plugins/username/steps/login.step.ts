import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import { findTestUser } from '../utils';
import type { UsernamePasswordConfig } from '../types';
import { passwordSchema, usernameSchema } from '../../shared/validation';
import { verifyPasswordHash } from '../../../lib/password';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type LoginInput = {
  username: string;
  password: string;
  others?: Record<string, any>;
};

export const loginValidation = type({
  username: usernameSchema,
  password: passwordSchema,
  'others?': 'object | undefined',
});

export const loginStep: AuthStep<
  UsernamePasswordConfig,
  'login',
  LoginInput,
  AuthOutput
> = {
  name: 'login',
  description: 'Authenticate user with username and password',
  validationSchema: loginValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, ip: 401, su: 200, ic: 400 },
    },
  },
  inputs: ['username', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      username: 'string',
      provider: 'string',
      verified: 'boolean',
      profile: 'object?',
    }),
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { username, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(username, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: username };

      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;

      const token = await ctx.engine.createSessionFor(
        'subject',
        subjectRow.id,
        ttl,
      );

      const subject = {
        id: subjectRow.id,
        username,
        provider: 'username',
        verified: true, // Username doesn't require verification
        profile: tu.profile,
      };

      const baseResult = {
        success: true,
        message: 'Login successful (test user)',
        status: 'su',
        subject,
        others,
      };

      return attachNewTokenIfDifferent(baseResult, undefined as any, token);
    }

    // Find identity by provider/username
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'username'), b('identifier', '=', username)),
    });

    if (!identity)
      return {
        success: false,
        message: 'Invalid username or password',
        status: 'ip',
        others,
      };

    // Load credentials for subject
    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', identity.subject_id),
    });

    if (!creds?.password_hash) {
      return {
        success: false,
        message: 'Password not set',
        status: 'unf',
        others,
      };
    }

    // Verify password
    const ok = await verifyPasswordHash(
      creds.password_hash as string,
      password,
    );
    if (!ok)
      return {
        success: false,
        message: 'Invalid username or password',
        status: 'ip',
        others,
      };

    // Create session (no verification required for username)
    const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
    const token = await ctx.engine.createSessionFor(
      'subject',
      identity.subject_id as string,
      ttl,
    );

    const subject = {
      id: identity.subject_id,
      username,
      provider: 'username',
      verified: true, // Username is always verified (no verification flow)
    };
    const baseResult = {
      success: true,
      message: 'Login successful',
      status: 'su',
      subject,
      others,
    };

    return attachNewTokenIfDifferent(baseResult, undefined, token);
  },
};
