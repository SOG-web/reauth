/**
 * OIDC Federation Utility Functions for SSO Plugin V2
 * Protocol-agnostic OIDC processing utilities
 */

import { CrossPlatformCrypto } from './crypto';
import type { SingleSignOnConfigV2 } from '../types';

/**
 * OIDC utilities class
 */
export class OidcUtils {
  /**
   * Generate OIDC authorization URL with PKCE
   */
  static async generateAuthorizationUrl(options: {
    providerId: string;
    config: SingleSignOnConfigV2;
    state?: string;
    nonce?: string;
    scopes?: string[];
  }): Promise<{
    authorizationUrl: string;
    state: string;
    nonce: string;
    codeVerifier?: string;
  }> {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.oidc) {
      throw new Error(`OIDC provider not found: ${options.providerId}`);
    }

    // Generate state and nonce if not provided
    const state = options.state || await CrossPlatformCrypto.randomString(32);
    const nonce = options.nonce || await CrossPlatformCrypto.randomString(32);
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = await CrossPlatformCrypto.randomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: provider.oidc.responseType || 'code',
      client_id: provider.oidc.clientId,
      redirect_uri: options.config.serviceProvider.assertionConsumerServiceUrl,
      scope: (options.scopes || provider.oidc.scopes).join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Discover authorization endpoint if needed
    let authorizationEndpoint: string;
    if (provider.oidc.discoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(provider.oidc.discoveryUrl);
      authorizationEndpoint = discovery.authorization_endpoint;
    } else {
      // Assume it's configured in the issuer + /auth or similar
      authorizationEndpoint = `${provider.oidc.issuer}/auth`;
    }

    const authorizationUrl = `${authorizationEndpoint}?${params.toString()}`;

    return {
      authorizationUrl,
      state,
      nonce,
      codeVerifier,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(options: {
    code: string;
    codeVerifier: string;
    providerId: string;
    config: SingleSignOnConfigV2;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    idToken: string;
    expiresIn: number;
  }> {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.oidc) {
      throw new Error(`OIDC provider not found: ${options.providerId}`);
    }

    // Discover token endpoint if needed
    let tokenEndpoint: string;
    if (provider.oidc.discoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(provider.oidc.discoveryUrl);
      tokenEndpoint = discovery.token_endpoint;
    } else {
      tokenEndpoint = `${provider.oidc.issuer}/token`;
    }

    const tokenRequest = {
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.config.serviceProvider.assertionConsumerServiceUrl,
      client_id: provider.oidc.clientId,
      client_secret: provider.oidc.clientSecret,
      code_verifier: options.codeVerifier,
    };

    // This would normally be an HTTP request
    // Since we're protocol-agnostic, we'll return a placeholder structure
    // In a real implementation, this would use the transport layer
    throw new Error('Token exchange requires transport layer implementation');
  }

  /**
   * Validate and parse ID token (JWT)
   */
  static async validateIdToken(options: {
    idToken: string;
    providerId: string;
    config: SingleSignOnConfigV2;
    nonce?: string;
  }): Promise<{
    valid: boolean;
    claims: Record<string, any>;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const provider = options.config.identityProviders[options.providerId];
      if (!provider || !provider.oidc) {
        errors.push(`OIDC provider not found: ${options.providerId}`);
        return { valid: false, claims: {}, errors };
      }

      // Parse JWT
      const jwt = this.parseJwt(options.idToken);
      if (!jwt) {
        errors.push('Invalid JWT format');
        return { valid: false, claims: {}, errors };
      }

      // Validate issuer
      if (provider.security.validateIssuer && jwt.payload.iss !== provider.oidc.issuer) {
        errors.push(`Invalid issuer: expected ${provider.oidc.issuer}, got ${jwt.payload.iss}`);
      }

      // Validate audience
      if (provider.security.validateAudience) {
        const aud = Array.isArray(jwt.payload.aud) ? jwt.payload.aud : [jwt.payload.aud];
        if (!aud.includes(provider.oidc.clientId)) {
          errors.push(`Invalid audience: expected ${provider.oidc.clientId}`);
        }
      }

      // Validate expiration
      const now = Math.floor(Date.now() / 1000);
      const clockSkew = provider.security.clockSkewSeconds;

      if (jwt.payload.exp && (now - clockSkew) > jwt.payload.exp) {
        errors.push('Token has expired');
      }

      if (jwt.payload.nbf && (now + clockSkew) < jwt.payload.nbf) {
        errors.push('Token not yet valid');
      }

      if (jwt.payload.iat) {
        const maxAge = provider.security.maxAuthenticationAge;
        if (now - jwt.payload.iat > maxAge) {
          errors.push('Token too old');
        }
      }

      // Validate nonce if provided
      if (options.nonce && jwt.payload.nonce !== options.nonce) {
        errors.push('Invalid nonce');
      }

      // Validate signature (simplified - would need JWK validation)
      const signatureValid = await this.validateJwtSignature(
        options.idToken,
        provider.oidc.discoveryUrl || `${provider.oidc.issuer}/.well-known/openid_configuration`
      );

      if (!signatureValid) {
        errors.push('Invalid token signature');
      }

      return {
        valid: errors.length === 0,
        claims: jwt.payload,
        errors,
      };
    } catch (error) {
      errors.push(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, claims: {}, errors };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(options: {
    refreshToken: string;
    providerId: string;
    config: SingleSignOnConfigV2;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.oidc) {
      throw new Error(`OIDC provider not found: ${options.providerId}`);
    }

    // This would normally be an HTTP request to the token endpoint
    // Since we're protocol-agnostic, we'll return a placeholder structure
    throw new Error('Token refresh requires transport layer implementation');
  }

  /**
   * Parse JWT without validation
   */
  private static parseJwt(token: string): { header: any; payload: any; signature: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const header = JSON.parse(new TextDecoder().decode(CrossPlatformCrypto.base64UrlDecode(parts[0])));
      const payload = JSON.parse(new TextDecoder().decode(CrossPlatformCrypto.base64UrlDecode(parts[1])));
      const signature = parts[2];

      return { header, payload, signature };
    } catch {
      return null;
    }
  }

  /**
   * Validate JWT signature (simplified)
   */
  private static async validateJwtSignature(
    token: string,
    discoveryUrl: string
  ): Promise<boolean> {
    try {
      // In a full implementation, this would:
      // 1. Fetch JWK set from discovery document
      // 2. Find matching key by kid
      // 3. Verify signature using the public key
      
      // For now, return true as placeholder
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch OIDC discovery document
   */
  private static async fetchDiscoveryDocument(discoveryUrl: string): Promise<any> {
    // This would normally be an HTTP request
    // Since we're protocol-agnostic, we'll return a placeholder structure
    throw new Error('Discovery document fetch requires transport layer implementation');
  }

  /**
   * Generate PKCE code challenge
   */
  private static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const hash = await CrossPlatformCrypto.sha256(codeVerifier);
    return CrossPlatformCrypto.base64UrlEncode(hash);
  }

  /**
   * Extract user attributes from OIDC claims
   */
  static extractUserAttributes(
    claims: Record<string, any>,
    mapping: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [localKey, oidcKey] of Object.entries(mapping)) {
      if (claims[oidcKey] !== undefined) {
        result[localKey] = claims[oidcKey];
      }
    }

    // Standard OIDC claims mapping
    if (!result.userId && claims.sub) {
      result.userId = claims.sub;
    }
    if (!result.email && claims.email) {
      result.email = claims.email;
    }
    if (!result.firstName && claims.given_name) {
      result.firstName = claims.given_name;
    }
    if (!result.lastName && claims.family_name) {
      result.lastName = claims.family_name;
    }
    if (!result.displayName && claims.name) {
      result.displayName = claims.name;
    }

    return result;
  }

  /**
   * Generate OIDC logout URL
   */
  static generateLogoutUrl(options: {
    providerId: string;
    config: SingleSignOnConfigV2;
    idTokenHint?: string;
    postLogoutRedirectUri?: string;
    state?: string;
  }): string {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.oidc) {
      throw new Error(`OIDC provider not found: ${options.providerId}`);
    }

    const params = new URLSearchParams();
    
    if (options.idTokenHint) {
      params.set('id_token_hint', options.idTokenHint);
    }
    
    if (options.postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', options.postLogoutRedirectUri);
    }
    
    if (options.state) {
      params.set('state', options.state);
    }

    // Assume logout endpoint follows standard pattern
    const logoutEndpoint = `${provider.oidc.issuer}/logout`;
    
    return `${logoutEndpoint}?${params.toString()}`;
  }
}