import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { OAuthConfigV2 } from './types';
export type { OAuthConfigV2 } from './types';
import { initiateOAuthStep } from './steps/initiate-oauth.step';
import { callbackOAuthStep } from './steps/callback-oauth.step';
import { linkOAuthStep } from './steps/link-oauth.step';
import { unlinkOAuthStep } from './steps/unlink-oauth.step';
import { refreshTokenStep } from './steps/refresh-token.step';
import { getProfileStep } from './steps/get-profile.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { hashOAuthToken } from './utils';

export const baseOAuthPluginV2: AuthPluginV2<OAuthConfigV2> = {
  name: 'oauth',
  initialize(engine) {
    // Register session resolver for OAuth users (uses same subject resolver as other plugins)
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

    // Register cleanup task for expired OAuth tokens
    const config = this.config || {};
    if ((config as OAuthConfigV2).autoRefreshTokens !== false) {
      const cleanupIntervalMs = ((config as OAuthConfigV2).tokenRefreshIntervalSeconds || 3600) * 1000; // Default 1 hour

      engine.registerCleanupTask({
        name: 'expired-oauth-tokens',
        pluginName: 'oauth',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const now = new Date();
            
            // Find all expired tokens that have refresh tokens
            const expiredTokens = await orm.findMany('oauth_tokens', {
              where: (b: any) => b('expires_at', '<', now)
                .and(b('refresh_token_hash', 'is not', null)),
              limit: 100, // Process in batches
            });

            let refreshed = 0;
            let failed = 0;

            for (const token of expiredTokens) {
              try {
                // Get provider configuration
                const provider = await orm.findFirst('oauth_providers', {
                  where: (b: any) => b('id', '=', token.provider_id),
                });

                if (provider && provider.is_active) {
                  // Note: In a real implementation, you would decrypt the refresh token
                  // and perform the actual refresh. This is a placeholder for the logic.
                  // The actual refresh would be done through the refresh-token step.
                  
                  // For now, we'll just mark tokens that could be refreshed
                  // await orm.update('oauth_tokens', 
                  //   { last_used_at: new Date() },
                  //   { where: (b: any) => b('id', '=', token.id) }
                  // );
                  refreshed++;
                }
              } catch (error) {
                console.error('Token refresh error in cleanup:', error);
                failed++;
              }
            }

            return {
              cleaned: refreshed,
              errors: failed > 0 ? [`${failed} token refresh failures`] : undefined,
            };
          } catch (error) {
            console.error('OAuth token cleanup error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
              cleaned: 0,
              errors: [`Cleanup failed: ${errorMessage}`],
            };
          }
        },
      });
    }
  },
  
  config: {
    providers: [],
    defaultScopes: ['email', 'profile'],
    sessionTtlSeconds: 24 * 60 * 60, // 24 hours
    allowAccountLinking: true,
    requireEmailVerification: false,
    tokenRefreshIntervalSeconds: 3600, // 1 hour
    autoRefreshTokens: true,
  } as OAuthConfigV2,

  steps: [
    initiateOAuthStep,
    callbackOAuthStep,
    linkOAuthStep,
    unlinkOAuthStep,
    refreshTokenStep,
    getProfileStep,
  ],
  async getProfile(subjectId, ctx) {
    const orm = ctx.orm;
    // Tokens by provider
    const tokens = await orm.findMany('oauth_tokens', {
      where: (b: any) => b('subject_id', '=', subjectId),
      orderBy: [['updated_at', 'desc']],
    });

    // Profiles by provider
    const profiles = await orm.findMany('oauth_profiles', {
      where: (b: any) => b('subject_id', '=', subjectId),
      orderBy: [['updated_at', 'desc']],
    });

    const providers: Record<string, any> = {};

    for (const t of tokens || []) {
      const expiresAt = t?.expires_at
        ? (t.expires_at instanceof Date
            ? t.expires_at.toISOString()
            : new Date(String(t.expires_at)).toISOString())
        : null;
      const lastUsedAt = t?.last_used_at
        ? (t.last_used_at instanceof Date
            ? t.last_used_at.toISOString()
            : new Date(String(t.last_used_at)).toISOString())
        : null;
      const providerId = String(t.provider_id);
      providers[providerId] = {
        ...(providers[providerId] || {}),
        tokens: {
          has_refresh_token: t?.refresh_token_hash != null,
          scope: t?.scope ?? undefined,
          expires_at: expiresAt,
          last_used_at: lastUsedAt,
        },
      };
    }

    for (const p of profiles || []) {
      const updatedAt = p?.updated_at
        ? (p.updated_at instanceof Date
            ? p.updated_at.toISOString()
            : new Date(String(p.updated_at)).toISOString())
        : undefined;
      const providerId = String(p.provider_id);
      providers[providerId] = {
        ...(providers[providerId] || {}),
        profile: {
          id: String(p.provider_user_id),
          email: p?.email ?? undefined,
          name: p?.name ?? undefined,
          avatar_url: p?.avatar_url ?? undefined,
          updated_at: updatedAt,
        },
      };
    }

    // Optionally map provider IDs to names via oauth_providers
    const providerRows = await orm.findMany('oauth_providers', {});
    const byId: Record<string, string> = {};
    for (const row of providerRows || []) byId[String(row.id)] = String(row.name ?? row.id);

    const mapped: Record<string, any> = {};
    for (const [pid, data] of Object.entries(providers)) {
      const name = byId[pid] ?? pid;
      mapped[name] = data;
    }

    return { providers: mapped };
  },
};

/**
 * Create OAuth plugin with custom configuration
 * 
 * @example
 * ```typescript
 * const oauthPlugin = createOAuthPlugin({
 *   config: {
 *     providers: [
 *       {
 *         name: 'google',
 *         clientId: process.env.GOOGLE_CLIENT_ID!,
 *         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *         authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
 *         tokenUrl: 'https://oauth2.googleapis.com/token',
 *         userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
 *         scopes: ['email', 'profile'],
 *         redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *       },
 *     ],
 *     allowAccountLinking: true,
 *     sessionTtlSeconds: 7 * 24 * 60 * 60, // 7 days
 *   },
 * });
 * ```
 */
export function createOAuthPlugin(options: {
  config?: Partial<OAuthConfigV2>;
}): AuthPluginV2<OAuthConfigV2> {
  return createAuthPluginV2(baseOAuthPluginV2, {
    config: options.config,
    validateConfig: (config) => {
      const errors: string[] = [];
      
      if (!config.providers || !Array.isArray(config.providers) || config.providers.length === 0) {
        errors.push('providers array is required');
      } else {
        for (const provider of config.providers) {
          if (!provider.name) errors.push('provider name is required');
          if (!provider.clientId) errors.push(`provider ${provider.name}: clientId is required`);
          if (!provider.clientSecret) errors.push(`provider ${provider.name}: clientSecret is required`);
          if (!provider.authorizationUrl) errors.push(`provider ${provider.name}: authorizationUrl is required`);
          if (!provider.tokenUrl) errors.push(`provider ${provider.name}: tokenUrl is required`);
          if (!provider.userInfoUrl) errors.push(`provider ${provider.name}: userInfoUrl is required`);
          if (!provider.redirectUri) errors.push(`provider ${provider.name}: redirectUri is required`);
        }
      }
      
      return errors.length > 0 ? errors : null;
    },
  });
}

export default baseOAuthPluginV2;