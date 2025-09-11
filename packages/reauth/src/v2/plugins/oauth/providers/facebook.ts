import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Facebook OAuth provider configuration
 */
export interface FacebookOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Facebook OAuth plugin
 * 
 * @example
 * ```typescript
 * const facebookOAuth = createFacebookOAuthPlugin({
 *   clientId: process.env.FACEBOOK_APP_ID!,
 *   clientSecret: process.env.FACEBOOK_APP_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['email', 'public_profile'],
 * });
 * ```
 */
export function createFacebookOAuthPlugin(config: FacebookOAuthConfig) {
  const facebookProvider: OAuthProviderConfig = {
    name: 'facebook',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
    scopes: config.scopes || ['email', 'public_profile'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [facebookProvider],
    },
  });
}

export default createFacebookOAuthPlugin;