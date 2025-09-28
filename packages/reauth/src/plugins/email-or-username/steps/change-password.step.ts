import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  tokenType,
  Token,
} from '../../../types';
import type { EmailOrUsernameConfig } from '../types';
import { passwordSchema } from '../../shared/validation';
import { hashPassword, verifyPasswordHash } from '../../../lib/password';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  token: Token;
  others?: Record<string, any>;
};

export const changePasswordValidation = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  token: tokenType,
  others: 'object?',
});

export const changePasswordStep: AuthStep<
  EmailOrUsernameConfig,
  ChangePasswordInput,
  AuthOutput
> = {
  name: 'change-password',
  description: 'Change user password (works for both email and username users)',
  validationSchema: changePasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: {
        su: 200, // Success
        ic: 400, // Invalid input
        unf: 401, // Unauthorized
        ip: 401, // Invalid password
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
    'token?': tokenType,
    'subject?': type({
      id: 'string',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { currentPassword, newPassword, token, others } = input;
    const orm = await ctx.engine.getOrm();

    // Check session to get current user
    const session = await ctx.engine.checkSession(token);
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
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'No password set for this user',
          status: 'unf',
          others,
        },
        token,
        session.token,
      );
    }

    // Verify current password

    const currentPasswordValid = await verifyPasswordHash(
      creds.password_hash as string,
      currentPassword,
    );

    if (!currentPasswordValid) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Current password is incorrect',
          status: 'ip',
          others,
        },
        token,
        session.token,
      );
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);

    await orm.updateMany('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
      set: {
        password_hash: newPasswordHash,
      },
    });

    const outSubject = {
      id: session.subject.id,
    };

    const baseResult = {
      success: true,
      message: 'Password changed successfully',
      status: 'su',
      subject: outSubject,
      others,
    } as const;

    return attachNewTokenIfDifferent(baseResult, token, session.token);
  },
};
