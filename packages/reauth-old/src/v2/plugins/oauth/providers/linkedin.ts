import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * LinkedIn OAuth provider configuration
 */
export interface LinkedInOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create LinkedIn OAuth plugin
 * 
 * @example
 * ```typescript
 * const linkedinOAuth = createLinkedInOAuthPlugin({
 *   clientId: process.env.LINKEDIN_CLIENT_ID!,
 *   clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['openid', 'profile', 'email'],
 * });
 * ```
 */
export function createLinkedInOAuthPlugin(config: LinkedInOAuthConfig) {
  const linkedinProvider: OAuthProviderConfig = {
    name: 'linkedin',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scopes: config.scopes || ['openid', 'profile', 'email'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [linkedinProvider],
    },
  });
}

export default createLinkedInOAuthPlugin;