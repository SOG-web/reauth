import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import { findTestUser, genCode } from '../utils';
import type { EmailPasswordConfigV2 } from '../types';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { verifyPasswordHash } from '../../../../lib/password';

export type LoginInput = {
  email: string;
  password: string;
  others?: Record<string, any>;
};

export const loginValidation = type({
  email: 'string.email',
  password: passwordSchema,
  others: 'object?',
});

export const loginStep: AuthStepV2<
  LoginInput,
  AuthOutput,
  EmailPasswordConfigV2
> = {
  name: 'login',
  description: 'Authenticate user with email and password',
  validationSchema: loginValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, ip: 400, su: 200, eq: 300, ic: 400 },
    },
  },
  inputs: ['email', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
  }),
  async run(input, ctx) {
    const { email, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Test users first (dev/test envs)
    const tu = findTestUser(email, password, ctx.config || {});
    if (tu) {
      const subjectRow = { id: email };

      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;

      const token = await ctx.engine.createSessionFor(
        'subject',
        subjectRow.id,
        ttl,
      );

      const subject = {
        id: subjectRow.id,
        email,
        provider: 'email',
        verified: true,
        ...tu.profile,
      };

      return {
        success: true,
        message: 'Login successful (test user)',
        status: 'su',
        token,
        subject,
        others,
      };
    }

    // Find identity by provider/email
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
    });

    if (!identity)
      return {
        success: false,
        message: 'User not found',
        status: 'unf',
        others,
      };

    if (ctx.config?.verifyEmail && !identity.verified) {
      if (!ctx.config.sendCode) {
        throw new Error(
          'email verification is on but no sendCode function provider. Please check the email-password plugin config option',
        );
      }
      // generate and send code if configured
      const code = ctx.config.generateCode
        ? await ctx.config.generateCode(email, { id: identity.subject_id })
        : genCode(ctx.config);

      await orm.upsert('email_identities', {
        where: (b) => b('identity_id', '=', identity.id),
        create: {
          identity_id: identity.id,
          verification_code: code,
        },
        update: { verification_code: code },
      });

      if (ctx.config.sendCode)
        await ctx.config.sendCode(
          { id: identity.subject_id },
          code,
          email,
          'verify',
        );
      return {
        success: false,
        message: 'User Email verification is requred',
        status: 'eq',
        others,
      };
    }

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
        message: 'Invalid password',
        status: 'ip',
        others,
      };

    const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
    const token = await ctx.engine.createSessionFor(
      'subject',
      identity.subject_id as string,
      ttl,
    );

    const subject = {
      id: identity.subject_id,
      email,
      provider: 'email',
      verified: identity.verified,
    };
    return {
      success: true,
      message: 'Login successful',
      status: 'su',
      token,
      subject,
      others,
    };
  },
};
