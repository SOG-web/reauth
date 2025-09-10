import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { EmailPasswordConfigV2 } from '../types';
import { genCode } from '../utils';

export type SendResetInput = { email: string; others?: Record<string, any> };
export const sendResetValidation = type({
  email: 'string.email',
  others: 'object?',
});

export const sendResetStep: AuthStepV2<
  SendResetInput,
  AuthOutput,
  EmailPasswordConfigV2
> = {
  name: 'send-reset-password',
  description: 'Send reset password code to email',
  validationSchema: sendResetValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { ev: 400, su: 200, unf: 401 },
      auth: false,
    },
  },
  inputs: ['email', 'others'],
  outputs: type({ success: 'boolean', message: 'string', status: 'string' }),
  async run(input, ctx) {
    const { email, others } = input;

    if (!ctx.config.sendCode) {
      throw new Error(
        'email verification is on but no sendCode function provider. Please check the email-password plugin config option',
      );
    }

    const orm = await ctx.engine.getOrm();

    const identity = (await orm.findFirst('identities', {
      where: (b: any) =>
        b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
    })) as { id: string; subject_id: string; verified: boolean } | null;

    if (!identity)
      return {
        success: false,
        message: 'User not found',
        status: 'unf',
        others,
      };

    if (!identity.verified && !(ctx.config?.verifyEmail ?? false)) {
      return {
        success: false,
        message: 'Email not verified',
        status: 'ev',
        others,
      };
    }

    const code = ctx.config?.generateCode
      ? await ctx.config.generateCode(email)
      : genCode(ctx.config);

    const ms = ctx.config?.resetPasswordCodeExpiresIn ?? 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms);

    await orm.upsert('email_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      create: {
        identity_id: identity.id,
        reset_code: code,
        reset_code_expires_at: expiresAt,
      },
      update: { reset_code: code, reset_code_expires_at: expiresAt },
    });

    await ctx.config.sendCode(
      { id: identity.subject_id },
      code,
      email,
      'reset',
    );

    return { success: true, message: 'Reset code sent', status: 'su', others };
  },
};
