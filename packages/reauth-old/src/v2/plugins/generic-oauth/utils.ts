/**
 * Generic OAuth Plugin V2 - Utility Functions
 * 
 * Cross-platform, runtime-agnostic utilities for OAuth operations.
 */

import type { 
  GenericOAuthProvider, 
  OAuthUserProfile, 
  OAuth1RequestToken,
  OAuthProviderDiscovery,
  TokenValidationResult,
} from './types';
import type { OrmLike } from '../../types.v2';

/**
 * Cross-platform crypto utilities using Web Crypto API with Node.js fallbacks
 */
export class CrossPlatformCrypto {
  private static async getCrypto(): Promise<Crypto> {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto;
    }
    // Node.js fallback
    try {
      const { webcrypto } = await import('crypto');
      return webcrypto as Crypto;
    } catch {
      throw new Error('No crypto implementation available');
    }
  }

  /**
   * Generate cryptographically secure random bytes
   */
  static async randomBytes(length: number): Promise<Uint8Array> {
    const crypto = await this.getCrypto();
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Generate a random string for OAuth state/verifier
   */
  static async generateRandomString(length: number): Promise<string> {
    const bytes = await this.randomBytes(length);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * SHA-256 hash (for PKCE code challenge)
   */
  static async sha256(data: string): Promise<ArrayBuffer> {
    const crypto = await this.getCrypto();
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(data));
  }

  /**
   * Base64 URL encode (for PKCE)
   */
  static base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * Generate OAuth state parameter for CSRF protection
 */
export async function generateOAuthState(length = 32): Promise<string> {
  return CrossPlatformCrypto.generateRandomString(length);
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = await CrossPlatformCrypto.generateRandomString(32);
  const challengeBuffer = await CrossPlatformCrypto.sha256(verifier);
  const challenge = CrossPlatformCrypto.base64UrlEncode(challengeBuffer);
  return { verifier, challenge };
}

/**
 * Build OAuth 2.0 authorization URL
 */
export function buildOAuth2AuthorizationUrl(
  provider: GenericOAuthProvider,
  params: {
    redirectUri: string;
    state: string;
    scopes?: string[];
    codeChallenge?: string;
    additionalParams?: Record<string, string>;
  }
): string {
  if (!provider.authorizationUrl) {
    throw new Error(`Authorization URL not configured for provider ${provider.name}`);
  }

  const url = new URL(provider.authorizationUrl);
  
  // Required parameters
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  
  if (provider.state !== false) {
    url.searchParams.set('state', params.state);
  }

  // Scopes
  const scopes = params.scopes || provider.scopes || [];
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '));
  }

  // PKCE
  if (params.codeChallenge && provider.pkce !== false) {
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  // Additional parameters
  const additionalParams = { ...provider.additionalParams, ...params.additionalParams };
  for (const [key, value] of Object.entries(additionalParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * OAuth 1.0a signature generation utilities
 */
export class OAuth1SignatureGenerator {
  /**
   * Generate OAuth 1.0a timestamp
   */
  static generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Generate OAuth 1.0a nonce
   */
  static async generateNonce(): Promise<string> {
    return CrossPlatformCrypto.generateRandomString(16);
  }

  /**
   * Percent-encode string per OAuth 1.0a spec
   */
  static percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * Create OAuth 1.0a signature base string
   */
  static createSignatureBaseString(
    method: string,
    url: string,
    parameters: Record<string, string>
  ): string {
    const encodedMethod = this.percentEncode(method.toUpperCase());
    const encodedUrl = this.percentEncode(url);
    
    // Sort parameters and encode
    const sortedParams = Object.entries(parameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.percentEncode(key)}=${this.percentEncode(value)}`)
      .join('&');
    
    const encodedParams = this.percentEncode(sortedParams);
    
    return `${encodedMethod}&${encodedUrl}&${encodedParams}`;
  }

  /**
   * Generate HMAC-SHA1 signature for OAuth 1.0a
   */
  static async generateHmacSha1Signature(
    baseString: string,
    consumerSecret: string,
    tokenSecret = ''
  ): Promise<string> {
    const key = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;
    
    try {
      const crypto = await CrossPlatformCrypto.getCrypto();
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(key);
      const dataBuffer = encoder.encode(baseString);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
      
      // Convert to base64
      const bytes = new Uint8Array(signature);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch {
      throw new Error('HMAC-SHA1 signature generation not supported in this environment');
    }
  }
}

/**
 * Build OAuth 1.0a authorization URL
 */
export async function buildOAuth1AuthorizationUrl(
  provider: GenericOAuthProvider,
  requestToken: string,
  callbackUri?: string
): Promise<string> {
  if (!provider.authorizationUrl) {
    throw new Error(`Authorization URL not configured for provider ${provider.name}`);
  }

  const url = new URL(provider.authorizationUrl);
  url.searchParams.set('oauth_token', requestToken);
  
  if (callbackUri) {
    url.searchParams.set('oauth_callback', callbackUri);
  }

  return url.toString();
}

/**
 * Parse OAuth user profile with field mapping
 */
export function parseUserProfile(
  rawProfile: Record<string, unknown>,
  provider: GenericOAuthProvider
): OAuthUserProfile {
  const mapping = provider.profileMapping || {
    id: 'id',
    email: 'email',
    name: 'name',
    avatar: 'avatar_url',
  };

  return {
    id: String(rawProfile[mapping.id] || ''),
    email: mapping.email ? String(rawProfile[mapping.email] || '') : undefined,
    name: mapping.name ? String(rawProfile[mapping.name] || '') : undefined,
    avatar: mapping.avatar ? String(rawProfile[mapping.avatar] || '') : undefined,
    verified_email: Boolean(rawProfile.verified_email || rawProfile.email_verified),
    raw: rawProfile,
  };
}

/**
 * Simple token encryption/decryption (placeholder - use proper encryption in production)
 */
export class TokenEncryption {
  private static readonly ENCRYPTION_KEY = 'reauth-generic-oauth-key'; // Use proper key management

  /**
   * Encrypt sensitive token data
   */
  static async encrypt(data: string): Promise<string> {
    // In a real implementation, use proper encryption with keys from environment
    // For now, use base64 encoding as placeholder
    try {
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      return btoa(String.fromCharCode(...dataBytes));
    } catch {
      return data; // Fallback to plaintext if encoding fails
    }
  }

  /**
   * Decrypt sensitive token data
   */
  static async decrypt(encryptedData: string): Promise<string> {
    // In a real implementation, use proper decryption
    // For now, use base64 decoding as placeholder
    try {
      const dataBytes = atob(encryptedData);
      return dataBytes;
    } catch {
      return encryptedData; // Fallback to assuming plaintext
    }
  }
}

/**
 * Validate OAuth state parameter
 */
export function validateOAuthState(
  receivedState: string,
  expectedState: string
): boolean {
  if (!receivedState || !expectedState) {
    return false;
  }
  return receivedState === expectedState;
}

/**
 * Clean up expired OAuth data
 */
export async function cleanupExpiredOAuthData(
  orm: OrmLike,
  retentionHours = 24
): Promise<{ 
  sessionsDeleted: number; 
  tokensDeleted: number; 
  requestTokensDeleted: number; 
}> {
  const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

  try {
    // Clean up expired authorization sessions
    const expiredSessions = await orm.findMany('generic_oauth_authorization_sessions', {
      where: (b: any) => b('expires_at', '<', cutoffTime),
      limit: 100,
    });

    let sessionsDeleted = 0;
    for (const session of expiredSessions) {
      await orm.delete('generic_oauth_authorization_sessions', {
        where: (b: any) => b('id', '=', session.id),
      });
      sessionsDeleted++;
    }

    // Clean up expired tokens (only those without refresh tokens)
    const expiredTokens = await orm.findMany('generic_oauth_connections', {
      where: (b: any) => b('expires_at', '<', cutoffTime)
        .and(b('refresh_token_encrypted', 'is', null)),
      limit: 100,
    });

    let tokensDeleted = 0;
    for (const token of expiredTokens) {
      await orm.delete('generic_oauth_connections', {
        where: (b: any) => b('id', '=', token.id),
      });
      tokensDeleted++;
    }

    // Clean up expired OAuth 1.0a request tokens
    const expiredRequestTokens = await orm.findMany('generic_oauth1_request_tokens', {
      where: (b: any) => b('expires_at', '<', cutoffTime),
      limit: 100,
    });

    let requestTokensDeleted = 0;
    for (const requestToken of expiredRequestTokens) {
      await orm.delete('generic_oauth1_request_tokens', {
        where: (b: any) => b('id', '=', requestToken.id),
      });
      requestTokensDeleted++;
    }

    return { sessionsDeleted, tokensDeleted, requestTokensDeleted };
  } catch (error) {
    console.error('Error cleaning up expired OAuth data:', error);
    return { sessionsDeleted: 0, tokensDeleted: 0, requestTokensDeleted: 0 };
  }
}

/**
 * Discover OAuth provider configuration from well-known endpoint
 */
export async function discoverOAuthProvider(
  discoveryUrl: string
): Promise<OAuthProviderDiscovery> {
  // This would make an HTTP request in a real implementation
  // For protocol-agnostic design, this is a placeholder that would be implemented
  // by the transport layer (HTTP adapter)
  throw new Error('Provider discovery requires HTTP transport implementation');
}

/**
 * Validate OAuth token with provider
 */
export async function validateTokenWithProvider(
  token: string,
  provider: GenericOAuthProvider
): Promise<TokenValidationResult> {
  // This would make an HTTP request to the provider's token validation endpoint
  // For protocol-agnostic design, this is a placeholder
  throw new Error('Token validation requires HTTP transport implementation');
}