import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types.';
import type { EmailPasswordConfig } from '../types';
import { genCode } from '../utils';
import { hashPassword } from '../../../../lib/password';

export type ResendVerificationInput = {
  email: string;
  others?: Record<string, any>;
};
export const resendVerificationValidation = type({
  email: 'string.email',
  others: 'object?',
});

export const resendVerificationStep: AuthStep<
  ResendVerificationInput,
  AuthOutput,
  EmailPasswordConfig
> = {
  name: 'resend-verify-email',
  description: 'Resend verification code to email',
  validationSchema: resendVerificationValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { nc: 400, su: 200, unf: 401 },
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
        success: false,
        message: 'User not found',
        status: 'unf',
        others,
      };

    if (identity.verified)
      return {
        success: true,
        message: 'Already verified',
        status: 'su',
        others,
      };

    const code = ctx.config?.generateCode
      ? await ctx.config.generateCode(email)
      : genCode(ctx.config);
    const hashedCode = await hashPassword(String(code));
    const ms = ctx.config?.verificationCodeExpiresIn ?? 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms);

    await orm.upsert('email_identities', {
      where: (b) => b('identity_id', '=', identity.id),
      create: {
        identity_id: identity.id,
        verification_code: hashedCode,
        verification_code_expires_at: expiresAt,
      },
      update: {
        verification_code: hashedCode,
        verification_code_expires_at: expiresAt,
      },
    });

    await ctx.config.sendCode(
      { id: identity.subject_id },
      code,
      email,
      'verify',
    );

    return {
      success: true,
      message: 'Verification code sent',
      status: 'su',
      others,
    };
  },
};
