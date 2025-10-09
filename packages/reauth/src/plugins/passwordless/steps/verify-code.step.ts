import { type } from 'arktype';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import type { PasswordlessConfig } from '../types';
import { verifyPasswordHash } from '../../../lib/password';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type VerifyCodeInput = {
  destination: string; // phone, email, or whatsapp
  destination_type: 'phone' | 'email' | 'whatsapp';
  code: string;
  purpose?: 'login' | 'register' | 'verify';
  others?: Record<string, any>;
};

export const verifyCodeValidation = type({
  destination: 'string',
  destination_type: 'string',
  code: 'string',
  'purpose?': 'string',
  'others?': 'object',
});

export const verifyCodeStep: AuthStep<
  PasswordlessConfig,
  'verify-code',
  VerifyCodeInput,
  AuthOutput
> = {
  name: 'verify-code',
  description:
    'Verify code sent to phone, email, or WhatsApp for passwordless authentication',
  validationSchema: verifyCodeValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, nf: 404, ex: 410, un: 401 },
    },
  },
  inputs: ['destination', 'destination_type', 'code', 'purpose', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      'email?': 'string',
      'phone?': 'string',
      'whatsapp?': 'string',
      provider: 'string',
      verified: 'boolean',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const {
      destination,
      destination_type,
      code,
      purpose = 'login',
      others,
    } = input;
    const orm = await ctx.engine.getOrm();

    // Validate config requires verification codes
    if (!ctx.config?.verificationCodes) {
      return {
        success: false,
        message: 'Verification code authentication is not configured',
        status: 'ic',
        error: 'Verification code authentication is not enabled',
      };
    }

    try {
      // Clean up expired codes (best effort)
      await cleanupExpiredCodes(orm);

      // Find verification code
      const verificationCode = (await orm.findFirst('verification_codes', {
        where: (b: any) =>
          b.and(
            b('destination', '=', destination),
            b('destination_type', '=', destination_type),
            b('purpose', '=', purpose),
            b('used_at', '=', null),
          ),
      })) as any;

      if (!verificationCode) {
        return {
          success: false,
          message: 'Invalid or expired verification code',
          status: 'nf',
          others,
        };
      }

      // Check if code has expired
      if (new Date() > new Date(verificationCode.expires_at)) {
        return {
          success: false,
          message: 'Verification code has expired',
          status: 'ex',
          others,
        };
      }

      // Check attempt limit
      if (verificationCode.attempts >= verificationCode.max_attempts) {
        return {
          success: false,
          message: 'Too many verification attempts. Please request a new code.',
          status: 'un',
          others,
        };
      }

      // Verify the code
      const isCodeValid = await verifyPasswordHash(
        verificationCode.code_hash,
        code,
      );

      if (!isCodeValid) {
        // Increment attempt count
        await orm.updateMany('verification_codes', {
          where: (b: any) => b('id', '=', verificationCode.id),
          set: { attempts: verificationCode.attempts + 1 },
        });

        return {
          success: false,
          message: 'Invalid verification code',
          status: 'ic',
          others,
        };
      }

      // Mark verification code as used
      await orm.updateMany('verification_codes', {
        where: (b: any) => b('id', '=', verificationCode.id),
        set: { used_at: new Date() },
      });

      let subject: any = null;
      let subject_id = verificationCode.subject_id;

      // For registration, create new subject if none exists
      if (purpose === 'register' && !subject_id) {
        subject = (await orm.create('subjects', {})) as any;
        subject_id = subject.id;

        // Create identity for the new subject
        await orm.create('identities', {
          subject_id: subject.id,
          provider: destination_type,
          identifier: destination,
          verified: true,
        });

        // Update verification code with subject_id
        await orm.updateMany('verification_codes', {
          where: (b: any) => b('id', '=', verificationCode.id),
          set: { subject_id: subject.id },
        });
      } else if (subject_id) {
        // For login/verify, get existing subject
        subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', subject_id),
        });

        if (!subject) {
          return {
            success: false,
            message: 'Associated account not found',
            status: 'nf',
            others,
          };
        }

        // Update identity verification status if needed
        if (purpose === 'verify') {
          await orm.updateMany('identities', {
            where: (b: any) =>
              b.and(
                b('subject_id', '=', subject_id),
                b('provider', '=', destination_type),
                b('identifier', '=', destination),
              ),
            set: { verified: true },
          });
        }
      } else {
        return {
          success: false,
          message: 'Invalid verification code state',
          status: 'nf',
          others,
        };
      }

      // Create session
      const sessionToken = await ctx.engine.createSessionFor(
        'subject',
        subject_id,
        ctx.config.sessionTtlSeconds || 3600,
      );

      const baseResult = {
        success: true,
        message: 'Verification successful',
        status: 'su',
        subject: {
          id: subject_id,
          ...(destination_type === 'email' && { email: destination }),
          ...(destination_type === 'phone' && { phone: destination }),
          ...(destination_type === 'whatsapp' && { whatsapp: destination }),
          provider: destination_type,
          verified: true,
        },
        others: {
          destination,
          destination_type,
          purpose,
          authentication_method: 'verification_code',
          ...others,
        },
      };

      return attachNewTokenIfDifferent(baseResult, undefined, sessionToken);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify code',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

// Helper function to clean up expired codes
async function cleanupExpiredCodes(orm: any) {
  const now = new Date();
  await orm.updateMany('verification_codes', {
    where: (b: any) => b('expires_at', '<', now),
    set: { used_at: now }, // Mark as used to prevent further attempts
  });
}
