import { type } from 'arktype';
import { verifyPasswordHash } from '../../../lib/password';
import type { AuthStep, AuthOutput } from '../../../types';
import type { EmailPasswordConfig } from '../types';

export type VerifyEmailInput = {
  email: string;
  code: string;
  others?: Record<string, any>;
};
export const verifyEmailValidation = type({
  email: 'string.email',
  code: 'string',
  'others?': 'object | undefined',
});

export const verifyEmailStep: AuthStep<
  EmailPasswordConfig,
  'verify-email',
  VerifyEmailInput,
  AuthOutput
> = {
  name: 'verify-email',
  description: 'Verify email using a verification code',
  validationSchema: verifyEmailValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { ic: 400, su: 200, unf: 401 },
      auth: false,
    },
  },
  inputs: ['email', 'code', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { email, code, others } = input;
    const orm = await ctx.engine.getOrm();

    const identity = (await orm.findFirst('identities', {
      where: (b) =>
        b.and(b('provider', '=', 'email'), b('identifier', '=', email)),
    })) as { id: string; subject_id: string; verified: boolean } | null;

    if (!identity)
      return {
        success: false,
        message: 'Invalid Email or Code',
        status: 'ic',
        others,
      };

    if (identity.verified)
      return {
        success: true,
        message: 'Already verified',
        status: 'su',
        others,
      };

    const meta = (await orm.findFirst('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
    })) as {
      verification_code?: string | null;
      verification_code_expires_at?: Date | null;
    } | null;

    if (!meta || !meta.verification_code)
      return {
        success: false,
        message: 'Invalid Email or Code',
        status: 'ic',
        others,
      };

    if (
      meta.verification_code_expires_at &&
      new Date(meta.verification_code_expires_at).getTime() < Date.now()
    )
      return {
        success: false,
        message: 'Invalid Email or Code',
        status: 'ic',
        others,
      };

    const ok = await verifyPasswordHash(
      String(meta.verification_code),
      String(code),
    );
    if (!ok)
      return {
        success: false,
        message: 'Invalid Email or Code',
        status: 'ic',
        others,
      };

    await (orm as any).updateMany('identities', {
      where: (b: any) => b('id', '=', identity.id),
      set: { verified: true },
    });

    await (orm as any).updateMany('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
      set: { verification_code: null, verification_code_expires_at: null },
    });

    return { success: true, message: 'Email verified', status: 'su', others };
  },
};
