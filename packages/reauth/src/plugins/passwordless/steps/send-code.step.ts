import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { PasswordlessConfig } from '../types';
import { emailSchema, phoneSchema } from '../../shared/validation';
import { hashPassword } from '../../../lib/password';
import { generateCode } from '../utils';

export type SendCodeInput = {
  destination: string; // phone, email, or whatsapp
  destination_type: 'phone' | 'email' | 'whatsapp';
  purpose?: 'login' | 'register' | 'verify';
  others?: Record<string, any>;
};

export const sendCodeValidation = type({
  destination: 'string',
  destination_type: 'string',
  'purpose?': 'string',
  'others?': 'object',
});

export const sendCodeStep: AuthStep<
  PasswordlessConfig,
  'send-code',
  SendCodeInput,
  AuthOutput
> = {
  name: 'send-code',
  description:
    'Send verification code to phone, email, or WhatsApp for passwordless authentication',
  validationSchema: sendCodeValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, nf: 404 },
    },
  },
  inputs: ['destination', 'destination_type', 'purpose', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { destination, destination_type, purpose = 'login', others } = input;
    const orm = await ctx.engine.getOrm();

    // Validate destination format based on type
    if (destination_type === 'email' && !emailSchema(destination)) {
      return {
        success: false,
        message: 'Invalid email format',
        status: 'ic',
        others,
      };
    }

    if (destination_type === 'phone' && !phoneSchema(destination)) {
      return {
        success: false,
        message: 'Invalid phone format',
        status: 'ic',
        others,
      };
    }

    // Validate config requires verification codes
    if (!ctx.config?.verificationCodes || !ctx.config.sendCode) {
      return {
        success: false,
        message: 'Verification code authentication is not configured',
        status: 'ic',
        error:
          'Verification code authentication is not enabled or sendCode function is missing',
      };
    }

    try {
      // Clean up expired codes (best effort)
      await cleanupExpiredCodes(orm);

      let subject_id: string | null = null;

      // For login purpose, try to find existing subject
      if (purpose === 'login') {
        const identity = (await orm.findFirst('identities', {
          where: (b: any) =>
            b.and(
              b('identifier', '=', destination),
              b('provider', '=', destination_type),
            ),
        })) as any;

        if (identity) {
          subject_id = identity.subject_id;
        } else {
          // For login, if no existing account, return generic message to prevent enumeration
          return {
            success: true,
            message:
              'If an account exists for this destination, a verification code has been sent.',
            status: 'su',
            others: {
              destination,
              destination_type,
              expires_in_minutes: ctx.config.verificationCodeTtlMinutes || 10,
            },
          };
        }
      }

      // Generate verification code
      const code = await generateCode(
        destination,
        destination_type,
        ctx.config,
      );
      const codeStr = String(code);
      const codeHash = await hashPassword(codeStr);

      // Set expiration time
      const expiresAt = new Date(
        Date.now() + (ctx.config.verificationCodeTtlMinutes || 10) * 60 * 1000,
      );

      // Store verification code in database
      await orm.create('verification_codes', {
        subject_id,
        code_hash: codeHash,
        destination,
        destination_type,
        purpose,
        expires_at: expiresAt,
        used_at: null,
        attempts: 0,
        max_attempts: ctx.config.maxVerificationAttempts || 3,
        metadata: others || {},
      });

      // Get subject for sendCode function (if exists)
      let subject = null;
      if (subject_id) {
        subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', subject_id),
        });
      }

      // Send verification code via configured function
      await ctx.config.sendCode(
        destination,
        codeStr,
        destination_type,
        purpose,
        subject,
      );

      return {
        success: true,
        message: 'Verification code sent successfully',
        status: 'su',
        others: {
          destination,
          destination_type,
          purpose,
          expires_at: expiresAt.toISOString(),
          expires_in_minutes: ctx.config.verificationCodeTtlMinutes || 10,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send verification code',
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
