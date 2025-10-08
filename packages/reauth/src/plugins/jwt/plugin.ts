import type { AuthPlugin, AuthStep, OrmLike } from '../../types';
import { createAuthPlugin } from '../../utils/create-plugin';
import { type JWTPluginConfig } from '../../services';

// JWT Plugin Steps

import { getJWKSStep } from './steps/get-jwks.step';
import { registerClientStep } from './steps/register-client.step';

export const baseJWTPlugin = {
  name: 'jwt',
  initialize(engine) {
    // Enable JWT features in the session service
    const sessionService = engine.getSessionService();
    if (sessionService.enableJWKS) {
      sessionService.enableJWKS({
        issuer: this.config.issuer,
        keyRotationIntervalDays: this.config.keyRotationIntervalDays,
        keyGracePeriodDays: this.config.keyGracePeriodDays,
        defaultAccessTokenTtlSeconds: this.config.defaultAccessTokenTtlSeconds,
        defaultRefreshTokenTtlSeconds:
          this.config.defaultRefreshTokenTtlSeconds,
        enableRefreshTokenRotation: this.config.enableRefreshTokenRotation,
      });
    }

    // Register session resolver for JWT subjects
    engine.registerSessionResolver('subject', {
      async getById(id: string, orm: OrmLike) {
        const subject = await orm.findFirst('subjects', {
          where: (b: any) => b('id', '=', id),
        });
        return (subject ?? null) as unknown as
          | import('../../types').Subject
          | null;
      },
      sanitize(subject: any) {
        return subject; // subjects table has no sensitive fields
      },
    });

    // Register background cleanup tasks
    const config = this.config || {};
    const cleanupIntervalMs = (config.cleanupIntervalMinutes || 60) * 60 * 1000; // Default 1 hour

    // Cleanup task for expired JWKS keys
    engine.registerCleanupTask({
      name: 'expired-jwks-keys',
      pluginName: 'jwt',
      intervalMs: cleanupIntervalMs,
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const sessionService = engine.getSessionService();
          const jwksService = sessionService.getJwkService();
          if (jwksService !== null) {
            const cleaned = await jwksService.cleanupExpiredKeys();
            return {
              cleaned,
              expiredKeysDeleted: cleaned,
            };
          }
          return { cleaned: 0, expiredKeysDeleted: 0 };
        } catch (error) {
          return {
            cleaned: 0,
            expiredKeysDeleted: 0,
            errors: [
              `JWKS cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });

    // Cleanup task for blacklisted tokens (if enabled)
    if (config.enableBlacklist) {
      engine.registerCleanupTask({
        name: 'blacklisted-tokens',
        pluginName: 'jwt',
        intervalMs: cleanupIntervalMs * 2, // Run less frequently
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const sessionService = engine.getSessionService();
            const jwksService = sessionService.getJwkService();
            if (jwksService !== null) {
              const cleaned = await jwksService.cleanupBlacklistedTokens();
              return {
                cleaned,
                blacklistedTokensDeleted: cleaned,
              };
            }
            return { cleaned: 0, blacklistedTokensDeleted: 0 };
          } catch (error) {
            return {
              cleaned: 0,
              blacklistedTokensDeleted: 0,
              errors: [
                `Blacklist cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
              ],
            };
          }
        },
      });
    }

    // Cleanup task for expired refresh tokens
    engine.registerCleanupTask({
      name: 'expired-refresh-tokens',
      pluginName: 'jwt',
      intervalMs: cleanupIntervalMs * 3, // Run less frequently than other cleanups
      enabled: true,
      runner: async (orm, pluginConfig) => {
        try {
          const sessionService = engine.getSessionService();
          const jwksService = sessionService.getJwkService();
          if (jwksService !== null) {
            const cleaned = await jwksService.cleanupExpiredRefreshTokens();
            return {
              cleaned,
              expiredRefreshTokensDeleted: cleaned,
            };
          }
          return { cleaned: 0, expiredRefreshTokensDeleted: 0 };
        } catch (error) {
          return {
            cleaned: 0,
            expiredRefreshTokensDeleted: 0,
            errors: [
              `Refresh token cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
            ],
          };
        }
      },
    });
  },
  config: {
    // Token lifetimes
    defaultAccessTokenTtlSeconds: 900, // 15 minutes
    defaultRefreshTokenTtlSeconds: 30 * 24 * 60 * 60, // 30 days

    // Key management
    keyRotationIntervalDays: 10,
    keyGracePeriodDays: 2,

    // Security
    enableBlacklist: true,
    enableRefreshTokenRotation: true,

    // Cleanup
    cleanupIntervalMinutes: 60, // 1 hour

    // Plugin-specific settings
    enableLegacyTokenSupport: true,
    issuer: 'reauth',
  },
  steps: [getJWKSStep, registerClientStep],
  async getProfile(subjectId, ctx) {
    const sessionService = ctx.engine.getSessionService();
    const jwksService = sessionService.getJwkService();

    // Get JWT-related information for the subject
    const profile: any = {
      jwt_enabled: !!jwksService,
    };

    if (jwksService) {
      try {
        // Get JWKS information
        const jwks = await jwksService.getPublicJWKS();
        profile.active_keys = jwks.keys.length;
      } catch (error) {
        profile.jwt_error =
          error instanceof Error ? error.message : String(error);
      }
    }

    return profile;
  },
} satisfies AuthPlugin<JWTPluginConfig, 'jwt'>;

// Export a factory function that creates a configured plugin
const jwtPlugin = (
  config: Partial<JWTPluginConfig>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<JWTPluginConfig>>;
  }>,
) => {
  const pl = createAuthPlugin<JWTPluginConfig, 'jwt', typeof baseJWTPlugin>(
    baseJWTPlugin,
    {
      config,
      stepOverrides: overrideStep,
      validateConfig: (config) => {
        const errs: string[] = [];

        if (!config.issuer || config.issuer.trim().length === 0) {
          errs.push('issuer is required and cannot be empty');
        }

        if (
          config.defaultAccessTokenTtlSeconds &&
          config.defaultAccessTokenTtlSeconds < 60
        ) {
          errs.push('defaultAccessTokenTtlSeconds must be at least 60 seconds');
        }

        if (
          config.defaultRefreshTokenTtlSeconds &&
          config.defaultRefreshTokenTtlSeconds < 3600
        ) {
          errs.push(
            'defaultRefreshTokenTtlSeconds must be at least 1 hour (3600 seconds)',
          );
        }

        if (
          config.keyRotationIntervalDays &&
          config.keyRotationIntervalDays < 1
        ) {
          errs.push('keyRotationIntervalDays must be at least 1 day');
        }

        if (config.keyGracePeriodDays && config.keyGracePeriodDays < 0) {
          errs.push('keyGracePeriodDays cannot be negative');
        }

        if (
          config.cleanupIntervalMinutes &&
          config.cleanupIntervalMinutes < 1
        ) {
          errs.push('cleanupIntervalMinutes must be at least 1 minute');
        }

        return errs.length ? errs : null;
      },
      rootHooks: config.rootHooks,
    },
  ) satisfies typeof baseJWTPlugin;

  return pl;
};

export default jwtPlugin;
