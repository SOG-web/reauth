import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import { genCode } from '../utils';
import type { PhonePasswordConfigV2 } from '../types';
import { hashPassword } from '../../../../lib/password';

export type ResendVerifyPhoneInput = {
  phone: string;
  others?: Record<string, any>;
};

export const resendVerifyPhoneValidation = type({
  phone: 'string.phone',
  others: 'object?',
});

export const resendVerifyPhoneStep: AuthStepV2<
  ResendVerifyPhoneInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'resend-verify-phone',
  description: 'Resend phone verification code',
  validationSchema: resendVerifyPhoneValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, nf: 404, ic: 400 },
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
        'sendCode function is required for phone verification. Please check the phone-password plugin config.',
      );
    }

    // Find identity by provider/phone
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
    });

    if (!identity) {
      return {
        success: false,
        message: 'Phone number not found',
        status: 'nf',
        others,
      };
    }

    if (identity.verified) {
      return {
        success: false,
        message: 'Phone number is already verified',
        status: 'ic',
        others,
      };
    }

    // Generate new verification code
    const code = ctx.config.generateCode
      ? await ctx.config.generateCode(phone, { id: identity.subject_id })
      : genCode(ctx.config);
    
    // Store hashed code and set expiry
    const hashedCode = await hashPassword(String(code));
    const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms);

    // Upsert phone verification data
    await orm.upsert('phone_identities', {
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

    // Send verification code
    await ctx.config.sendCode({ id: identity.subject_id }, code, phone, 'verify');

    return {
      success: true,
      message: 'Verification code sent',
      status: 'su',
      others,
    };
  },
};