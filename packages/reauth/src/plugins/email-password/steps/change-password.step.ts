import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { EmailPasswordConfig } from '../types';
import {
  verifyPasswordHash,
  hashPassword,
  haveIbeenPawned,
} from '../../../lib/password';
import { passwordSchema } from '../../../plugins/shared/validation';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ChangePasswordInput = {
  token: Token;
  oldPassword: string;
  newPassword: string;
  others?: Record<string, any>;
};
export const changePasswordValidation = type({
  token: tokenType,
  oldPassword: passwordSchema,
  newPassword: passwordSchema,
  'others?': 'object',
});

export const changePasswordStep: AuthStep<
  EmailPasswordConfig,
  'change-password',
  ChangePasswordInput,
  AuthOutput
> = {
  name: 'change-password',
  description: 'Change password for authenticated subject',
  validationSchema: changePasswordValidation,
  protocol: {
    http: { method: 'POST', codes: { su: 200, ip: 400, ic: 400 }, auth: true },
  },
  inputs: ['token', 'oldPassword', 'newPassword', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'others?': 'object',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, oldPassword, newPassword, others } = input;

    const check = await ctx.engine.checkSession(token);

    if (!check.valid || !check.subject?.id)
      return { success: false, message: 'Unauthorized', status: 'ip', others };

    const subjectId = check.subject.id as string;
    const orm = await ctx.engine.getOrm();

    const creds = (await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
    })) as { password_hash?: string } | null;

    if (!creds?.password_hash)
      return {
        success: false,
        message: 'Password not set',
        status: 'ic',
        others,
      };

    const ok = await verifyPasswordHash(
      creds.password_hash as string,
      oldPassword,
    );

    if (!ok)
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid credentials',
          status: 'ip',
          others,
        },
        token,
        check.token,
      );

    let safePassword = false;

    try {
      safePassword = await haveIbeenPawned(newPassword);
    } catch (e) {
      console.error(e);
      safePassword = true;
    }

    if (!safePassword)
      return attachNewTokenIfDifferent(
        {
          success: false,
          message:
            'The password has been used before in a data breach. Please choose a different one.',
          status: 'ip',
          others,
        },
        token,
        check.token,
      );

    const hashed = await hashPassword(newPassword);
    await (orm as any).updateMany('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
      set: { password_hash: hashed, password_updated_at: new Date() },
    });

    return attachNewTokenIfDifferent(
      {
        success: true,
        message: 'Password changed',
        status: 'su',
        others,
      },
      token,
      check.token,
    );
  },
};
