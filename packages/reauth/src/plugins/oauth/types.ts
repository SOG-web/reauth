import type { AuthInput, AuthOutput, AuthPlugin } from '../../types';

/**
 * OAuth ID token claims structure
 */
export interface OAuthIDTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: any;
}

/**
 * Base configuration for OAuth providers
 */
export interface BaseOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  /**
   * Custom function to fetch user info from the provider
   * Should return user data that can be used to create/link accounts
   */
  getUserInfo?: (
    accessToken: string,
    idToken?: string,
  ) => Promise<OAuthUserInfo>;
  /**
   * Custom function to handle account linking
   * Called when a user with OAuth account tries to link with existing account
   */
  onAccountLink?: (
    oauthUser: OAuthUserInfo,
    existingSubject: any,
    container: any,
  ) => Promise<any>;
  /**
   * Custom function to handle account creation
   * Called when creating a new account from OAuth data
   */
  onAccountCreate?: (
    oauthUser: OAuthUserInfo,
    container: any,
  ) => Promise<Partial<any>>;
  /**
   * Field name to use for finding existing accounts (default: 'email')
   */
  linkField?: string;
}

/**
 * OAuth user information structure
 */
export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
  [key: string]: any;
}

/**
 * OAuth provider types
 */
export type OAuthProviderType = 'regular' | 'pkce';

/**
 * OAuth client factory function type
 */
export type OAuthClientFactory<T extends BaseOAuthConfig> = (config: T) => any;

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig<T extends BaseOAuthConfig = BaseOAuthConfig> {
  name: string;
  type: OAuthProviderType;
  clientFactory: OAuthClientFactory<T>;
  defaultScopes: string[];
  config: T;
  client?: any; // The instantiated client
}

/**
 * OAuth plugin configuration
 */
export interface OAuthPluginConfig {
  providers?: OAuthProviderConfig[];
  sessionTtlSeconds?: number;
}

/**
 * OAuth step context
 */
export interface OAuthStepContext {
  provider: OAuthProviderConfig;
  client: any;
  getUserInfo: (accessToken: string, idToken?: string) => Promise<OAuthUserInfo>;
  linkField: string;
}
