import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { PhonePasswordConfigV2 } from '../types';
import { passwordSchema } from '../../../../plugins/shared/validation';
import { verifyPasswordHash, hashPassword, checkPasswordSafety } from '../../../../lib/password';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  others?: Record<string, any>;
};

export const changePasswordValidation = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  others: 'object?',
});

export const changePasswordStep: AuthStepV2<
  ChangePasswordInput,
  AuthOutput,
  PhonePasswordConfigV2
> = {
  name: 'change-password',
  description: 'Change password for authenticated user',
  validationSchema: changePasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, pwr: 400, unauth: 401 },
      auth: true, // Requires authentication
    },
  },
  inputs: ['currentPassword', 'newPassword', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { currentPassword, newPassword, others } = input;
    const orm = await ctx.engine.getOrm();

    // This step requires authentication - get subject from session
    const session = await ctx.engine.verifySession(input.token || '');
    if (!session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unauth',
        others,
      };
    }

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

    // Load current credentials
    const creds = await orm.findFirst('credentials', {
      where: (b) => b('subject_id', '=', session.subject.id),
    });

    if (!creds?.password_hash) {
      return {
        success: false,
        message: 'Current password not found',
        status: 'ip',
        others,
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPasswordHash(
      creds.password_hash,
      currentPassword,
    );

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        message: 'Current password is incorrect',
        status: 'ip',
        others,
      };
    }

    // Hash new password and update credentials
    const newPasswordHash = await hashPassword(newPassword);
    await orm.updateMany('credentials', {
      where: (b) => b('subject_id', '=', session.subject.id),
      data: {
        password_hash: newPasswordHash,
        password_updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Password changed successfully',
      status: 'su',
      others,
    };
  },
};