import { createOAuthPlugin } from '../plugin.v2';
import type { OAuthConfigV2, OAuthProviderConfig } from '../types';

/**
 * GitHub OAuth provider configuration
 */
export interface GitHubOAuthConfig extends Omit<OAuthConfigV2, 'providers'> {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Create GitHub OAuth plugin
 * 
 * @example
 * ```typescript
 * const githubOAuth = createGitHubOAuthPlugin({
 *   clientId: process.env.GITHUB_CLIENT_ID!,
 *   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/oauth/callback',
 *   scopes: ['user:email', 'read:user'],
 * });
 * ```
 */
export function createGitHubOAuthPlugin(config: GitHubOAuthConfig) {
  const githubProvider: OAuthProviderConfig = {
    name: 'github',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: config.scopes || ['user:email', 'read:user'],
    redirectUri: config.redirectUri,
    isActive: true,
  };

  return createOAuthPlugin({
    config: {
      ...config,
      providers: [githubProvider],
    },
  });
}

export default createGitHubOAuthPlugin;