import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { EmailPasswordConfig } from '../types';
import { passwordSchema } from '../../shared/validation';
import {
  haveIbeenPawned,
  hashPassword,
  verifyPasswordHash,
} from '../../../lib/password';

export type ResetPasswordInput = {
  email: string;
  code: string;
  newPassword: string;
  others?: Record<string, any>;
};
export const resetPasswordValidation = type({
  email: 'string.email',
  code: 'string',
  newPassword: passwordSchema,
  'others?': 'object | undefined',
});

export const resetPasswordStep: AuthStep<
  EmailPasswordConfig,
  ResetPasswordInput,
  AuthOutput
> = {
  name: 'reset-password',
  description: 'Reset password with code',
  validationSchema: resetPasswordValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { ic: 400, ip: 400, su: 200, unf: 401 },
      auth: false,
    },
  },
  inputs: ['email', 'code', 'newPassword', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { email, code, newPassword, others } = input;
    const orm = await ctx.engine.getOrm();

    const identity = (await orm.findFirst('identities', {
      where: (b: any) =>
        b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
    })) as { id: string; subject_id: string } | null;

    if (!identity)
      return {
        success: false,
        message: 'Invalid email or code',
        status: 'ip',
        others,
      };

    const meta = (await orm.findFirst('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
    })) as {
      reset_code?: string | null;
      reset_code_expires_at?: Date | null;
    } | null;

    if (!meta?.reset_code)
      return {
        success: false,
        message: 'Invalid email or code',
        status: 'ip',
        others,
      };

    const validCode = await verifyPasswordHash(
      String(meta.reset_code),
      String(code),
    );
    if (!validCode)
      return {
        success: false,
        message: 'Invalid email or code',
        status: 'ip',
        others,
      };

    if (
      meta.reset_code_expires_at &&
      new Date(meta.reset_code_expires_at).getTime() < Date.now()
    )
      return {
        success: false,
        message: 'Invalid email or code',
        status: 'ip',
        others,
      };

    const safe = await haveIbeenPawned(newPassword);
    if (!safe)
      return {
        success: false,
        message:
          'The password has been used before in a data breach. Please choose a different one.',
        status: 'ip',
        others,
      };

    const hashed = await hashPassword(newPassword);

    await (orm as any).updateMany('credentials', {
      where: (b: any) => b('subject_id', '=', identity.subject_id),
      set: { password_hash: hashed, password_updated_at: new Date() },
    });
    await (orm as any).updateMany('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
      set: { reset_code: null, reset_code_expires_at: null },
    });

    return {
      success: true,
      message: 'Password reset successful',
      status: 'su',
      others,
    };
  },
};
