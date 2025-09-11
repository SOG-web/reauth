/**
 * OIDC Provider Plugin V2 Types
 * Comprehensive types for OpenID Connect Provider implementation
 */

/**
 * OIDC Issuer configuration
 */
export interface OIDCIssuerConfig {
  /** Issuer identifier URL */
  url: string;
  /** Human-readable name */
  name: string;
  /** Optional logo URL */
  logo?: string;
  /** Terms of service URL */
  termsOfService?: string;
  /** Privacy policy URL */
  privacyPolicy?: string;
}

/**
 * OIDC supported features configuration
 */
export interface OIDCFeaturesConfig {
  /** Authorization Code Flow support */
  authorizationCodeFlow: boolean;
  /** Implicit Flow support (legacy) */
  implicitFlow: boolean;
  /** Hybrid Flow support */
  hybridFlow: boolean;
  /** Client Credentials Flow support */
  clientCredentialsFlow: boolean;
  /** Device Authorization Flow support */
  deviceAuthorizationFlow: boolean;
  /** Refresh token support */
  refreshTokens: boolean;
  /** PKCE support */
  pkce: boolean;
  /** Dynamic Client Registration */
  dynamicClientRegistration: boolean;
  /** Token introspection */
  tokenIntrospection: boolean;
  /** Token revocation */
  tokenRevocation: boolean;
}

/**
 * Token configuration
 */
export interface OIDCTokenConfig {
  /** Access token TTL in minutes */
  accessTokenTtl: number;
  /** ID token TTL in minutes */
  idTokenTtl: number;
  /** Refresh token TTL in days */
  refreshTokenTtl: number;
  /** Authorization code TTL in minutes */
  authorizationCodeTtl: number;
  /** JWT signing algorithm */
  signingAlgorithm: 'RS256' | 'ES256' | 'HS256';
  /** JWT encryption algorithm (optional) */
  encryptionAlgorithm?: 'RSA-OAEP' | 'A256KW';
}

/**
 * Cryptographic key configuration
 */
export interface OIDCKeyConfig {
  signingKey: {
    algorithm: 'RSA' | 'EC';
    keySize: number;
    keyId: string;
  };
  encryptionKey?: {
    algorithm: 'RSA' | 'EC';
    keySize: number;
    keyId: string;
  };
  /** Key rotation interval in days */
  rotationIntervalDays: number;
}

/**
 * OIDC scope configuration
 */
export interface OIDCScopeConfig {
  description: string;
  claims: string[];
  required?: boolean;
}

/**
 * OIDC claim configuration
 */
export interface OIDCClaimConfig {
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  /** User profile field mapping */
  source: string;
}

/**
 * Client default configuration
 */
export interface OIDCClientDefaultsConfig {
  tokenEndpointAuthMethod: 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';
  grantTypes: string[];
  responseTypes: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  defaultScopes: string[];
}

/**
 * Security settings
 */
export interface OIDCSecurityConfig {
  requirePkce: boolean;
  allowInsecureRedirectUris: boolean;
  maxAuthorizationAge: number; // seconds
  requireRequestUri: boolean;
  allowPlaintextPkce: boolean;
}

/**
 * Cleanup configuration
 */
export interface OIDCCleanupConfig {
  enabled: boolean;
  intervalMinutes: number;
  expiredTokenRetentionDays: number;
  expiredCodeRetentionHours: number;
  revokedTokenRetentionDays: number;
}

/**
 * Main OIDC Provider configuration interface
 */
export interface OIDCProviderConfigV2 {
  /** Issuer configuration */
  issuer: OIDCIssuerConfig;
  /** Supported features */
  features: OIDCFeaturesConfig;
  /** Token configuration */
  tokens: OIDCTokenConfig;
  /** Cryptographic keys */
  keys: OIDCKeyConfig;
  /** Scopes and claims */
  scopes: Record<string, OIDCScopeConfig>;
  claims: Record<string, OIDCClaimConfig>;
  /** Client defaults */
  clientDefaults: OIDCClientDefaultsConfig;
  /** Security settings */
  security: OIDCSecurityConfig;
  /** Cleanup configuration */
  cleanup?: OIDCCleanupConfig;
}

/**
 * OIDC Client registration data
 */
export interface OIDCClient {
  id: string;
  clientId: string;
  clientSecret?: string;
  clientName: string;
  clientUri?: string;
  logoUri?: string;
  tosUri?: string;
  policyUri?: string;
  jwksUri?: string;
  jwks?: Record<string, any>;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  scopes: string[];
  tokenEndpointAuthMethod: string;
  idTokenSignedResponseAlg: string;
  userinfoSignedResponseAlg?: string;
  requestObjectSigningAlg?: string;
  applicationType: string;
  subjectType: string;
  sectorIdentifierUri?: string;
  requireAuthTime: boolean;
  defaultMaxAge?: number;
  requirePushedAuthorizationRequests: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authorization code data
 */
export interface OIDCAuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  nonce?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  authTime: Date;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

/**
 * Access token data
 */
export interface OIDCAccessToken {
  id: string;
  tokenHash: string;
  clientId: string;
  userId: string;
  scopes: string[];
  tokenType: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

/**
 * Refresh token data
 */
export interface OIDCRefreshToken {
  id: string;
  tokenHash: string;
  accessTokenId: string;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

/**
 * ID token data for audit/tracking
 */
export interface OIDCIdToken {
  id: string;
  jti: string;
  clientId: string;
  userId: string;
  audience: string[];
  scopes: string[];
  authTime?: Date;
  issuedAt: Date;
  expiresAt: Date;
  nonce?: string;
}

/**
 * Cryptographic key storage
 */
export interface OIDCKey {
  id: string;
  keyId: string;
  keyType: string; // 'RSA', 'EC'
  keyUse: string; // 'sig', 'enc'
  algorithm: string; // 'RS256', 'ES256', etc.
  publicKey: string;
  privateKeyEncrypted: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * JWT claims interface
 */
export interface JWTClaims {
  /** Issuer */
  iss: string;
  /** Subject (user ID) */
  sub: string;
  /** Audience (client ID) */
  aud: string | string[];
  /** Expiration time */
  exp: number;
  /** Issued at */
  iat: number;
  /** Authorization time */
  auth_time?: number;
  /** Nonce */
  nonce?: string;
  /** JWT ID */
  jti?: string;
  /** Additional claims */
  [key: string]: any;
}

/**
 * OIDC Discovery document
 */
export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported?: string[];
  introspection_endpoint?: string;
  revocation_endpoint?: string;
}

/**
 * Authorization request parameters
 */
export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scopes: string[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  prompt?: string;
  maxAge?: number;
  loginHint?: string;
  uiLocales?: string;
}

/**
 * Token request parameters
 */
export interface TokenRequest {
  grantType: string;
  clientId: string;
  clientSecret?: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  refreshToken?: string;
  scope?: string;
}

/**
 * Token response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/**
 * UserInfo response
 */
export interface UserInfoResponse {
  sub: string;
  [key: string]: any;
}

/**
 * Client registration request
 */
export interface ClientRegistrationRequest {
  client_name: string;
  redirect_uris: string[];
  client_uri?: string;
  logo_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: Record<string, any>;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
  contacts?: string[];
  application_type?: string;
  subject_type?: string;
}

/**
 * Client registration response
 */
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
  [key: string]: any;
}