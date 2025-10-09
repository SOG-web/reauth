import type { AuthPlugin, AuthStep, OrmLike, Subject } from '../../types';
import type { PhonePasswordConfig } from './types';
export type { PhonePasswordConfig } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { verifyPhoneStep } from './steps/verify-phone.step';
import { resendVerifyPhoneStep } from './steps/resend-verify-phone.step';
import { sendResetPasswordStep } from './steps/send-reset-password.step';
import { resetPasswordStep } from './steps/reset-password.step';
import { changePasswordStep } from './steps/change-password.step';
import { changePhoneStep } from './steps/change-phone.step';
import { linkAccountStep } from './steps/link-account.step';
import { createAuthPlugin } from '../../utils/create-plugin';
import { cleanupExpiredCodes } from './utils';

export const basePhonePasswordPlugin = {
  name: 'phone-password',
  initialize(engine) {
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as Subject | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });

    // Register background cleanup task for expired codes
    const config = this.config || {};

    const cleanupIntervalMs = (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

    engine.registerCleanupTask({
      name: 'expired-codes',
      pluginName: 'phone-password',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const result = await cleanupExpiredCodes(orm);
          return {
            cleaned: result.verificationCodesDeleted + result.resetCodesDeleted,
            verificationCodesDeleted: result.verificationCodesDeleted,
            resetCodesDeleted: result.resetCodesDeleted,
          };
        } catch (error) {
          return {
            cleaned: 0,
            verificationCodesDeleted: 0,
            resetCodesDeleted: 0,
            errors: [
              `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
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
    cleanupIntervalMinutes: 60, // 1 hour
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
    linkAccountStep,
  ],
  async getProfile(subjectId, ctx) {
    const orm = await ctx.engine.getOrm();
    // Phone identities for this subject
    const phoneIdentities = await orm.findMany('identities', {
      where: (b: any) =>
        b.and(b('subject_id', '=', subjectId), b('provider', '=', 'phone')),
      orderBy: [['created_at', 'desc']],
    });

    const phones: Array<{
      phone: string;
      verified: boolean;
      pendingVerification?: boolean;
      created_at?: string;
      updated_at?: string;
    }> = [];

    for (const ident of phoneIdentities || []) {
      const pi = await orm.findFirst('phone_identities', {
        where: (b: any) => b('identity_id', '=', ident.id),
      });

      const createdAtRaw = (ident as any)?.created_at;
      const updatedAtRaw = (ident as any)?.updated_at;
      const created_at = createdAtRaw
        ? createdAtRaw instanceof Date
          ? createdAtRaw.toISOString()
          : new Date(String(createdAtRaw)).toISOString()
        : undefined;
      const updated_at = updatedAtRaw
        ? updatedAtRaw instanceof Date
          ? updatedAtRaw.toISOString()
          : new Date(String(updatedAtRaw)).toISOString()
        : undefined;

      const vraw = (pi as any)?.verification_code_expires_at;
      const pendingVerification = vraw
        ? new Date(String(vraw)) > new Date()
        : false;

      phones.push({
        phone: String(ident.identifier),
        verified: Boolean(ident.verified),
        pendingVerification,
        created_at,
        updated_at,
      });
    }

    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    return {
      phones,
      password: { set: Boolean(creds?.password_hash) },
    };
  },
  // Background cleanup now handles expired code removal via SimpleCleanupScheduler
} satisfies AuthPlugin<PhonePasswordConfig, 'phone-password'>;

// Export a factory function that creates a configured plugin
const phonePasswordPlugin = (
  config: Partial<PhonePasswordConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<PhonePasswordConfig>>;
  }>,
) => {
  const pl = createAuthPlugin<
    PhonePasswordConfig,
    'phone-password',
    typeof basePhonePasswordPlugin
  >(basePhonePasswordPlugin, {
    config,
    stepOverrides: overrideStep,
    validateConfig: (config) => {
      const errs: string[] = [];
      if (
        config.verifyPhone &&
        typeof (config as any).sendCode !== 'function'
      ) {
        errs.push(
          "verifyPhone is true but 'sendCode' is not provided. Supply sendCode(subject, code, phone, type) in plugin config.",
        );
      }

      // Validate cleanup configuration
      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes < 1) {
        errs.push('cleanupIntervalMinutes must be at least 1 minute');
      }

      if (
        config.cleanupIntervalMinutes &&
        config.cleanupIntervalMinutes > 1440
      ) {
        errs.push(
          'cleanupIntervalMinutes cannot exceed 1440 minutes (24 hours)',
        );
      }

      return errs.length ? errs : null;
    },
    rootHooks: config.rootHooks,
  }) satisfies typeof basePhonePasswordPlugin;

  return pl;
};

export default phonePasswordPlugin;
