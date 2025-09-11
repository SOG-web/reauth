import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * WorkOS OAuth provider configuration
 */
export interface WorkOSOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create WorkOS OAuth plugin
 * 
 * @example
 * ```typescript
 * const workosOAuth = createWorkOSOAuthPlugin({
 *   clientId: process.env.WORKOS_CLIENT_ID!,
 *   clientSecret: process.env.WORKOS_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['profile', 'email'],
 * });
 * ```
 */
export function createWorkOSOAuthPlugin(config: WorkOSOAuthConfig) {
  const workosProvider: OAuthProviderConfig = {
    name: 'workos',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://api.workos.com/sso/authorize',
    tokenUrl: 'https://api.workos.com/sso/token',
    userInfoUrl: 'https://api.workos.com/sso/profile',
    scopes: config.scopes || ['profile', 'email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [workosProvider],
    },
  });
}

export default createWorkOSOAuthPlugin;