import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Auth0 OAuth provider configuration
 */
export interface Auth0OAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  domain: string;
  scopes?: string[];
}

/**
 * Create Auth0 OAuth plugin
 * 
 * @example
 * ```typescript
 * const auth0OAuth = createAuth0OAuthPlugin({
 *   clientId: process.env.AUTH0_CLIENT_ID!,
 *   clientSecret: process.env.AUTH0_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   domain: 'your-domain.auth0.com',
 *   scopes: ['openid', 'profile', 'email'],
 * });
 * ```
 */
export function createAuth0OAuthPlugin(config: Auth0OAuthConfig) {
  const auth0Provider: OAuthProviderConfig = {
    name: 'auth0',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: `https://${config.domain}/authorize`,
    tokenUrl: `https://${config.domain}/oauth/token`,
    userInfoUrl: `https://${config.domain}/userinfo`,
    scopes: config.scopes || ['openid', 'profile', 'email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [auth0Provider],
    },
  });
}

export default createAuth0OAuthPlugin;