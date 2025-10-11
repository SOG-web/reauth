import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { PhonePasswordConfig } from '../types';
import { passwordSchema } from '../../shared/validation';
import {
  verifyPasswordHash,
  hashPassword,
  haveIbeenPawned,
} from '../../../lib/password';
import { attachNewTokenIfDifferent } from '../../..';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  others?: Record<string, any>;
  token: Token;
};

export const changePasswordValidation = type({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  'others?': 'object',
  token: tokenType,
});

export const changePasswordStep: AuthStep<
  PhonePasswordConfig,
  'change-password',
  ChangePasswordInput,
  AuthOutput
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
  inputs: ['currentPassword', 'newPassword', 'others', 'token'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'others?': 'object',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { currentPassword, newPassword, others, token } = input;
    const orm = await ctx.engine.getOrm();

    // This step requires authentication - get subject from session
    const session = await ctx.engine.checkSession(token || '');
    if (!session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unauth',
        others,
      };
    }

    // Check password safety (HaveIBeenPwned)
    let isSafe = true;
    try {
      isSafe = await haveIbeenPawned(newPassword);
    } catch (err) {
      const logger = ctx.engine.getContainer().resolve('logger');
      logger.warn('phone', 'haveIbeenPawned check failed', { error: err });
      // Decide: fail-open (as below) or fail-closed per policy.
      isSafe = true;
    }
    if (!isSafe) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message:
            'Password has been found in data breaches. Please choose a stronger password.',
          status: 'pwr',
          others,
        },
        token,
        session.token,
      );
    }

    // Load current credentials
    const creds = await orm.findFirst('credentials', {
      where: (b) => b('subject_id', '=', session.subject.id),
    });

    if (!creds?.password_hash) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Current password not found',
          status: 'ip',
          others,
        },
        token,
        session.token,
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPasswordHash(
      creds.password_hash as string,
      currentPassword,
    );

    if (!isCurrentPasswordValid) {
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

    // Hash new password and update credentials
    const newPasswordHash = await hashPassword(newPassword);
    await orm.updateMany('credentials', {
      where: (b) => b('subject_id', '=', session.subject.id),
      set: {
        password_hash: newPasswordHash,
        password_updated_at: new Date(),
      },
    });

    const base = {
      success: true,
      message: 'Password changed successfully',
      status: 'su',
      others,
    };

    return attachNewTokenIfDifferent(base, token, session.token);
  },
};
