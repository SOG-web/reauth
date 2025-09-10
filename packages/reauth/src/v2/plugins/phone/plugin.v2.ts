import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { PhonePasswordConfigV2 } from './types';
export type { PhonePasswordConfigV2 } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { verifyPhoneStep } from './steps/verify-phone.step';
import { resendVerifyPhoneStep } from './steps/resend-verify-phone.step';
import { sendResetPasswordStep } from './steps/send-reset-password.step';
import { resetPasswordStep } from './steps/reset-password.step';
import { changePasswordStep } from './steps/change-password.step';
import { changePhoneStep } from './steps/change-phone.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

export const basePhonePasswordPluginV2: AuthPluginV2<PhonePasswordConfigV2> = {
  name: 'phone-password',
  initialize(engine) {
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as
          | import('../../types.v2').Subject
          | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });
  },
  config: {
    verifyPhone: false,
    loginOnRegister: true,
    sessionTtlSeconds: 3600,
    codeType: 'numeric',
    codeLength: 4,
    verificationCodeExpiresIn: 30 * 60 * 1000,
    resetPasswordCodeExpiresIn: 30 * 60 * 1000,
  },
  steps: [
    loginStep,
    registerStep,
    verifyPhoneStep,
    resendVerifyPhoneStep,
    sendResetPasswordStep,
    resetPasswordStep,
    changePasswordStep,
    changePhoneStep,
  ],
  rootHooks: {
    // Opportunistic cleanup for expired codes (acts as a soft TTL). This avoids DB-specific TTL features.
    async before(_input, ctx) {
      try {
        const orm = await ctx.engine.getOrm();
        const now = new Date();
        // Remove expired verification codes
        await orm.deleteMany('phone_identities', {
          where: (b: any) =>
            b.and(
              b('verification_code_expires_at', '!=', null),
              b('verification_code_expires_at', '<', now),
            ),
        });
        // Remove expired reset codes
        await orm.deleteMany('phone_identities', {
          where: (b: any) =>
            b.and(
              b('reset_code_expires_at', '!=', null),
              b('reset_code_expires_at', '<', now),
            ),
        });
      } catch (_) {
        // Best effort cleanup; never block auth flows
      }
    },
  },
};

// Export a configured plugin creator that validates config at construction time.
const phonePasswordPluginV2: AuthPluginV2<PhonePasswordConfigV2> = createAuthPluginV2<PhonePasswordConfigV2>(
  basePhonePasswordPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      if (config.verifyPhone && typeof (config as any).sendCode !== 'function') {
        errs.push(
          "verifyPhone is true but 'sendCode' is not provided. Supply sendCode(subject, code, phone, type) in plugin config.",
        );
      }
      return errs.length ? errs : null;
    },
  },
);

export default phonePasswordPluginV2;