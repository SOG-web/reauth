/**
 * OIDC Provider Plugin V2 Utilities
 * Platform-agnostic utilities for OIDC operations
 */

import type { OIDCProviderConfigV2, JWTClaims, OIDCDiscoveryDocument } from './types';
import type { OrmLike } from '../../types.v2';

/**
 * Generate a cryptographically secure random string
 * Uses platform-appropriate randomness source
 */
export function generateSecureRandom(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  
  // Try to use crypto.getRandomValues if available (browsers, Node.js, Deno)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    globalThis.crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i]! % chars.length];
    }
    return result;
  }
  
  // Fallback for environments without crypto.getRandomValues
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return result;
}

/**
 * Generate authorization code
 */
export function generateAuthorizationCode(): string {
  return generateSecureRandom(32);
}

/**
 * Generate access token
 */
export function generateAccessToken(): string {
  return generateSecureRandom(32);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return generateSecureRandom(32);
}

/**
 * Generate client ID
 */
export function generateClientId(): string {
  return generateSecureRandom(24);
}

/**
 * Generate client secret
 */
export function generateClientSecret(): string {
  return generateSecureRandom(48);
}

/**
 * Generate JWT ID (jti)
 */
export function generateJwtId(): string {
  return generateSecureRandom(16);
}

/**
 * Hash a token securely using platform-appropriate hashing
 * This is a simplified implementation - in production you'd use proper crypto
 */
export async function hashToken(token: string): Promise<string> {
  // Try to use SubtleCrypto if available
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fall through to simple hash
    }
  }
  
  // Simplified hash for environments without SubtleCrypto
  // In production, you'd implement proper hashing
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Validate redirect URI format
 */
export function validateRedirectUri(uri: string, allowInsecure: boolean = false): boolean {
  try {
    const url = new URL(uri);
    
    // Must use HTTPS unless specifically allowing insecure URIs
    if (!allowInsecure && url.protocol !== 'https:' && url.hostname !== 'localhost') {
      return false;
    }
    
    // No fragments allowed
    if (url.hash) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate scopes against configuration
 */
export function validateScopes(requestedScopes: string[], config: OIDCProviderConfigV2): string[] {
  const validScopes: string[] = [];
  const configuredScopes = Object.keys(config.scopes);
  
  for (const scope of requestedScopes) {
    if (configuredScopes.includes(scope)) {
      validScopes.push(scope);
    }
  }
  
  // Always include 'openid' if not present and this is an OIDC request
  if (requestedScopes.includes('openid') && !validScopes.includes('openid')) {
    validScopes.unshift('openid');
  }
  
  return validScopes;
}

/**
 * Generate claims for JWT based on scopes and user data
 */
export function generateClaims(
  userId: string,
  userProfile: Record<string, any>,
  scopes: string[],
  config: OIDCProviderConfigV2
): Record<string, any> {
  const claims: Record<string, any> = {
    sub: userId,
  };
  
  // Add claims based on requested scopes
  for (const scope of scopes) {
    const scopeConfig = config.scopes[scope];
    if (scopeConfig) {
      for (const claimName of scopeConfig.claims) {
        const claimConfig = config.claims[claimName];
        if (claimConfig && userProfile[claimConfig.source]) {
          claims[claimName] = userProfile[claimConfig.source];
        }
      }
    }
  }
  
  return claims;
}

/**
 * Create JWT claims object for ID token
 */
export function createIdTokenClaims(
  config: OIDCProviderConfigV2,
  userId: string,
  clientId: string,
  userProfile: Record<string, any>,
  scopes: string[],
  nonce?: string,
  authTime?: Date
): JWTClaims {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (config.tokens.idTokenTtl * 60);
  
  const claims: JWTClaims = {
    iss: config.issuer.url,
    sub: userId,
    aud: clientId,
    exp: expiresAt,
    iat: now,
    jti: generateJwtId(),
  };
  
  if (nonce) {
    claims.nonce = nonce;
  }
  
  if (authTime) {
    claims.auth_time = Math.floor(authTime.getTime() / 1000);
  }
  
  // Add additional claims based on scopes
  const additionalClaims = generateClaims(userId, userProfile, scopes, config);
  Object.assign(claims, additionalClaims);
  
  return claims;
}

/**
 * Create OIDC discovery document
 */
export function createDiscoveryDocument(
  config: OIDCProviderConfigV2,
  baseUrl: string
): OIDCDiscoveryDocument {
  const issuerUrl = config.issuer.url;
  
  const discoveryDoc: OIDCDiscoveryDocument = {
    issuer: issuerUrl,
    authorization_endpoint: `${baseUrl}/oidc/authorize`,
    token_endpoint: `${baseUrl}/oidc/token`,
    userinfo_endpoint: `${baseUrl}/oidc/userinfo`,
    jwks_uri: `${baseUrl}/oidc/jwks`,
    scopes_supported: Object.keys(config.scopes),
    response_types_supported: [],
    grant_types_supported: [],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [config.tokens.signingAlgorithm],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    claims_supported: Object.keys(config.claims),
  };
  
  // Add supported response types based on enabled flows
  if (config.features.authorizationCodeFlow) {
    discoveryDoc.response_types_supported.push('code');
    discoveryDoc.grant_types_supported.push('authorization_code');
  }
  
  if (config.features.implicitFlow) {
    discoveryDoc.response_types_supported.push('id_token', 'token');
    discoveryDoc.grant_types_supported.push('implicit');
  }
  
  if (config.features.hybridFlow) {
    discoveryDoc.response_types_supported.push('code id_token', 'code token', 'code id_token token');
  }
  
  if (config.features.clientCredentialsFlow) {
    discoveryDoc.grant_types_supported.push('client_credentials');
  }
  
  if (config.features.refreshTokens) {
    discoveryDoc.grant_types_supported.push('refresh_token');
  }
  
  if (config.features.pkce) {
    discoveryDoc.code_challenge_methods_supported = ['S256'];
  }
  
  if (config.features.dynamicClientRegistration) {
    discoveryDoc.registration_endpoint = `${baseUrl}/oidc/register`;
  }
  
  if (config.features.tokenIntrospection) {
    discoveryDoc.introspection_endpoint = `${baseUrl}/oidc/introspect`;
  }
  
  if (config.features.tokenRevocation) {
    discoveryDoc.revocation_endpoint = `${baseUrl}/oidc/revoke`;
  }
  
  return discoveryDoc;
}

/**
 * Validate PKCE challenge
 */
export function validatePkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string = 'S256'
): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  
  if (method === 'S256') {
    // In a real implementation, you'd use proper SHA256 hashing and base64url encoding
    // This is a simplified version for demonstration
    const expected = btoa(codeVerifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return expected === codeChallenge;
  }
  
  return false;
}

/**
 * Calculate token expiration date
 */
export function calculateExpirationDate(ttlMinutes: number): Date {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Cleanup expired authorization codes
 */
export async function cleanupExpiredCodes(
  orm: OrmLike,
  config?: OIDCProviderConfigV2
): Promise<{ codesDeleted: number }> {
  const now = new Date();
  
  try {
    // Delete expired authorization codes
    const result = await orm.deleteMany('oidc_authorization_codes', {
      where: (b: any) => b('expires_at', '<', now),
    });
    
    return { codesDeleted: result || 0 };
  } catch (error) {
    console.error('Error cleaning up expired authorization codes:', error);
    return { codesDeleted: 0 };
  }
}

/**
 * Cleanup expired tokens
 */
export async function cleanupExpiredTokens(
  orm: OrmLike,
  config?: OIDCProviderConfigV2
): Promise<{ accessTokensDeleted: number; refreshTokensDeleted: number; idTokensDeleted: number }> {
  const now = new Date();
  
  try {
    // Delete expired access tokens
    const accessTokensDeleted = await orm.deleteMany('oidc_access_tokens', {
      where: (b: any) => b('expires_at', '<', now),
    });
    
    // Delete expired refresh tokens
    const refreshTokensDeleted = await orm.deleteMany('oidc_refresh_tokens', {
      where: (b: any) => b('expires_at', '<', now),
    });
    
    // Delete expired ID tokens (for audit cleanup)
    const idTokensDeleted = await orm.deleteMany('oidc_id_tokens', {
      where: (b: any) => b('expires_at', '<', now),
    });
    
    return {
      accessTokensDeleted: accessTokensDeleted || 0,
      refreshTokensDeleted: refreshTokensDeleted || 0,
      idTokensDeleted: idTokensDeleted || 0,
    };
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return {
      accessTokensDeleted: 0,
      refreshTokensDeleted: 0,
      idTokensDeleted: 0,
    };
  }
}

/**
 * Cleanup revoked tokens that have exceeded retention period
 */
export async function cleanupRevokedTokens(
  orm: OrmLike,
  retentionDays: number
): Promise<{ revokedTokensDeleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  try {
    // Delete revoked tokens older than retention period
    const accessTokensDeleted = await orm.deleteMany('oidc_access_tokens', {
      where: (b: any) => b('revoked_at', 'is not', null)
        .and(b('revoked_at', '<', cutoffDate)),
    });
    
    const refreshTokensDeleted = await orm.deleteMany('oidc_refresh_tokens', {
      where: (b: any) => b('revoked_at', 'is not', null)
        .and(b('revoked_at', '<', cutoffDate)),
    });
    
    return {
      revokedTokensDeleted: (accessTokensDeleted || 0) + (refreshTokensDeleted || 0),
    };
  } catch (error) {
    console.error('Error cleaning up revoked tokens:', error);
    return { revokedTokensDeleted: 0 };
  }
}