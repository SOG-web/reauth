/**
 * Generic OAuth Plugin V2 - Types and Configuration Interfaces
 * 
 * Comprehensive OAuth 2.0 and OAuth 1.0a support with security features.
 * Protocol-agnostic, platform-agnostic, and runtime-agnostic implementation.
 */

/**
 * OAuth version specification
 */
export type OAuthVersion = '1.0a' | '2.0';

/**
 * OAuth 1.0a signature methods
 */
export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'RSA-SHA1' | 'PLAINTEXT';

/**
 * Provider profile field mapping for user data extraction
 */
export interface ProfileMapping {
  /** Field name for user ID (required) */
  id: string;
  /** Field name for email address */
  email?: string;
  /** Field name for display name */
  name?: string;
  /** Field name for avatar/profile picture URL */
  avatar?: string;
}

/**
 * OAuth provider configuration
 */
export interface GenericOAuthProvider {
  /** Provider identifier (must be unique) */
  name: string;
  
  /** OAuth version to use */
  version: OAuthVersion;
  
  /** OAuth client ID */
  clientId: string;
  
  /** OAuth client secret */
  clientSecret: string;
  
  // OAuth 2.0 specific endpoints
  /** Authorization URL for OAuth 2.0 */
  authorizationUrl?: string;
  
  /** Token exchange URL for OAuth 2.0 */
  tokenUrl?: string;
  
  /** User profile information URL */
  userInfoUrl?: string;
  
  // OAuth 1.0a specific endpoints
  /** Request token URL for OAuth 1.0a */
  requestTokenUrl?: string;
  
  /** Access token URL for OAuth 1.0a */
  accessTokenUrl?: string;
  
  // Discovery
  /** OpenID Connect discovery URL */
  discoveryUrl?: string;
  
  // Scopes and parameters
  /** OAuth scopes to request */
  scopes?: string[];
  
  /** Additional parameters to include in authorization request */
  additionalParams?: Record<string, string>;
  
  // Security settings
  /** Enable PKCE for OAuth 2.0 (recommended for public clients) */
  pkce?: boolean;
  
  /** Enable state parameter for CSRF protection */
  state?: boolean;
  
  /** OAuth 1.0a signature method */
  signatureMethod?: OAuth1SignatureMethod;
  
  // User profile configuration
  /** Mapping for extracting user profile data */
  profileMapping?: ProfileMapping;
  
  // Request configuration
  /** Custom headers for OAuth requests */
  headers?: Record<string, string>;
  
  /** Provider status */
  isActive?: boolean;
}

/**
 * Security settings for the OAuth plugin
 */
export interface SecuritySettings {
  /** Length in bytes for state parameter generation */
  stateLength: number;
  
  /** Length in bytes for PKCE code verifier generation */
  codeVerifierLength: number;
  
  /** Enable token encryption at rest */
  tokenEncryption: boolean;
  
  /** Validate token issuer (for JWT tokens) */
  validateIssuer: boolean;
  
  /** Clock skew allowance in seconds for JWT validation */
  clockSkewSeconds: number;
}

/**
 * Token management settings
 */
export interface TokenSettings {
  /** Access token TTL in minutes */
  accessTokenTtl: number;
  
  /** Refresh token TTL in days */
  refreshTokenTtl: number;
  
  /** Enable automatic token refresh */
  autoRefresh: boolean;
  
  /** Revoke tokens when disconnecting provider */
  revokeOnDisconnect: boolean;
}

/**
 * Cleanup configuration for expired data
 */
export interface CleanupSettings {
  /** Enable automatic cleanup */
  enabled: boolean;
  
  /** Cleanup interval in minutes */
  intervalMinutes: number;
  
  /** Retention period for expired tokens in days */
  expiredTokenRetentionDays: number;
  
  /** Retention period for expired authorization codes in hours */
  expiredCodeRetentionHours: number;
}

/**
 * Complete Generic OAuth Plugin V2 configuration
 */
export interface GenericOAuthConfigV2 {
  /** OAuth provider configurations */
  providers: Record<string, GenericOAuthProvider>;
  
  /** Security settings */
  security: SecuritySettings;
  
  /** Token management settings */
  tokens: TokenSettings;
  
  /** Cleanup configuration */
  cleanup?: CleanupSettings;
  
  /** Session TTL for OAuth authenticated users in seconds */
  sessionTtlSeconds?: number;
}

/**
 * OAuth user profile data structure
 */
export interface OAuthUserProfile {
  /** User ID from provider */
  id: string;
  
  /** Email address */
  email?: string;
  
  /** Display name */
  name?: string;
  
  /** Avatar/profile picture URL */
  avatar?: string;
  
  /** Email verification status */
  verified_email?: boolean;
  
  /** Raw profile data from provider */
  raw: Record<string, unknown>;
}

/**
 * OAuth connection data for database storage
 */
export interface OAuthConnection {
  id: string;
  userId: string;
  providerId: string;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scopes: string[];
  profileData: OAuthUserProfile;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

/**
 * OAuth authorization session for temporary state storage
 */
export interface OAuthAuthorizationSession {
  id: string;
  userId?: string;
  providerId: string;
  state: string;
  codeVerifier?: string; // PKCE
  codeChallenge?: string; // PKCE
  redirectUri: string;
  scopes: string[];
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * OAuth 1.0a request token storage
 */
export interface OAuth1RequestToken {
  id: string;
  providerId: string;
  token: string;
  tokenSecret: string;
  callbackConfirmed: boolean;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

/**
 * OAuth provider discovery result
 */
export interface OAuthProviderDiscovery {
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  scopesSupported?: string[];
  responseTypesSupported?: string[];
  grantTypesSupported?: string[];
  codeChallengeMethodsSupported?: string[];
}

/**
 * OAuth token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  expiresAt?: Date;
  scopes?: string[];
  error?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_GENERIC_OAUTH_CONFIG: Partial<GenericOAuthConfigV2> = {
  security: {
    stateLength: 32,
    codeVerifierLength: 32,
    tokenEncryption: true,
    validateIssuer: true,
    clockSkewSeconds: 30,
  },
  tokens: {
    accessTokenTtl: 60, // 1 hour
    refreshTokenTtl: 30, // 30 days
    autoRefresh: true,
    revokeOnDisconnect: true,
  },
  cleanup: {
    enabled: true,
    intervalMinutes: 60, // 1 hour
    expiredTokenRetentionDays: 7,
    expiredCodeRetentionHours: 1,
  },
  sessionTtlSeconds: 24 * 60 * 60, // 24 hours
};