import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { EmailPasswordConfig } from '../types';
import {
  verifyPasswordHash,
  hashPassword,
  haveIbeenPawned,
} from '../../../../lib/password';
import { passwordSchema } from '../../../../plugins/shared/validation';

export type ChangePasswordInput = {
  token: string;
  oldPassword: string;
  newPassword: string;
  others?: Record<string, any>;
};
export const changePasswordValidation = type({
  token: 'string',
  oldPassword: passwordSchema,
  newPassword: passwordSchema,
  others: 'object?',
});

export const changePasswordStep: AuthStep<
  ChangePasswordInput,
  AuthOutput,
  EmailPasswordConfig
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
      return {
        success: false,
        message: 'Invalid credentials',
        status: 'ip',
        others,
      };

    const safePassword = await haveIbeenPawned(newPassword);

    if (!safePassword)
      return {
        success: false,
        message:
          'The password has been used before in a data breach. Please choose a different one.',
        status: 'ip',
        others,
      };

    const hashed = await hashPassword(newPassword);
    await (orm as any).updateMany('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
      set: { password_hash: hashed, password_updated_at: new Date() },
    });

    return { success: true, message: 'Password changed', status: 'su', others };
  },
};
