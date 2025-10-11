import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { PhonePasswordConfig } from '../types';
import { phoneSchema } from '../../shared/validation';
import { hashPassword } from '../../../lib/password';
import { genCode } from '../utils';

export type LinkAccountInput = {
  email?: string;
  username?: string;
  provider: string;
  phone: string;
  sendCode: boolean;
  others?: Record<string, any>;
};

export const linkAccountValidation = type({
  'email?': 'string.email',
  'username?': 'string',
  provider: 'string',
  sendCode: 'boolean',
  phone: phoneSchema,
  'others?': 'object',
});

export const linkAccountStep: AuthStep<
  PhonePasswordConfig,
  'link-account',
  LinkAccountInput,
  AuthOutput
> = {
  name: 'link-account',
  description: 'Link an existing email-password account with a phone number',
  validationSchema: linkAccountValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, alr: 409, ic: 400, nf: 404 },
      auth: false, // Public endpoint
    },
  },
  inputs: ['email', 'username', 'provider', 'phone', 'sendCode', 'others'],
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
    const { email, username, provider, phone, sendCode, others } = input;
    const orm = await ctx.engine.getOrm();

    if (provider !== 'email' && provider !== 'username') {
      return {
        success: false,
        message: 'Invalid provider',
        status: 'ic',
        others,
      };
    }

    if (provider === 'email' && !email) {
      return {
        success: false,
        message: 'Email is required',
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
      // Check if phone number is already linked to any account
      const existingPhoneIdentity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
      });

      if (existingPhoneIdentity) {
        return {
          success: false,
          message: 'Phone number is already linked to an account',
          status: 'alr',
          others,
        };
      }

      // Find existing email identity
      const identity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('provider', '=', provider),
            b('identifier', '=', email ?? username),
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

      // Verify the password for the email account
      const credentials = (await orm.findFirst('credentials', {
        where: (b) => b('subject_id', '=', identity.subject_id),
      })) as any;

      if (!credentials?.password_hash) {
        return {
          success: false,
          message: 'Password not set for email account',
          status: 'nf',
          others,
        };
      }

      // Create phone identity linked to the same subject as the email account
      const phoneIdentity = await orm.create('identities', {
        subject_id: identity.subject_id,
        provider: 'phone',
        identifier: phone,
        verified: false, // Phone will need verification if enabled
      });

      // Handle phone verification if required
      if (ctx.config?.verifyPhone && ctx.config.sendCode && sendCode) {
        const code = ctx.config.generateCode
          ? await ctx.config.generateCode(phone, { id: identity.subject_id })
          : genCode(ctx.config);

        // Store hashed code and set expiry
        const hashedCode = await hashPassword(String(code));
        const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
        const expiresAt = new Date(Date.now() + ms);

        await orm.create('phone_identities', {
          identity_id: phoneIdentity.id,
          verification_code: hashedCode,
          verification_code_expires_at: expiresAt,
        });

        const subject = await orm.findFirst('subjects', {
          where: (b) => b('id', '=', identity.subject_id),
        });

        // Send verification code
        try {
          await ctx.config.sendCode(subject, code, phone, 'verify');
        } catch (error) {
          const logger = ctx.engine.getContainer().resolve('logger');
          logger.error('phone', 'Failed to send verification code', {
            error,
            phone,
          });
          // Continue anyway - the account is linked, just verification failed
        }

        return {
          success: true,
          message:
            'Account linked successfully. Please verify your phone number.',
          status: 'su',
          subject: {
            id: identity.subject_id,
            email: email || '',
            username: username || '',
            phone,
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
          email: email || '',
          username: username || '',
          phone,
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
