import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { PhonePasswordConfig } from '../types';
import { verifyPasswordHash } from '../../../../lib/password';
import { phoneSchema } from '../../../../plugins/shared/validation';

export type VerifyPhoneInput = {
  phone: string;
  code: string | number;
  others?: Record<string, any>;
};

export const verifyPhoneValidation = type({
  phone: phoneSchema,
  code: 'string | number',
  'others?': 'object | undefined',
});

export const verifyPhoneStep: AuthStep<
  VerifyPhoneInput,
  AuthOutput,
  PhonePasswordConfig
> = {
  name: 'verify-phone',
  description: 'Verify phone number with verification code',
  validationSchema: verifyPhoneValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, ex: 410, nf: 404 },
    },
  },
  inputs: ['phone', 'code', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { phone, code, others } = input;
    const orm = await ctx.engine.getOrm();

    // Find identity by provider/phone
    const identity = await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'phone'), b('identifier', '=', phone)),
    });

    if (!identity) {
      return {
        success: false,
        message: 'Invalid Phone or Code',
        status: 'nf',
        others,
      };
    }

    // Find phone metadata
    const phoneData = await orm.findFirst('phone_identities', {
      where: (b) => b('identity_id', '=', identity.id),
    });

    if (!phoneData?.verification_code) {
      return {
        success: false,
        message: 'Invalid Phone or Code',
        status: 'ic',
        others,
      };
    }

    // Check if code has expired
    if (
      phoneData.verification_code_expires_at &&
      new Date() > new Date(phoneData.verification_code_expires_at as string)
    ) {
      return {
        success: false,
        message: 'Verification code has expired',
        status: 'ex',
        others,
      };
    }

    // Verify code using constant-time comparison
    const isValidCode = await verifyPasswordHash(
      phoneData.verification_code as string,
      String(code),
    );

    if (!isValidCode) {
      return {
        success: false,
        message: 'Invalid Phone or Code',
        status: 'ic',
        others,
      };
    }

    // Mark identity as verified and clear verification data
    await orm.updateMany('identities', {
      where: (b) => b('id', '=', identity.id),
      set: { verified: true },
    });

    // Clear verification code
    await orm.updateMany('phone_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      set: {
        verification_code: null,
        verification_code_expires_at: null,
      },
    });

    return {
      success: true,
      message: 'Phone verification successful',
      status: 'su',
      others,
    };
  },
};
