import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PhonePasswordConfigV2 } from '../types';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { verifyPasswordHash, hashPassword, checkPasswordSafety } from '../../../../lib/password';

export type ResetPasswordInput = {
  phone: string;
  code: string | number;
  newPassword: string;
  others?: Record<string, any>;
};

export const resetPasswordValidation = type({
  phone: 'string.phone',
  code: 'string | number',
  newPassword: passwordSchema,
  others: 'object?',
});

export const resetPasswordStep: AuthStepV2<
  ResetPasswordInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'reset-password',
  description: 'Reset password using phone verification code',
  validationSchema: resetPasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, ex: 410, nf: 404, pwr: 400 },
    },
  },
  inputs: ['phone', 'code', 'newPassword', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { phone, code, newPassword, others } = input;
    const orm = await ctx.engine.getOrm();

    // Check password safety (HaveIBeenPwned)
    const isSafe = await checkPasswordSafety(newPassword);
    if (!isSafe) {
      return {
        success: false,
        message: 'Password has been found in data breaches. Please choose a stronger password.',
        status: 'pwr',
        others,
      };
    }

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

    // Find phone metadata with reset code
    const phoneData = await orm.findFirst('phone_identities', {
      where: (b) => b('identity_id', '=', identity.id),
    });

    if (!phoneData?.reset_code) {
      return {
        success: false,
        message: 'Invalid Phone or Code',
        status: 'ic',
        others,
      };
    }

    // Check if reset code has expired
    if (phoneData.reset_code_expires_at && 
        new Date() > new Date(phoneData.reset_code_expires_at)) {
      return {
        success: false,
        message: 'Reset code has expired',
        status: 'ex',
        others,
      };
    }

    // Verify reset code using constant-time comparison
    const isValidCode = await verifyPasswordHash(
      phoneData.reset_code,
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

    // Hash new password and update credentials
    const newPasswordHash = await hashPassword(newPassword);
    await orm.updateMany('credentials', {
      where: (b) => b('subject_id', '=', identity.subject_id),
      data: {
        password_hash: newPasswordHash,
        password_updated_at: new Date(),
      },
    });

    // Clear reset code
    await orm.updateMany('phone_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      data: {
        reset_code: null,
        reset_code_expires_at: null,
      },
    });

    return {
      success: true,
      message: 'Password reset successful',
      status: 'su',
      others,
    };
  },
};