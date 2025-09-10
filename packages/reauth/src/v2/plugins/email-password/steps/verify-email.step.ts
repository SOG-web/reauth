import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { EmailPasswordConfigV2 } from '../types';

export type VerifyEmailInput = {
  email: string;
  code: string;
  others?: Record<string, any>;
};
export const verifyEmailValidation = type({
  email: 'string.email',
  code: 'string',
  others: 'object?',
});

export const verifyEmailStep: AuthStepV2<
  VerifyEmailInput,
  AuthOutput,
  EmailPasswordConfigV2
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
  outputs: type({ success: 'boolean', message: 'string', status: 'string' }),
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

    const meta = (await orm.findFirst('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
    })) as { verification_code?: string | null } | null;

    if (!meta || !meta.verification_code)
      return {
        success: false,
        message: 'No verification pending',
        status: 'ic',
        others,
      };

    if (String(meta.verification_code) !== String(code))
      return { success: false, message: 'Invalid code', status: 'ip', others };

    await (orm as any).updateMany('identities', {
      where: (b: any) => b('id', '=', identity.id),
      set: { verified: true },
    });

    await (orm as any).updateMany('email_identities', {
      where: (b: any) => b('identity_id', '=', identity.id),
      set: { verification_code: null },
    });

    return { success: true, message: 'Email verified', status: 'su', others };
  },
};
