import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import { genCode } from '../utils';
import type { PhonePasswordConfigV2 } from '../types';
import { hashPassword } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';

export type SendResetPasswordInput = {
  phone: string;
  others?: Record<string, any>;
};

export const sendResetPasswordValidation = type({
  phone: phoneSchema,
  others: 'object?',
});

export const sendResetPasswordStep: AuthStepV2<
  SendResetPasswordInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'send-reset-password',
  description: 'Send password reset code to phone',
  validationSchema: sendResetPasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, nf: 200 }, // Return 200 even if not found to prevent enumeration
    },
  },
  inputs: ['phone', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { phone, others } = input;
    const orm = await ctx.engine.getOrm();

    if (!ctx.config?.sendCode) {
      throw new Error(
        'sendCode function is required for password reset. Please check the phone-password plugin config.',
      );
    }

    // Find identity by provider/phone
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
    });

    // Always return success to prevent user enumeration
    if (!identity) {
      return {
        success: true,
        message:
          'If the phone number is registered, a reset code has been sent',
        status: 'su',
        others,
      };
    }

    // Generate reset code
    const code = ctx.config.generateCode
      ? await ctx.config.generateCode(phone, { id: identity.subject_id })
      : genCode(ctx.config);

    // Store HASHED reset code and set expiry (security-first approach)
    const hashedCode = await hashPassword(String(code));
    const ms = ctx.config?.resetPasswordCodeExpiresIn ?? 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms);

    // Upsert phone reset data
    await orm.upsert('phone_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      create: {
        identity_id: identity.id,
        reset_code: hashedCode,
        reset_code_expires_at: expiresAt,
      },
      update: {
        reset_code: hashedCode,
        reset_code_expires_at: expiresAt,
      },
    });

    // Send reset code (plaintext sent via SMS, hashed stored in DB)
    await ctx.config.sendCode(
      { id: identity.subject_id },
      code,
      phone,
      'reset',
    );

    return {
      success: true,
      message: 'If the phone number is registered, a reset code has been sent',
      status: 'su',
      others,
    };
  },
};
