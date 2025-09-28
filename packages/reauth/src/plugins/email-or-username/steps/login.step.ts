import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import type { EmailOrUsernameConfig } from '../types';
import { passwordSchema } from '../../shared/validation';
import { detectInputType, findTestUser } from '../utils';
import { hashPassword, verifyPasswordHash } from '../../../lib/password';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';
import { genCode } from '../../email-password/utils';

export type LoginInput = {
  emailOrUsername: string;
  password: string;
  others?: Record<string, any>;
};

export const loginValidation = type({
  emailOrUsername: 'string',
  password: passwordSchema,
  others: 'object?',
});

export const loginStep: AuthStep<
  EmailOrUsernameConfig,
  LoginInput,
  AuthOutput
> = {
  name: 'login',
  description: 'Authenticate user with email or username and password',
  validationSchema: loginValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, ip: 401, su: 200, eq: 403, ic: 400 },
    },
  },
  inputs: ['emailOrUsername', 'password', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      emailOrUsername: 'string',
      provider: 'string',
      verified: 'boolean',
      profile: 'object?',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { emailOrUsername, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Check test users first
    const testUser = findTestUser(emailOrUsername, password, ctx.config || {});
    if (testUser) {
      const subjectRow = { id: emailOrUsername };
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;

      const token = await ctx.engine.createSessionFor(
        'subject',
        subjectRow.id,
        ttl,
      );

      const subject = {
        id: subjectRow.id,
        emailOrUsername,
        provider: 'email-or-username',
        verified: true,
        ...testUser.profile,
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

    // Detect input type (email vs username)
    const inputType = detectInputType(emailOrUsername);
    const providerType = inputType; // 'email' or 'username'

    // Find identity by provider and identifier
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(
          b('provider', '=', providerType),
          b('identifier', '=', emailOrUsername),
        ),
    });

    if (!identity) {
      return {
        success: false,
        message: `Invalid ${inputType} or password`,
        status: 'ip',
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

    // Verify password using the shared password verification

    const ok = await verifyPasswordHash(
      creds.password_hash as string,
      password,
    );

    if (!ok) {
      return {
        success: false,
        message: `Invalid ${inputType} or password`,
        status: 'ip',
        others,
      };
    }

    // For email users, check verification if required
    if (
      inputType === 'email' &&
      ctx.config?.emailConfig?.verifyEmail &&
      !identity.verified
    ) {
      // If sendCode is available, send verification code
      if (ctx.config.emailConfig.sendCode) {
        // Generate verification code using email plugin utils
        const code = ctx.config.emailConfig.generateCode
          ? await ctx.config.emailConfig.generateCode(emailOrUsername)
          : genCode(ctx.config.emailConfig as any);

        // Hash the code for storage

        const hashedCode = await hashPassword(String(code));
        const ms =
          ctx.config.emailConfig.verificationCodeExpiresIn ?? 30 * 60 * 1000;
        const expiresAt = new Date(Date.now() + ms);

        // Store verification code in email_identities table
        await orm.upsert('email_identities', {
          where: (b) => b('identity_id', '=', identity.id),
          create: {
            identity_id: identity.id,
            verification_code: hashedCode,
            verification_code_expires_at: expiresAt,
          },
          update: {
            verification_code: hashedCode,
            verification_code_expires_at: expiresAt,
          },
        });

        // Send verification code using email plugin's sendCode function
        await ctx.config.emailConfig.sendCode(
          { id: identity.subject_id },
          code,
          emailOrUsername,
          'verify',
        );

        return {
          success: false,
          message: 'Email verification required. Verification code sent.',
          status: 'eq',
          others,
        };
      } else {
        return {
          success: false,
          message: 'Email verification required',
          status: 'eq',
          others,
        };
      }
    }

    // Create session
    const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
    const token = await ctx.engine.createSessionFor(
      'subject',
      identity.subject_id as string,
      ttl,
    );

    const subject = {
      id: identity.subject_id,
      emailOrUsername: emailOrUsername,
      provider: inputType,
      verified: identity.verified,
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
