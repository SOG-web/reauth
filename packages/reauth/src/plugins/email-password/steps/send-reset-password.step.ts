import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { EmailPasswordConfig } from '../types';
import { genCode } from '../utils';
import { hashPassword } from '../../../lib/password';

export type SendResetInput = { email: string; others?: Record<string, any> };
export const sendResetValidation = type({
  email: 'string.email',
  others: 'object?',
});

export const sendResetStep: AuthStep<
  EmailPasswordConfig,
  SendResetInput,
  AuthOutput
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
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'others?': 'object',
  }),
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
        success: true,
        message: 'If the account exists, we sent a reset code',
        status: 'su',
        others,
      };

    if (!identity.verified && ctx.config?.verifyEmail) {
      return {
        success: true,
        message: 'Please verify your email first',
        status: 'su',
        others,
      };
    }

    const code = ctx.config?.generateCode
      ? await ctx.config.generateCode(email)
      : genCode(ctx.config);
    const hashedCode = await hashPassword(String(code));

    const ms = ctx.config?.resetPasswordCodeExpiresIn ?? 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms);

    await orm.upsert('email_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      create: {
        identity_id: identity.id,
        reset_code: hashedCode,
        reset_code_expires_at: expiresAt,
      },
      update: { reset_code: hashedCode, reset_code_expires_at: expiresAt },
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
