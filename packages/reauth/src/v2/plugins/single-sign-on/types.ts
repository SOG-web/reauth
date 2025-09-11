/**
 * Single Sign-On (SSO) Plugin V2 Types
 * Comprehensive types for SAML 2.0 and OIDC federation support
 */

export interface SingleSignOnConfigV2 {
  // Service Provider Configuration
  serviceProvider: {
    entityId: string; // SP entity identifier
    assertionConsumerServiceUrl: string;
    singleLogoutServiceUrl: string;
    certificate: string; // SP certificate for signing
    privateKey: string; // SP private key
    nameIdFormat: 'persistent' | 'transient' | 'emailAddress' | 'unspecified';
    signRequests: boolean;
    wantAssertionsSigned: boolean;
  };
  
  // Identity Providers
  identityProviders: Record<string, {
    // Provider Type
    type: 'saml' | 'oidc' | 'ws-federation' | 'cas';
    
    // SAML Configuration
    saml?: {
      entityId: string;
      singleSignOnServiceUrl: string;
      singleLogoutServiceUrl: string;
      certificate: string;
      nameIdFormat: string;
      signatureAlgorithm: 'RSA-SHA1' | 'RSA-SHA256';
      digestAlgorithm: 'SHA1' | 'SHA256';
    };
    
    // OIDC Configuration
    oidc?: {
      issuer: string;
      clientId: string;
      clientSecret: string;
      discoveryUrl: string;
      scopes: string[];
      responseType: string;
    };
    
    // Attribute Mapping
    attributeMapping: {
      userId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      groups?: string;
      roles?: string;
      customAttributes?: Record<string, string>;
    };
    
    // Security Settings
    security: {
      validateSignature: boolean;
      validateIssuer: boolean;
      validateAudience: boolean;
      clockSkewSeconds: number;
      maxAuthenticationAge: number;
    };
  }>;
  
  // Session Federation
  sessionFederation: {
    enabled: boolean;
    domains: string[]; // Trusted domains for session sharing
    cookieName: string;
    cookieDomain: string;
    cookieSecure: boolean;
    cookieSameSite: 'strict' | 'lax' | 'none';
    sessionTimeout: number; // Minutes
  };
  
  // Single Logout
  singleLogout: {
    enabled: boolean;
    propagateToAll: boolean; // Logout from all federated providers
    timeoutSeconds: number; // Timeout for logout requests
    retryAttempts: number;
  };
  
  // Security Settings
  security: {
    encryptAssertions: boolean;
    requireSignedRequests: boolean;
    allowUnsolicited: boolean; // Allow IdP-initiated SSO
    maxClockSkew: number; // Seconds
    assertionLifetime: number; // Minutes
  };
  
  // Cleanup Configuration
  cleanup?: {
    enabled: boolean;
    intervalMinutes: number;
    expiredAssertionRetentionHours: number;
    expiredSessionRetentionDays: number;
    logoutRequestRetentionHours: number;
  };
}

// Input/Output Types for Steps

// SAML Steps
export interface BeginSamlSsoInput {
  providerId: string;
  relayState?: string;
  forceAuthn?: boolean;
  isPassive?: boolean;
  nameIdPolicy?: string;
}

export interface BeginSamlSsoOutput {
  requestId: string;
  samlRequest: string; // Base64 encoded
  redirectUrl: string;
  relayState?: string;
}

export interface ProcessSamlResponseInput {
  samlResponse: string; // Base64 encoded
  relayState?: string;
  requestId?: string;
}

export interface ProcessSamlResponseOutput {
  userId: string;
  sessionId: string;
  userAttributes: Record<string, unknown>;
  nameId: string;
  sessionIndex?: string;
  authInstant: string;
  federatedSessionToken?: string;
}

export interface ValidateSamlAssertionInput {
  assertionXml: string;
  providerId: string;
  audience?: string;
}

export interface ValidateSamlAssertionOutput {
  valid: boolean;
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, unknown>;
  authInstant: string;
  expiresAt: string;
  errors?: string[];
}

// OIDC Steps
export interface BeginOidcFederationInput {
  providerId: string;
  state?: string;
  nonce?: string;
  scopes?: string[];
}

export interface BeginOidcFederationOutput {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier?: string;
}

export interface ProcessOidcCallbackInput {
  code: string;
  state: string;
  providerId: string;
  nonce?: string;
  codeVerifier?: string;
}

export interface ProcessOidcCallbackOutput {
  userId: string;
  sessionId: string;
  userAttributes: Record<string, unknown>;
  accessToken?: string;
  refreshToken?: string;
  expiresAt: string;
  federatedSessionToken?: string;
}

// Session Federation
export interface CreateFederatedSessionInput {
  userId: string;
  providerSessions: Record<string, any>;
  domains: string[];
}

export interface CreateFederatedSessionOutput {
  sessionToken: string;
  expiresAt: string;
  domains: string[];
}

export interface ValidateFederatedSessionInput {
  sessionToken: string;
  domain?: string;
}

export interface ValidateFederatedSessionOutput {
  valid: boolean;
  userId?: string;
  providerSessions?: Record<string, any>;
  expiresAt?: string;
}

// Provider Management
export interface RegisterIdentityProviderInput {
  name: string;
  type: 'saml' | 'oidc' | 'ws-federation' | 'cas';
  entityId: string;
  configuration: Record<string, any>;
  attributeMapping: Record<string, any>;
  securityConfig: Record<string, any>;
}

export interface RegisterIdentityProviderOutput {
  providerId: string;
  name: string;
  type: string;
  isActive: boolean;
}

// Attribute Mapping
export interface MapUserAttributesInput {
  attributes: Record<string, unknown>;
  providerId: string;
  mappingRules?: Record<string, string>;
}

export interface MapUserAttributesOutput {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
  roles?: string[];
  customAttributes?: Record<string, unknown>;
}

// Database Entity Types
export interface SsoIdentityProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'ws-federation' | 'cas';
  entity_id: string;
  configuration: Record<string, any>;
  attribute_mapping: Record<string, any>;
  security_config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SsoSession {
  id: string;
  user_id: string;
  provider_id: string;
  session_index?: string;
  name_id: string;
  name_id_format: string;
  assertion_id?: string;
  federated_session_id?: string;
  attributes: Record<string, any>;
  auth_instant: Date;
  expires_at: Date;
  logout_initiated: boolean;
  created_at: Date;
}

export interface SsoSamlAssertion {
  id: string;
  assertion_id: string;
  provider_id: string;
  user_id: string;
  name_id: string;
  session_index?: string;
  assertion_xml: string;
  signature_valid: boolean;
  issued_at: Date;
  expires_at: Date;
  consumed_at?: Date;
  created_at: Date;
}

export interface SsoRequest {
  id: string;
  request_id: string;
  provider_id: string;
  user_id?: string;
  request_type: 'auth' | 'logout';
  relay_state?: string;
  destination_url?: string;
  request_xml?: string;
  response_xml?: string;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  expires_at: Date;
  completed_at?: Date;
  created_at: Date;
}

export interface SsoFederatedSession {
  id: string;
  session_token: string;
  user_id: string;
  provider_sessions: Record<string, any>;
  domains: string[];
  created_at: Date;
  expires_at: Date;
  last_activity: Date;
}

export interface SsoLogoutRequest {
  id: string;
  logout_id: string;
  user_id: string;
  initiating_provider_id: string;
  target_providers: string[];
  relay_state?: string;
  status: 'pending' | 'completed' | 'failed';
  completed_providers: string[];
  failed_providers: string[];
  expires_at: Date;
  completed_at?: Date;
  created_at: Date;
}