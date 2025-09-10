import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { EmailOrUsernameConfigV2 } from '../types';
import { passwordSchema } from '../../../../plugins/shared/validation';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  token?: string;
  others?: Record<string, any>;
};

export const changePasswordValidation = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  token: 'string?',
  others: 'object?',
});

export const changePasswordStep: AuthStepV2<
  ChangePasswordInput,
  AuthOutput,
  EmailOrUsernameConfigV2
> = {
  name: 'change-password',
  description: 'Change user password (works for both email and username users)',
  validationSchema: changePasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        su: 200,  // Success
        ic: 400,  // Invalid input
        unf: 401, // Unauthorized
        ip: 401   // Invalid password
      },
      auth: true, // Requires authentication
    },
  },
  inputs: ['currentPassword', 'newPassword', 'token', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { currentPassword, newPassword, token, others } = input;
    const orm = await ctx.engine.getOrm();
    
    // Check session to get current user
    const session = await ctx.engine.checkSession(token || '');
    if (!session.valid || !session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unf',
        others,
      };
    }

    const subjectId = session.subject.id;

    // Load current credentials
    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    if (!creds?.password_hash) {
      return {
        success: false,
        message: 'No password set for this user',
        status: 'unf',
        others,
      };
    }

    // Verify current password
    const { verifyPasswordHash, hashPassword } = await import('../../../../lib/password');
    const currentPasswordValid = await verifyPasswordHash(
      creds.password_hash as string,
      currentPassword,
    );

    if (!currentPasswordValid) {
      return {
        success: false,
        message: 'Current password is incorrect',
        status: 'ip',
        others,
      };
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    
    await orm.updateMany('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
      set: {
        password_hash: newPasswordHash,
      },
    });

    return {
      success: true,
      message: 'Password changed successfully',
      status: 'su',
      token,
      subject: session.subject,
      others,
    };
  },
};