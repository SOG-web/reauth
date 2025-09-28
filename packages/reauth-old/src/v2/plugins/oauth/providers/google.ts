import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Google OAuth provider configuration
 */
export interface GoogleOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create Google OAuth plugin
 * 
 * @example
 * ```typescript
 * const googleOAuth = createGoogleOAuthPlugin({
 *   clientId: process.env.GOOGLE_CLIENT_ID!,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['email', 'profile', 'openid'],
 * });
 * ```
 */
export function createGoogleOAuthPlugin(config: GoogleOAuthConfig) {
  const googleProvider: OAuthProviderConfig = {
    name: 'google',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: config.scopes || ['email', 'profile', 'openid'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [googleProvider],
    },
  });
}

export default createGoogleOAuthPlugin;