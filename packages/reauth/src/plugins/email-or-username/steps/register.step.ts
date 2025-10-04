import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import type { EmailOrUsernameConfig } from '../types';
import { passwordSchema } from '../../shared/validation';
import { detectInputType, findTestUser } from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';
import { hashPassword } from '../../../lib';
import { Token } from '../../../types';
import { genCode } from '../../email-password/utils';

export type RegisterInput = {
  emailOrUsername: string;
  password: string;
  others?: Record<string, any>;
};

export const registerValidation = type({
  emailOrUsername: 'string',
  password: passwordSchema,
  'others?': 'object | undefined',
});

export const registerStep: AuthStep<
  EmailOrUsernameConfig,
  'register',
  RegisterInput,
  AuthOutput
> = {
  name: 'register',
  description: 'Register a new user with email or username and password',
  validationSchema: registerValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 201, // Created successfully
        eq: 200, // Created but needs email verification
        ic: 400, // Invalid input
        du: 409, // Duplicate user
      },
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
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { emailOrUsername, password, others } = input;
    const orm = await ctx.engine.getOrm();

    // Check if test user
    const testUser = findTestUser(emailOrUsername, password, ctx.config || {});
    if (testUser) {
      // For test users, just return success without creating DB records
      const subjectRow = { id: emailOrUsername };
      let token: Token | null = null;

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
        emailOrUsername,
        provider: 'email-or-username',
        verified: true,
        ...testUser.profile,
      };

      const baseResult = {
        success: true,
        message: 'Registration successful (test user)',
        status: 'su',
        subject,
        others,
      };

      return attachNewTokenIfDifferent(baseResult, undefined, token);
    }

    // Detect input type (email vs username)
    const inputType = detectInputType(emailOrUsername);
    const providerType = inputType; // 'email' or 'username'

    // Check if user already exists
    const existingIdentity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(
          b('provider', '=', providerType),
          b('identifier', '=', emailOrUsername),
        ),
    });

    if (existingIdentity) {
      return {
        success: false,
        message: `User with this ${inputType} already exists`,
        status: 'du',
        others,
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create subject
    const subject = await orm.create('subjects', {});
    const subjectId = subject.id as string;

    // Create credentials
    await orm.create('credentials', {
      subject_id: subjectId,
      password_hash: hashedPassword,
    });

    // Create identity
    const identity = await orm.create('identities', {
      subject_id: subjectId,
      provider: providerType,
      identifier: emailOrUsername,
      verified: inputType === 'username', // Username is auto-verified, email may need verification
    });

    // Create provider-specific identity record
    if (inputType === 'email') {
      await orm.create('email_identities', {
        identity_id: identity.id,
      });
    } else {
      await orm.create('username_identities', {
        identity_id: identity.id,
      });
    }

    // Handle login after registration
    let token: Token | null = null;
    if (ctx.config?.loginOnRegister) {
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
      token = await ctx.engine.createSessionFor('subject', subjectId, ttl);
    }

    // Check if email verification is needed
    if (inputType === 'email' && ctx.config?.emailConfig?.verifyEmail) {
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

        // Update email_identities with verification code
        await orm.updateMany('email_identities', {
          where: (b) => b('identity_id', '=', identity.id),
          set: {
            verification_code: hashedCode,
            verification_code_expires_at: expiresAt,
          },
        });

        // Send verification code using email plugin's sendCode function
        await ctx.config.emailConfig.sendCode(
          { id: subjectId },
          code,
          emailOrUsername,
          'verify',
        );

        const baseResult = {
          success: false,
          message:
            'Registration successful. Verification code sent to your email.',
          status: 'eq',
          subject: {
            id: subjectId,
            [inputType]: emailOrUsername,
            provider: inputType,
            verified: false,
          },
          others,
        };

        return attachNewTokenIfDifferent(baseResult, undefined as any, token);
      } else {
        const baseResult = {
          success: false,
          message: 'Registration successful. Please verify your email.',
          status: 'eq',
          subject: {
            id: subjectId,
            emailOrUsername,
            provider: inputType,
            verified: false,
          },
          others,
        };

        return attachNewTokenIfDifferent(baseResult, undefined, token);
      }
    }

    const baseResult = {
      success: true,
      message: 'Registration successful',
      status: 'su',
      subject: {
        id: subjectId,
        emailOrUsername,
        provider: inputType,
        verified: true,
      },
      others,
    };

    return attachNewTokenIfDifferent(baseResult, undefined, token);
  },
};
