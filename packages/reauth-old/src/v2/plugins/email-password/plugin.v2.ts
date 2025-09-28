import type { AuthPlugin, OrmLike } from '../../types.';
import type { EmailPasswordConfig } from './types';
export type { EmailPasswordConfig } from './types';
import { loginStep } from './steps/login.step';
import { registerStep } from './steps/register.step';
import { verifyEmailStep } from './steps/verify-email.step';
import { resendVerificationStep } from './steps/resend-verify-email.step';
import { sendResetStep } from './steps/send-reset-password.step';
import { resetPasswordStep } from './steps/reset-password.step';
import { changePasswordStep } from './steps/change-password.step';
import { changeEmailStep } from './steps/change-email.step';
import { createAuthPlugin } from '../../utils/create-plugin.';
import { cleanupExpiredCodes } from './utils';

// Config type moved to ./types

// Steps are imported from ./steps/*.step.ts

export const baseEmailPasswordPlugin: AuthPlugin<EmailPasswordConfig> = {
  name: 'email-password',
  initialize(engine) {
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as
          | import('../../types.').Subject
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
        pluginName: 'email-password',
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
    verifyEmail: false,
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
    verifyEmailStep,
    resendVerificationStep,
    sendResetStep,
    resetPasswordStep,
    changePasswordStep,
    changeEmailStep,
  ],
  async getProfile(subjectId, ctx) {
    const orm = ctx.orm;
    // Gather email identities for the subject
    const emailIdentities = await orm.findMany('identities', {
      where: (b: any) =>
        b.and(b('subject_id', '=', subjectId), b('provider', '=', 'email')),
      orderBy: [['created_at', 'desc']],
    });

    const emails: Array<{
      email: string;
      verified: boolean;
      pendingVerification?: boolean;
      created_at?: string;
      updated_at?: string;
    }> = [];

    for (const ident of emailIdentities || []) {
      // Look up email-specific details without exposing codes
      const ei = await orm.findFirst('email_identities', {
        where: (b: any) => b('identity_id', '=', ident.id),
      });

      const createdAtRaw = (ident as any)?.created_at;
      const updatedAtRaw = (ident as any)?.updated_at;
      const createdAt = createdAtRaw
        ? createdAtRaw instanceof Date
          ? createdAtRaw.toISOString()
          : new Date(String(createdAtRaw)).toISOString()
        : undefined;
      const updatedAt = updatedAtRaw
        ? updatedAtRaw instanceof Date
          ? updatedAtRaw.toISOString()
          : new Date(String(updatedAtRaw)).toISOString()
        : undefined;

      const vraw = (ei as any)?.verification_code_expires_at;
      const pendingVerification = vraw
        ? new Date(String(vraw)) > new Date()
        : false;

      emails.push({
        email: String(ident.identifier),
        verified: Boolean(ident.verified),
        pendingVerification,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    }

    // Whether password is set
    const creds = await orm.findFirst('credentials', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    return {
      emails,
      password: { set: Boolean(creds?.password_hash) },
    };
  },
  // Background cleanup now handles expired code removal via SimpleCleanupScheduler
};

// Export a configured plugin creator that validates config at construction time.
const emailPasswordPlugin: AuthPlugin<EmailPasswordConfig> =
  createAuthPlugin<EmailPasswordConfig>(baseEmailPasswordPlugin, {
    validateConfig: (config) => {
      const errs: string[] = [];
      if (
        config.verifyEmail &&
        typeof (config as any).sendCode !== 'function'
      ) {
        errs.push(
          "verifyEmail is true but 'sendCode' is not provided. Supply sendCode(subject, code, email, type) in plugin config.",
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

export default emailPasswordPlugin;
