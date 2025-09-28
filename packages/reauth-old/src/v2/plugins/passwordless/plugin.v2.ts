import type { AuthPlugin, OrmLike } from '../../types.';
import type { PasswordlessConfig } from './types';
export type { PasswordlessConfig } from './types';
import { sendMagicLinkStep } from './steps/send-magic-link.step';
import { verifyMagicLinkStep } from './steps/verify-magic-link.step';
import { registerWebAuthnStep } from './steps/register-webauthn.step';
import { authenticateWebAuthnStep } from './steps/authenticate-webauthn.step';
import { listCredentialsStep } from './steps/list-credentials.step';
import { revokeCredentialStep } from './steps/revoke-credential.step';
import { createAuthPlugin } from '../../utils/create-plugin.';
import {
  cleanupExpiredMagicLinks,
  cleanupExpiredMagicLinksScheduled,
} from './utils';

export const basePasswordlessPlugin: AuthPlugin<PasswordlessConfig> = {
  name: 'passwordless',
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

    // Register background cleanup task for expired magic links
    const config = this.config || {};
    if (config.cleanupEnabled !== false && config.magicLinks) {
      const cleanupIntervalMs =
        (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

      engine.registerCleanupTask({
        name: 'expired-magic-links',
        pluginName: 'passwordless',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredMagicLinksScheduled(
              orm,
              pluginConfig,
            );
            return {
              cleaned: result.magicLinksDeleted,
              magicLinksDeleted: result.magicLinksDeleted,
            };
          } catch (error) {
            return {
              cleaned: 0,
              magicLinksDeleted: 0,
              errors: [
                `Magic link cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
              ],
            };
          }
        },
      });
    }
  },
  config: {
    sessionTtlSeconds: 3600,
    magicLinkTtlMinutes: 30,
    magicLinks: false,
    webauthn: false,
    cleanupEnabled: true,
    cleanupIntervalMinutes: 60, // 1 hour
    retentionDays: 1,
    cleanupBatchSize: 100,
  } as any, // Default config may not be fully valid, validation happens at creation time
  steps: [
    sendMagicLinkStep,
    verifyMagicLinkStep,
    registerWebAuthnStep,
    authenticateWebAuthnStep,
    listCredentialsStep,
    revokeCredentialStep,
  ],
  async getProfile(subjectId, ctx) {
    const orm = ctx.orm;
    const profile: any = {};

    // WebAuthn credentials
    if (ctx.config?.webauthn) {
      const credentials = await orm.findMany('webauthn_credentials', {
        where: (b: any) => b('subject_id', '=', subjectId),
        orderBy: [['created_at', 'desc']],
      });

      profile.credentials = (credentials || []).map((cred: any) => {
        const createdAt = cred?.created_at
          ? cred.created_at instanceof Date
            ? cred.created_at.toISOString()
            : new Date(String(cred.created_at)).toISOString()
          : undefined;
        const lastUsedAt = cred?.last_used_at
          ? cred.last_used_at instanceof Date
            ? cred.last_used_at.toISOString()
            : new Date(String(cred.last_used_at)).toISOString()
          : undefined;
        const transports: string[] = Array.isArray(cred?.transports)
          ? cred.transports.map((t: any) => String(t))
          : [];
        return {
          id: String(cred.id),
          name: String(cred.name ?? ''),
          created_at: createdAt,
          ...(lastUsedAt ? { last_used_at: lastUsedAt } : {}),
          is_active: Boolean(cred.is_active),
          transports,
        };
      });
    }

    // Active magic links (if enabled)
    if (ctx.config?.magicLinks) {
      const now = new Date();
      const magicLinks = await orm.findMany('magic_links', {
        where: (b: any) =>
          b.and(
            b('subject_id', '=', subjectId),
            b('expires_at', '>', now),
            b('used_at', '=', null),
          ),
        orderBy: [['created_at', 'desc']],
      });

      profile.magic_links = (magicLinks || []).map((link: any) => {
        const createdAt = link?.created_at
          ? link.created_at instanceof Date
            ? link.created_at.toISOString()
            : new Date(String(link.created_at)).toISOString()
          : undefined;
        const expiresAt = link?.expires_at
          ? link.expires_at instanceof Date
            ? link.expires_at.toISOString()
            : new Date(String(link.expires_at)).toISOString()
          : undefined;
        return {
          id: String(link.id),
          email: String(link.email ?? ''),
          created_at: createdAt,
          expires_at: expiresAt,
        };
      });
    }

    return profile;
  },
  // Background cleanup now handles expired magic links via SimpleCleanupScheduler
};

// Export a configured plugin creator that validates config at construction time
const passwordlessPlugin: AuthPlugin<PasswordlessConfig> =
  basePasswordlessPlugin;

// Factory function for creating validated passwordless plugin
export function createPasswordlessPlugin(
  config: PasswordlessConfig,
): AuthPlugin<PasswordlessConfig> {
  return createAuthPlugin<PasswordlessConfig>(basePasswordlessPlugin, {
    config,
    validateConfig: (config) => {
      const errs: string[] = [];

      // At least one authentication method must be enabled
      if (!config.magicLinks && !config.webauthn) {
        errs.push(
          'At least one authentication method must be enabled. Set magicLinks: true or webauthn: true.',
        );
      }

      // Magic links validation
      if (
        config.magicLinks &&
        typeof (config as any).sendMagicLink !== 'function'
      ) {
        errs.push(
          "magicLinks is true but 'sendMagicLink' function is not provided. Supply sendMagicLink(email, token, subject) in plugin config.",
        );
      }

      // WebAuthn validation
      if (config.webauthn) {
        if (!config.rpId || typeof config.rpId !== 'string') {
          errs.push(
            "webauthn is true but 'rpId' is not provided. Supply rpId (Relying Party ID/domain) in plugin config.",
          );
        }
        if (!config.rpName || typeof config.rpName !== 'string') {
          errs.push(
            "webauthn is true but 'rpName' is not provided. Supply rpName (Relying Party Name) in plugin config.",
          );
        }
      }

      // TTL validations
      if (
        config.sessionTtlSeconds &&
        (config.sessionTtlSeconds <= 0 || config.sessionTtlSeconds > 86400 * 30)
      ) {
        errs.push(
          'sessionTtlSeconds must be between 1 and 2,592,000 (30 days)',
        );
      }

      if (
        config.magicLinkTtlMinutes &&
        (config.magicLinkTtlMinutes <= 0 || config.magicLinkTtlMinutes > 1440)
      ) {
        errs.push('magicLinkTtlMinutes must be between 1 and 1440 (24 hours)');
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
}

export default passwordlessPlugin;
