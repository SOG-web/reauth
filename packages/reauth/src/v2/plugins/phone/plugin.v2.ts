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
import { cleanupExpiredCodes } from './utils';

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

    // Register background cleanup task for expired codes
    const config = this.config || {};
    if (config.cleanupEnabled !== false) {
      const cleanupIntervalMs =
        (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

      engine.registerCleanupTask({
        name: 'expired-codes',
        pluginName: 'phone-password',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredCodes(orm, pluginConfig);
            return {
              cleaned:
                result.verificationCodesDeleted + result.resetCodesDeleted,
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
    }
  },
  config: {
    verifyPhone: false,
    loginOnRegister: true,
    sessionTtlSeconds: 3600,
    codeType: 'numeric',
    codeLength: 4,
    verificationCodeExpiresIn: 30 * 60 * 1000,
    resetPasswordCodeExpiresIn: 30 * 60 * 1000,
    cleanupEnabled: true,
    cleanupIntervalMinutes: 60, // 1 hour
    retentionDays: 1,
    cleanupBatchSize: 100,
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
  async getProfile(subjectId, ctx) {
    const orm = ctx.orm;
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
        ? (createdAtRaw instanceof Date
            ? createdAtRaw.toISOString()
            : new Date(String(createdAtRaw)).toISOString())
        : undefined;
      const updated_at = updatedAtRaw
        ? (updatedAtRaw instanceof Date
            ? updatedAtRaw.toISOString()
            : new Date(String(updatedAtRaw)).toISOString())
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
};

// Export a configured plugin creator that validates config at construction time.
const phonePasswordPluginV2: AuthPluginV2<PhonePasswordConfigV2> =
  createAuthPluginV2<PhonePasswordConfigV2>(basePhonePasswordPluginV2, {
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

      if (config.retentionDays && config.retentionDays < 1) {
        errs.push('retentionDays must be at least 1 day');
      }

      if (config.cleanupBatchSize && config.cleanupBatchSize < 1) {
        errs.push('cleanupBatchSize must be at least 1');
      }

      if (config.cleanupBatchSize && config.cleanupBatchSize > 1000) {
        errs.push(
          'cleanupBatchSize cannot exceed 1000 for performance reasons',
        );
      }

      return errs.length ? errs : null;
    },
  });

export default phonePasswordPluginV2;
