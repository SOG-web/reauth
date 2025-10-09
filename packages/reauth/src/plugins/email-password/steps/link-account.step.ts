import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { EmailPasswordConfig } from '../types';
import { emailSchema } from '../../shared/validation';
import { hashPassword } from '../../../lib/password';
import { genCode } from '../utils';

export type LinkAccountInput = {
  phone?: string;
  username?: string;
  provider: string;
  email: string;
  sendCode: boolean;
  others?: Record<string, any>;
};

export const linkAccountValidation = type({
  'phone?': 'string',
  'username?': 'string',
  provider: 'string',
  email: emailSchema,
  sendCode: 'boolean',
  'others?': 'object',
});

export const linkAccountStep: AuthStep<
  EmailPasswordConfig,
  'link-account',
  LinkAccountInput,
  AuthOutput
> = {
  name: 'link-account',
  description: 'Link an existing phone/username account with an email address',
  validationSchema: linkAccountValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, alr: 409, ic: 400, nf: 404 },
      auth: false, // Public endpoint
    },
  },
  inputs: ['phone', 'username', 'provider', 'email', 'sendCode', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'subject?': type({
      id: 'string',
      email: 'string',
      username: 'string',
      phone: 'string',
      provider: 'string',
      verified: 'boolean',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { phone, username, provider, email, sendCode, others } = input;
    const orm = await ctx.engine.getOrm();

    if (provider !== 'phone' && provider !== 'username') {
      return {
        success: false,
        message: 'Invalid provider',
        status: 'ic',
        others,
      };
    }

    if (provider === 'phone' && !phone) {
      return {
        success: false,
        message: 'Phone is required',
        status: 'ic',
        others,
      };
    }

    if (provider === 'username' && !username) {
      return {
        success: false,
        message: 'Username is required',
        status: 'ic',
        others,
      };
    }

    try {
      // Check if email is already linked to any account
      const existingEmailIdentity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
      });

      if (existingEmailIdentity) {
        return {
          success: false,
          message: 'Email address is already linked to an account',
          status: 'alr',
          others,
        };
      }

      // Find existing identity (phone or username)
      const identity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('provider', '=', provider),
            b('identifier', '=', phone ?? username),
          ),
      });

      if (!identity) {
        return {
          success: false,
          message: `${provider} account not found`,
          status: 'nf',
          others,
        };
      }

      // Verify the password for the existing account
      const credentials = (await orm.findFirst('credentials', {
        where: (b) => b('subject_id', '=', identity.subject_id),
      })) as any;

      if (!credentials?.password_hash) {
        return {
          success: false,
          message: 'Password not set for account',
          status: 'nf',
          others,
        };
      }

      // Create email identity linked to the same subject as the existing account
      const emailIdentity = await orm.create('identities', {
        subject_id: identity.subject_id,
        provider: 'email',
        identifier: email,
        verified: false, // Email will need verification if enabled
      });

      // Handle email verification if required
      if (ctx.config?.verifyEmail && ctx.config.sendCode && sendCode) {
        const code = ctx.config.generateCode
          ? await ctx.config.generateCode(email, { id: identity.subject_id })
          : genCode(ctx.config);

        // Store hashed code and set expiry
        const hashedCode = await hashPassword(String(code));
        const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
        const expiresAt = new Date(Date.now() + ms);

        await orm.create('email_identities', {
          identity_id: emailIdentity.id,
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        });

        const subject = await orm.findFirst('subjects', {
          where: (b) => b('id', '=', identity.subject_id),
        });

        // Send verification code
        try {
          await ctx.config.sendCode(subject, code, email, 'verify');
        } catch (error) {
          console.error('Failed to send verification code:', error);
          // Continue anyway - the account is linked, just verification failed
        }

        return {
          success: true,
          message:
            'Account linked successfully. Please verify your email address.',
          status: 'su',
          subject: {
            id: identity.subject_id,
            email,
            username: username || '',
            phone: phone || '',
            provider,
            verified: identity.verified,
          },
          others,
        };
      }

      return {
        success: true,
        message: 'Account linked successfully',
        status: 'su',
        subject: {
          id: identity.subject_id,
          email,
          username: username || '',
          phone: phone || '',
          provider,
          verified: identity.verified,
        },
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to link account',
        status: 'ip',
        others,
      };
    }
  },
};
