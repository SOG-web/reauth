/**
 * OIDC Provider Plugin V2
 * Complete OpenID Connect Provider implementation for ReAuth V2
 */

import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { OIDCProviderConfigV2 } from './types';
export type { OIDCProviderConfigV2 } from './types';

// Import all steps
import { getDiscoveryDocumentStep } from './steps/get-discovery-document.step';
import { getJwksStep } from './steps/get-jwks.step';
import { beginAuthorizationStep } from './steps/begin-authorization.step';
import { exchangeAuthorizationCodeStep } from './steps/exchange-authorization-code.step';
import { getUserinfoStep } from './steps/get-userinfo.step';
import { registerClientStep } from './steps/register-client.step';
import { revokeTokenStep } from './steps/revoke-token.step';

// Import utilities
import { 
  cleanupExpiredCodes, 
  cleanupExpiredTokens, 
  cleanupRevokedTokens,
  generateSecureRandom 
} from './utils';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

/**
 * Default OIDC Provider Configuration
 */
const defaultConfig: OIDCProviderConfigV2 = {
  issuer: {
    url: 'https://localhost:3000',
    name: 'ReAuth OIDC Provider',
  },
  features: {
    authorizationCodeFlow: true,
    implicitFlow: false,
    hybridFlow: false,
    clientCredentialsFlow: false,
    deviceAuthorizationFlow: false,
    refreshTokens: true,
    pkce: true,
    dynamicClientRegistration: false,
    tokenIntrospection: false,
    tokenRevocation: false,
  },
  tokens: {
    accessTokenTtl: 60, // 1 hour in minutes
    idTokenTtl: 60, // 1 hour in minutes
    refreshTokenTtl: 30, // 30 days
    authorizationCodeTtl: 10, // 10 minutes
    signingAlgorithm: 'RS256',
  },
  keys: {
    signingKey: {
      algorithm: 'RSA',
      keySize: 2048,
      keyId: 'default-signing-key',
    },
    rotationIntervalDays: 30,
  },
  scopes: {
    openid: {
      description: 'OpenID Connect authentication',
      claims: ['sub'],
      required: true,
    },
    profile: {
      description: 'User profile information',
      claims: ['name', 'given_name', 'family_name', 'nickname', 'picture', 'website'],
    },
    email: {
      description: 'User email address',
      claims: ['email', 'email_verified'],
    },
    phone: {
      description: 'User phone number',
      claims: ['phone_number', 'phone_number_verified'],
    },
    offline_access: {
      description: 'Offline access via refresh tokens',
      claims: [],
    },
  },
  claims: {
    sub: {
      description: 'Subject identifier',
      type: 'string',
      source: 'id',
    },
    name: {
      description: 'Full name',
      type: 'string',
      source: 'name',
    },
    given_name: {
      description: 'Given name',
      type: 'string',
      source: 'given_name',
    },
    family_name: {
      description: 'Family name',
      type: 'string',
      source: 'family_name',
    },
    nickname: {
      description: 'Nickname',
      type: 'string',
      source: 'nickname',
    },
    picture: {
      description: 'Profile picture URL',
      type: 'string',
      source: 'picture',
    },
    website: {
      description: 'Website URL',
      type: 'string',
      source: 'website',
    },
    email: {
      description: 'Email address',
      type: 'string',
      source: 'email',
    },
    email_verified: {
      description: 'Email verification status',
      type: 'boolean',
      source: 'email_verified',
    },
    phone_number: {
      description: 'Phone number',
      type: 'string',
      source: 'phone',
    },
    phone_number_verified: {
      description: 'Phone verification status',
      type: 'boolean',
      source: 'phone_verified',
    },
  },
  clientDefaults: {
    tokenEndpointAuthMethod: 'client_secret_basic',
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    redirectUris: [],
    postLogoutRedirectUris: [],
    defaultScopes: ['openid'],
  },
  security: {
    requirePkce: true,
    allowInsecureRedirectUris: false,
    maxAuthorizationAge: 300, // 5 minutes
    requireRequestUri: false,
    allowPlaintextPkce: false,
  },
  cleanup: {
    enabled: true,
    intervalMinutes: 60, // 1 hour
    expiredTokenRetentionDays: 7,
    expiredCodeRetentionHours: 1,
    revokedTokenRetentionDays: 30,
  },
};

/**
 * Base OIDC Provider Plugin V2
 */
export const baseOIDCProviderPluginV2: AuthPluginV2<OIDCProviderConfigV2> = {
  name: 'oidc-provider',
  
  initialize(engine) {
    // Register session resolver for OIDC users
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

    // Register cleanup tasks for OIDC provider
    const config = this.config || defaultConfig;
    
    if (config.cleanup?.enabled !== false) {
      const cleanupIntervalMs = (config.cleanup?.intervalMinutes || 60) * 60 * 1000;

      // Cleanup expired authorization codes
      engine.registerCleanupTask({
        name: 'expired-authorization-codes',
        pluginName: 'oidc-provider',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredCodes(orm, pluginConfig);
            return {
              cleaned: result.codesDeleted,
              codesDeleted: result.codesDeleted,
            };
          } catch (error) {
            return {
              cleaned: 0,
              errors: [`Code cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
            };
          }
        },
      });

      // Cleanup expired tokens
      engine.registerCleanupTask({
        name: 'expired-oidc-tokens',
        pluginName: 'oidc-provider',
        intervalMs: cleanupIntervalMs,
        enabled: true,
        runner: async (orm, pluginConfig) => {
          try {
            const result = await cleanupExpiredTokens(orm, pluginConfig);
            return {
              cleaned: result.accessTokensDeleted + result.refreshTokensDeleted + result.idTokensDeleted,
              accessTokensDeleted: result.accessTokensDeleted,
              refreshTokensDeleted: result.refreshTokensDeleted,
              idTokensDeleted: result.idTokensDeleted,
            };
          } catch (error) {
            return {
              cleaned: 0,
              errors: [`Token cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
            };
          }
        },
      });

      // Cleanup old revoked tokens
      if (config.cleanup?.revokedTokenRetentionDays) {
        engine.registerCleanupTask({
          name: 'revoked-oidc-tokens',
          pluginName: 'oidc-provider',
          intervalMs: cleanupIntervalMs * 24, // Daily cleanup for revoked tokens
          enabled: true,
          runner: async (orm, pluginConfig) => {
            try {
              const retentionDays = (pluginConfig as OIDCProviderConfigV2)?.cleanup?.revokedTokenRetentionDays || 30;
              const result = await cleanupRevokedTokens(orm, retentionDays);
              return {
                cleaned: result.revokedTokensDeleted,
                revokedTokensDeleted: result.revokedTokensDeleted,
              };
            } catch (error) {
              return {
                cleaned: 0,
                errors: [`Revoked token cleanup failed: ${error instanceof Error ? error.message : String(error)}`],
              };
            }
          },
        });
      }
    }

    // Initialize cryptographic keys if needed
    // Note: In production, you should generate proper cryptographic keys during setup
    console.log('OIDC Provider initialized. Ensure proper cryptographic keys are configured.');
  },

  config: defaultConfig,

  steps: [
    getDiscoveryDocumentStep,
    getJwksStep,
    beginAuthorizationStep,
    exchangeAuthorizationCodeStep,
    getUserinfoStep,
    registerClientStep,
    revokeTokenStep,
  ],

  // Additional configuration and validation will be handled by createOIDCProviderPlugin
  async getProfile(subjectId, ctx) {
    const orm = ctx.orm;
    // Access tokens
    const access = await orm.findMany('oidc_access_tokens', {
      where: (b: any) => b('user_id', '=', subjectId),
      orderBy: [['created_at', 'desc']],
      limit: 10,
    });
    const access_tokens = (access || []).map((t: any) => ({
      id: String(t.id ?? ''),
      client_id: String(t.client_id ?? ''),
      scopes: typeof t.scopes === 'string' ? safeParseScopes(t.scopes) : [],
      token_type: String(t.token_type ?? 'Bearer'),
      created_at: toIso(t.created_at),
      expires_at: toIso(t.expires_at),
      revoked_at: toIso(t.revoked_at),
    }));

    // Refresh tokens
    const refresh = await orm.findMany('oidc_refresh_tokens', {
      where: (b: any) => b('user_id', '=', subjectId),
      orderBy: [['created_at', 'desc']],
      limit: 10,
    });
    const refresh_tokens = (refresh || []).map((t: any) => ({
      id: String(t.id ?? ''),
      client_id: String(t.client_id ?? ''),
      scopes: typeof t.scopes === 'string' ? safeParseScopes(t.scopes) : [],
      created_at: toIso(t.created_at),
      expires_at: toIso(t.expires_at),
      revoked_at: toIso(t.revoked_at),
    }));

    // ID tokens (audit)
    const idt = await orm.findMany('oidc_id_tokens', {
      where: (b: any) => b('user_id', '=', subjectId),
      orderBy: [['issued_at', 'desc']],
      limit: 10,
    });
    const id_tokens = (idt || []).map((t: any) => ({
      id: String(t.id ?? ''),
      jti: String(t.jti ?? ''),
      client_id: String(t.client_id ?? ''),
      audience: typeof t.audience === 'string' ? safeParseScopes(t.audience) : [],
      scopes: typeof t.scopes === 'string' ? safeParseScopes(t.scopes) : [],
      issued_at: toIso(t.issued_at),
      expires_at: toIso(t.expires_at),
      auth_time: toIso(t.auth_time),
      nonce: t.nonce ?? undefined,
    }));

    return {
      access_tokens,
      refresh_tokens,
      id_tokens,
      counts: {
        access: Array.isArray(access) ? access.length : 0,
        refresh: Array.isArray(refresh) ? refresh.length : 0,
        id: Array.isArray(idt) ? idt.length : 0,
      },
    };
  },
};

function toIso(v: any): string | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

function safeParseScopes(raw: any): string[] {
  try {
    const val = JSON.parse(String(raw));
    return Array.isArray(val) ? val.map((s) => String(s)) : [];
  } catch {
    return [];
  }
}

/**
 * Create OIDC Provider plugin with custom configuration
 * 
 * @example
 * ```typescript
 * const oidcProvider = createOIDCProviderPlugin({
 *   config: {
 *     issuer: {
 *       url: 'https://auth.example.com',
 *       name: 'My OIDC Provider'
 *     },
 *     features: {
 *       authorizationCodeFlow: true,
 *       refreshTokens: true,
 *       pkce: true
 *     },
 *     tokens: {
 *       accessTokenTtl: 60,
 *       idTokenTtl: 60,
 *       refreshTokenTtl: 30
 *     }
 *   }
 * });
 * ```
 */
export function createOIDCProviderPlugin(options: {
  config?: Partial<OIDCProviderConfigV2>;
}): AuthPluginV2<OIDCProviderConfigV2> {
  return createAuthPluginV2(baseOIDCProviderPluginV2, {
    config: options.config,
    validateConfig: (config) => {
      const errors: string[] = [];
      
      // Validate issuer configuration
      if (!config.issuer?.url) {
        errors.push('issuer.url is required');
      } else {
        try {
          new URL(config.issuer.url);
        } catch {
          errors.push('issuer.url must be a valid URL');
        }
      }
      
      if (!config.issuer?.name) {
        errors.push('issuer.name is required');
      }
      
      // Validate token TTL values
      if (config.tokens?.accessTokenTtl !== undefined && config.tokens.accessTokenTtl < 1) {
        errors.push('tokens.accessTokenTtl must be at least 1 minute');
      }
      
      if (config.tokens?.idTokenTtl !== undefined && config.tokens.idTokenTtl < 1) {
        errors.push('tokens.idTokenTtl must be at least 1 minute');
      }
      
      if (config.tokens?.refreshTokenTtl !== undefined && config.tokens.refreshTokenTtl < 1) {
        errors.push('tokens.refreshTokenTtl must be at least 1 day');
      }
      
      if (config.tokens?.authorizationCodeTtl !== undefined && config.tokens.authorizationCodeTtl < 1) {
        errors.push('tokens.authorizationCodeTtl must be at least 1 minute');
      }
      
      // Validate cleanup configuration
      if (config.cleanup?.intervalMinutes !== undefined && config.cleanup.intervalMinutes < 1) {
        errors.push('cleanup.intervalMinutes must be at least 1 minute');
      }
      
      if (config.cleanup?.expiredTokenRetentionDays !== undefined && config.cleanup.expiredTokenRetentionDays < 1) {
        errors.push('cleanup.expiredTokenRetentionDays must be at least 1 day');
      }
      
      return errors.length > 0 ? errors : null;
    },
  });
}

export default baseOIDCProviderPluginV2;