/**
 * SAML 2.0 Utility Functions for SSO Plugin V2
 * Protocol-agnostic SAML processing utilities
 */

import { CrossPlatformCrypto } from './crypto';
import { CrossPlatformXml, type XmlNode } from './xml';
import type { SingleSignOnConfigV2 } from '../types';

/**
 * SAML utilities class
 */
export class SamlUtils {
  /**
   * Generate SAML AuthnRequest
   */
  static async generateAuthnRequest(options: {
    providerId: string;
    config: SingleSignOnConfigV2;
    relayState?: string;
    forceAuthn?: boolean;
    isPassive?: boolean;
  }): Promise<{
    requestId: string;
    samlRequest: string;
    relayState?: string;
  }> {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.saml) {
      throw new Error(`SAML provider not found: ${options.providerId}`);
    }

    const requestId = await CrossPlatformCrypto.generateId('SAML_');
    const issueInstant = CrossPlatformCrypto.generateTimestamp();

    const authnRequestXml = CrossPlatformXml.createSamlAuthnRequest({
      requestId,
      issueInstant,
      issuer: options.config.serviceProvider.entityId,
      assertionConsumerServiceURL: options.config.serviceProvider.assertionConsumerServiceUrl,
      destination: provider.saml.singleSignOnServiceUrl,
      nameIdFormat: provider.saml.nameIdFormat || options.config.serviceProvider.nameIdFormat,
      forceAuthn: options.forceAuthn,
      isPassive: options.isPassive,
    });

    // Sign the request if configured
    let finalXml = authnRequestXml;
    if (options.config.serviceProvider.signRequests) {
      finalXml = await this.signSamlRequest(authnRequestXml, options.config);
    }

    // Base64 encode the request
    const samlRequest = this.base64EncodeXml(finalXml);

    return {
      requestId,
      samlRequest,
      relayState: options.relayState,
    };
  }

  /**
   * Generate SAML LogoutRequest
   */
  static async generateLogoutRequest(options: {
    providerId: string;
    nameId: string;
    sessionIndex?: string;
    config: SingleSignOnConfigV2;
    relayState?: string;
  }): Promise<{
    logoutId: string;
    samlRequest: string;
    relayState?: string;
  }> {
    const provider = options.config.identityProviders[options.providerId];
    if (!provider || !provider.saml) {
      throw new Error(`SAML provider not found: ${options.providerId}`);
    }

    const logoutId = await CrossPlatformCrypto.generateId('LOGOUT_');
    const issueInstant = CrossPlatformCrypto.generateTimestamp();

    const logoutRequestXml = CrossPlatformXml.createSamlLogoutRequest({
      requestId: logoutId,
      issueInstant,
      issuer: options.config.serviceProvider.entityId,
      destination: provider.saml.singleLogoutServiceUrl,
      nameId: options.nameId,
      nameIdFormat: provider.saml.nameIdFormat,
      sessionIndex: options.sessionIndex,
    });

    // Sign the request if configured
    let finalXml = logoutRequestXml;
    if (options.config.serviceProvider.signRequests) {
      finalXml = await this.signSamlRequest(logoutRequestXml, options.config);
    }

    // Base64 encode the request
    const samlRequest = this.base64EncodeXml(finalXml);

    return {
      logoutId,
      samlRequest,
      relayState: options.relayState,
    };
  }

  /**
   * Validate and parse SAML Response
   */
  static async validateSamlResponse(options: {
    samlResponse: string;
    providerId: string;
    config: SingleSignOnConfigV2;
    requestId?: string;
  }): Promise<{
    valid: boolean;
    nameId?: string;
    sessionIndex?: string;
    attributes: Record<string, string[]>;
    authInstant?: string;
    expiresAt?: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Decode the SAML response
      const responseXml = this.base64DecodeXml(options.samlResponse);
      const response = CrossPlatformXml.parseSamlResponse(responseXml);

      const provider = options.config.identityProviders[options.providerId];
      if (!provider || !provider.saml) {
        errors.push(`SAML provider not found: ${options.providerId}`);
        return { valid: false, attributes: {}, errors };
      }

      // Validate status code
      if (response.statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        errors.push(`SAML Response status not successful: ${response.statusCode}`);
        return { valid: false, attributes: {}, errors };
      }

      // Validate issuer
      if (provider.security.validateIssuer && response.issuer !== provider.saml.entityId) {
        errors.push(`Invalid issuer: expected ${provider.saml.entityId}, got ${response.issuer}`);
      }

      if (!response.assertion) {
        errors.push('No assertion found in SAML response');
        return { valid: false, attributes: {}, errors };
      }

      // Validate assertion
      const assertionValidation = await this.validateAssertion({
        assertion: response.assertion,
        provider,
        config: options.config,
      });

      if (!assertionValidation.valid) {
        errors.push(...assertionValidation.errors);
      }

      return {
        valid: errors.length === 0 && assertionValidation.valid,
        nameId: response.nameId,
        sessionIndex: response.sessionIndex,
        attributes: response.attributes,
        authInstant: assertionValidation.authInstant,
        expiresAt: assertionValidation.expiresAt,
        errors,
      };
    } catch (error) {
      errors.push(`Failed to validate SAML response: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, attributes: {}, errors };
    }
  }

  /**
   * Validate SAML assertion
   */
  private static async validateAssertion(options: {
    assertion: XmlNode;
    provider: any;
    config: SingleSignOnConfigV2;
  }): Promise<{
    valid: boolean;
    authInstant?: string;
    expiresAt?: string;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Validate audience
      if (options.provider.security.validateAudience) {
        const audienceNode = CrossPlatformXml.findNode(options.assertion, 'saml:Audience');
        if (audienceNode) {
          const audience = CrossPlatformXml.getTextContent(audienceNode);
          if (audience !== options.config.serviceProvider.entityId) {
            errors.push(`Invalid audience: expected ${options.config.serviceProvider.entityId}, got ${audience}`);
          }
        } else {
          errors.push('No audience found in assertion');
        }
      }

      // Validate time constraints
      const conditionsNode = CrossPlatformXml.findNode(options.assertion, 'saml:Conditions');
      if (conditionsNode) {
        const notBefore = CrossPlatformXml.getAttribute(conditionsNode, 'NotBefore');
        const notOnOrAfter = CrossPlatformXml.getAttribute(conditionsNode, 'NotOnOrAfter');

        const now = new Date();
        const clockSkew = options.provider.security.clockSkewSeconds * 1000;

        if (notBefore) {
          const notBeforeTime = new Date(notBefore).getTime();
          if (now.getTime() + clockSkew < notBeforeTime) {
            errors.push(`Assertion not yet valid (NotBefore: ${notBefore})`);
          }
        }

        if (notOnOrAfter) {
          const notOnOrAfterTime = new Date(notOnOrAfter).getTime();
          if (now.getTime() - clockSkew > notOnOrAfterTime) {
            errors.push(`Assertion expired (NotOnOrAfter: ${notOnOrAfter})`);
          }
        }
      }

      // Validate authentication instant
      const authnStatementNode = CrossPlatformXml.findNode(options.assertion, 'saml:AuthnStatement');
      let authInstant: string | undefined;
      let expiresAt: string | undefined;

      if (authnStatementNode) {
        authInstant = CrossPlatformXml.getAttribute(authnStatementNode, 'AuthnInstant');
        if (authInstant) {
          const maxAge = options.provider.security.maxAuthenticationAge * 1000;
          const authTime = new Date(authInstant).getTime();
          const now = Date.now();

          if (now - authTime > maxAge) {
            errors.push(`Authentication too old (AuthnInstant: ${authInstant})`);
          }

          // Calculate expiration based on assertion lifetime
          const lifetimeMs = options.config.security.assertionLifetime * 60 * 1000;
          expiresAt = new Date(authTime + lifetimeMs).toISOString();
        }
      }

      // Validate signature if required
      if (options.provider.security.validateSignature) {
        const signatureValid = await this.validateAssertionSignature(
          options.assertion,
          options.provider.saml.certificate
        );
        if (!signatureValid) {
          errors.push('Invalid assertion signature');
        }
      }

      return {
        valid: errors.length === 0,
        authInstant,
        expiresAt,
        errors,
      };
    } catch (error) {
      errors.push(`Assertion validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors };
    }
  }

  /**
   * Validate assertion signature (simplified)
   */
  private static async validateAssertionSignature(
    assertion: XmlNode,
    certificate: string
  ): Promise<boolean> {
    try {
      // Find signature node
      const signatureNode = CrossPlatformXml.findNode(assertion, 'ds:Signature');
      if (!signatureNode) {
        return false; // No signature found
      }

      // This would need a full XML signature validation implementation
      // For now, we'll return true if certificate is provided (placeholder)
      return Boolean(certificate);
    } catch {
      return false;
    }
  }

  /**
   * Sign SAML request (simplified)
   */
  private static async signSamlRequest(
    xml: string,
    config: SingleSignOnConfigV2
  ): Promise<string> {
    // Simplified signing - in a full implementation, this would:
    // 1. Calculate digest of the XML
    // 2. Create SignedInfo element
    // 3. Sign the SignedInfo with private key
    // 4. Insert signature into XML
    
    // For now, return the original XML (placeholder)
    return xml;
  }

  /**
   * Base64 encode XML
   */
  private static base64EncodeXml(xml: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(xml);
    return CrossPlatformCrypto.base64UrlEncode(bytes)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  }

  /**
   * Base64 decode XML
   */
  private static base64DecodeXml(encoded: string): string {
    const normalized = encoded.replace(/\+/g, '-').replace(/\//g, '_');
    const bytes = CrossPlatformCrypto.base64UrlDecode(normalized);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Extract user attributes from SAML assertion
   */
  static extractUserAttributes(
    attributes: Record<string, string[]>,
    mapping: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [localKey, samlKey] of Object.entries(mapping)) {
      if (attributes[samlKey]) {
        const values = attributes[samlKey];
        if (localKey === 'groups' || localKey === 'roles') {
          result[localKey] = values; // Keep as array
        } else {
          result[localKey] = values[0]; // Use first value
        }
      }
    }

    return result;
  }

  /**
   * Generate redirect URL for SAML SSO
   */
  static buildSamlRedirectUrl(
    ssoUrl: string,
    samlRequest: string,
    relayState?: string
  ): string {
    const params = new URLSearchParams();
    params.set('SAMLRequest', samlRequest);
    
    if (relayState) {
      params.set('RelayState', relayState);
    }

    return `${ssoUrl}?${params.toString()}`;
  }
}