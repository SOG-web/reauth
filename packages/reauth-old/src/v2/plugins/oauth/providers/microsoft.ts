import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * Microsoft OAuth provider configuration
 */
export interface MicrosoftOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string;
  scopes?: string[];
}

/**
 * Create Microsoft OAuth plugin
 * 
 * @example
 * ```typescript
 * const microsoftOAuth = createMicrosoftOAuthPlugin({
 *   clientId: process.env.MICROSOFT_CLIENT_ID!,
 *   clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   tenantId: 'common', // or specific tenant ID
 *   scopes: ['openid', 'profile', 'email', 'User.Read'],
 * });
 * ```
 */
export function createMicrosoftOAuthPlugin(config: MicrosoftOAuthConfig) {
  const tenantId = config.tenantId || 'common';
  
  const microsoftProvider: OAuthProviderConfig = {
    name: 'microsoft',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: config.scopes || ['openid', 'profile', 'email', 'User.Read'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [microsoftProvider],
    },
  });
}

export default createMicrosoftOAuthPlugin;