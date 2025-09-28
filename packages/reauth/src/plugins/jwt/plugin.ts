import type { AuthPlugin, OrmLike } from '../../types';
import type { JWTPluginConfig } from '../../jwt.types';
import { createAuthPlugin } from '../../utils/create-plugin';
import { jwtSchema } from '../../jwt.schema';

// JWT Plugin Steps
import { createJWTTokenStep } from './steps/create-jwt-token.step';
import { verifyJWTTokenStep } from './steps/verify-jwt-token.step';
import { blacklistJWTTokenStep } from './steps/blacklist-jwt-token.step';
import { getJWKSStep } from './steps/get-jwks.step';
import { createTokenPairStep } from './steps/create-token-pair.step';
import { refreshAccessTokenStep } from './steps/refresh-access-token.step';
import { revokeRefreshTokenStep } from './steps/revoke-refresh-token.step';
import { revokeAllRefreshTokensStep } from './steps/revoke-all-refresh-tokens.step';

export const baseJWTPlugin: AuthPlugin<JWTPluginConfig> = {
  name: 'jwt',
  initialize(engine) {
    // Enable JWT features in the session service
    const sessionService = engine.getSessionService() as any;
    if (sessionService.enableJWTFeatures) {
      sessionService.enableJWTFeatures(
        this.config.issuer,
        this.config.keyRotationIntervalDays,
        this.config.keyGracePeriodDays,
        this.config.defaultAccessTokenTtlSeconds,
        this.config.defaultRefreshTokenTtlSeconds,
        this.config.enableRefreshTokenRotation,
      );
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
          const sessionService = engine.getSessionService() as any;
          if (sessionService.jwtService) {
            const cleaned = await sessionService.jwtService.cleanupExpiredKeys();
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
            const sessionService = engine.getSessionService() as any;
            if (sessionService.jwtService) {
              const cleaned = await sessionService.jwtService.cleanupBlacklistedTokens();
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
          const sessionService = engine.getSessionService() as any;
          if (sessionService.jwtService) {
            const cleaned = await sessionService.jwtService.cleanupExpiredRefreshTokens();
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
  steps: [
    createJWTTokenStep,
    verifyJWTTokenStep,
    blacklistJWTTokenStep,
    getJWKSStep,
    createTokenPairStep,
    refreshAccessTokenStep,
    revokeRefreshTokenStep,
    revokeAllRefreshTokensStep,
  ],
  async getProfile(subjectId, ctx) {
    const sessionService = ctx.engine.getSessionService() as any;
    
    // Get JWT-related information for the subject
    const profile: any = {
      jwt_enabled: !!sessionService.jwtService,
    };

    if (sessionService.jwtService) {
      try {
        // Get JWKS information
        const jwks = await sessionService.jwtService.getPublicJWKS();
        profile.active_keys = jwks.keys.length;
      } catch (error) {
        profile.jwt_error = error instanceof Error ? error.message : String(error);
      }
    }

    return profile;
  },
};

// Export a configured plugin creator that validates config at construction time
const jwtPlugin: AuthPlugin<JWTPluginConfig> = createAuthPlugin<JWTPluginConfig>(
  baseJWTPlugin,
  {
    validateConfig: (config) => {
      const errs: string[] = [];

      if (!config.issuer || config.issuer.trim().length === 0) {
        errs.push('issuer is required and cannot be empty');
      }

      if (config.defaultAccessTokenTtlSeconds && config.defaultAccessTokenTtlSeconds < 60) {
        errs.push('defaultAccessTokenTtlSeconds must be at least 60 seconds');
      }

      if (config.defaultRefreshTokenTtlSeconds && config.defaultRefreshTokenTtlSeconds < 3600) {
        errs.push('defaultRefreshTokenTtlSeconds must be at least 1 hour (3600 seconds)');
      }

      if (config.keyRotationIntervalDays && config.keyRotationIntervalDays < 1) {
        errs.push('keyRotationIntervalDays must be at least 1 day');
      }

      if (config.keyGracePeriodDays && config.keyGracePeriodDays < 0) {
        errs.push('keyGracePeriodDays cannot be negative');
      }

      if (config.cleanupIntervalMinutes && config.cleanupIntervalMinutes < 1) {
        errs.push('cleanupIntervalMinutes must be at least 1 minute');
      }

      return errs.length ? errs : null;
    },
    extendSchema: () => jwtSchema,
  },
);

export default jwtPlugin;
export type { JWTPluginConfig } from '../../jwt.types';
export { jwtSchema } from '../../jwt.schema';