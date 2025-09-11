/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  redirectUri: string;
  isActive?: boolean;
}

/**
 * OAuth plugin configuration for V2
 */
export interface OAuthConfigV2 {
  /** Array of OAuth provider configurations */
  providers: OAuthProviderConfig[];
  
  /** Default OAuth scopes to request if not specified by provider */
  defaultScopes?: string[];
  
  /** Session duration for OAuth users in seconds (default: 24 hours) */
  sessionTtlSeconds?: number;
  
  /** Enable linking multiple OAuth accounts to one user */
  allowAccountLinking?: boolean;
  
  /** Require email verification for OAuth users */
  requireEmailVerification?: boolean;
  
  /** Custom token refresh interval in seconds */
  tokenRefreshIntervalSeconds?: number;
  
  /** Enable automatic token refresh */
  autoRefreshTokens?: boolean;
}

/**
 * OAuth user profile data from provider
 */
export interface OAuthUserProfile {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
  [key: string]: any;
}

/**
 * OAuth token response from provider
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/**
 * OAuth state parameter for CSRF protection
 */
export interface OAuthState {
  provider: string;
  redirectUrl?: string;
  nonce: string;
  timestamp: number;
}