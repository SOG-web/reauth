import type { JWK, JWTPayload } from 'jose';

// Client Types
export type ClientType = 'public' | 'confidential';
export type RotationReason = 'scheduled' | 'manual' | 'compromise';
export type BlacklistReason = 'logout' | 'revocation' | 'security';
export type RefreshTokenRevocationReason =
  | 'logout'
  | 'rotation'
  | 'security'
  | 'expired';

// Simple Client
export interface ReAuthClient {
  id: string;
  clientSecretHash?: string; // Only for confidential clients
  clientType: ClientType;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Simple JWT Payload - only user details
export interface ReAuthJWTPayload extends JWTPayload {
  sub: string; // subject_id
  subject_type: string; // Custom claim for subject type (e.g., 'user', 'guest')
  userData?: Record<string, any>; // Additional user data
}

// JWKS Key Management
export interface JWKSKey {
  id: string;
  keyId: string; // kid
  algorithm: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

export interface JWKSKeyRotation {
  id: string;
  oldKeyId?: string;
  newKeyId: string;
  rotationReason: RotationReason;
  rotatedAt: Date;
}

// JWT Blacklist Entry
export interface JWTBlacklistEntry {
  id: string;
  token: string; // Full JWT token
  blacklistedAt: Date;
  reason: BlacklistReason;
}

// Refresh Token Entry
export interface RefreshToken {
  id: string;
  tokenId: string; // Unique identifier for the refresh token
  subjectType: string;
  subjectId: string;
  tokenHash: string; // Hashed refresh token for security
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revocationReason?: RefreshTokenRevocationReason;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Token pair response
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  tokenType: 'Bearer';
}

// Refresh token validation result
export interface RefreshTokenValidationResult {
  isValid: boolean;
  token?: RefreshToken;
  error?: string;
}

// JWT Service Configuration
export interface JWTServiceConfig {
  // Token lifetimes
  defaultAccessTokenTtlSeconds: number; // 15 minutes
  defaultRefreshTokenTtlSeconds: number; // 30 days

  // Key management
  keyRotationIntervalDays: number; // 10 days
  keyGracePeriodDays: number; // 2 days

  // Security
  enableBlacklist: boolean;
  enableRefreshTokenRotation: boolean; // Rotate refresh tokens on use

  // Cleanup
  cleanupIntervalMinutes: number;
}

// Enhanced JWKS Service Interface
export interface EnhancedJWKSServiceType {
  // Key management
  generateKeyPair(algorithm?: string): Promise<JWKSKey>;
  getActiveKey(): Promise<JWKSKey>;
  getAllActiveKeys(): Promise<JWKSKey[]>;
  rotateKeys(reason?: RotationReason): Promise<JWKSKey>;

  // JWT operations
  signJWT(payload: ReAuthJWTPayload, keyId?: string): Promise<string>;
  verifyJWT(token: string): Promise<ReAuthJWTPayload>;

  // Token pair operations
  createTokenPair(
    payload: ReAuthJWTPayload,
    deviceInfo?: {
      fingerprint?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<TokenPair>;

  // Refresh token operations
  generateRefreshToken(
    subjectType: string,
    subjectId: string,
    deviceInfo?: {
      fingerprint?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<string>;
  validateRefreshToken(token: string): Promise<RefreshTokenValidationResult>;
  refreshAccessToken(refreshToken: string): Promise<TokenPair>;
  revokeRefreshToken(
    token: string,
    reason?: RefreshTokenRevocationReason,
  ): Promise<void>;
  revokeAllRefreshTokens(
    subjectType: string,
    subjectId: string,
    reason?: RefreshTokenRevocationReason,
  ): Promise<number>;

  // JWKS endpoint
  getPublicJWKS(): Promise<{ keys: any[] }>;

  // Blacklist management
  blacklistToken(token: string, reason: BlacklistReason): Promise<void>;
  isTokenBlacklisted(token: string): Promise<boolean>;

  // Cleanup
  cleanupExpiredKeys(): Promise<number>;
  cleanupBlacklistedTokens(): Promise<number>;
  cleanupExpiredRefreshTokens(): Promise<number>;
  registerClient(
    client: ReAuthClient,
  ): Promise<{ client: ReAuthClient; apiKey: string }>;
  getClientById(id: string): Promise<ReAuthClient>;
  getAllClients(): Promise<ReAuthClient[]>;
  getClientByApiKey(apiKey: string): Promise<ReAuthClient>;
  getPublicJWK(): Promise<JWK>;
}

// JWT Plugin Configuration
export interface JWTPluginConfig extends JWTServiceConfig {
  // Plugin-specific settings
  enableLegacyTokenSupport: boolean;
  issuer: string; // JWT issuer claim
}
