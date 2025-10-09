import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { UsernamePasswordConfig } from '../types';
import { phoneSchema, emailSchema } from '../../shared/validation';

export type LinkAccountInput = {
  phone?: string;
  email?: string;
  provider: string;
  username: string;
  others?: Record<string, any>;
};

export const linkAccountValidation = type({
  'phone?': phoneSchema,
  'email?': emailSchema,
  provider: 'string',
  username: 'string',
  'others?': 'object',
});

export const linkAccountStep: AuthStep<
  UsernamePasswordConfig,
  'link-account',
  LinkAccountInput,
  AuthOutput
> = {
  name: 'link-account',
  description: 'Link an existing phone/email account with a username',
  validationSchema: linkAccountValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, alr: 409, ic: 400, nf: 404 },
      auth: false, // Public endpoint
    },
  },
  inputs: ['phone', 'email', 'provider', 'username', 'others'],
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
    const { phone, email, provider, username, others } = input;
    const orm = await ctx.engine.getOrm();

    if (provider !== 'phone' && provider !== 'email') {
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

    if (provider === 'email' && !email) {
      return {
        success: false,
        message: 'Email is required',
        status: 'ic',
        others,
      };
    }

    try {
      // Check if username is already linked to any account
      const existingUsernameIdentity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(b('provider', '=', 'username'), b('identifier', '=', username)),
      });

      if (existingUsernameIdentity) {
        return {
          success: false,
          message: 'Username is already linked to an account',
          status: 'alr',
          others,
        };
      }

      // Find existing identity (phone or email)
      const identity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('provider', '=', provider),
            b('identifier', '=', phone ?? email),
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

      // Create username identity linked to the same subject as the existing account
      await orm.create('identities', {
        subject_id: identity.subject_id,
        provider: 'username',
        identifier: username,
        verified: true, // Username doesn't require verification
      });

      return {
        success: true,
        message: 'Account linked successfully',
        status: 'su',
        subject: {
          id: identity.subject_id,
          email: email || '',
          username,
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
