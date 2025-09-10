import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { EmailPasswordConfigV2 } from './types';
export type { EmailPasswordConfigV2 } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { verifyEmailStep } from './steps/verify-email.step';
import { resendVerificationStep } from './steps/resend-verify-email.step';
import { sendResetStep } from './steps/send-reset-password.step';
import { resetPasswordStep } from './steps/reset-password.step';
import { changePasswordStep } from './steps/change-password.step';

// Config type moved to ./types

// Steps are imported from ./steps/*.step.ts

export const emailPasswordPluginV2: AuthPluginV2<EmailPasswordConfigV2> = {
  name: 'email-password',
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
    verifyEmail: false,
    loginOnRegister: true,
    sessionTtlSeconds: 3600,
    codeType: 'numeric',
    codeLenght: 4,
    resetPasswordCodeExpiresIn: 30 * 60 * 1000,
  },
  steps: [
    loginStep,
    registerStep,
    verifyEmailStep,
    resendVerificationStep,
    sendResetStep,
    resetPasswordStep,
    changePasswordStep,
  ],
};

export default emailPasswordPluginV2;
