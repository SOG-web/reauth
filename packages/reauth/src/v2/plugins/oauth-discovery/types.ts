/**
 * OAuth Discovery Plugin Types V2
 *
 * Provides OAuth 2.0 discovery metadata functionality as preparation for advanced OIDC auth plugins.
 * This plugin is protocol/framework/runtime agnostic and returns plain objects.
 */

export interface OAuthDiscoveryConfigV2 {
  /**
   * The issuer identifier for the OAuth 2.0 authorization server
   */
  issuer: string;

  /**
   * Base URL for OAuth endpoints (defaults to issuer if not provided)
   */
  baseUrl?: string;

  /**
   * Supported OAuth 2.0 scopes
   */
  scopes?: string[];

  /**
   * Supported OAuth 2.0 response types
   */
  responseTypes?: string[];

  /**
   * Supported OAuth 2.0 grant types
   */
  grantTypes?: string[];

  /**
   * Supported token endpoint authentication methods
   */
  tokenEndpointAuthMethods?: string[];

  /**
   * Supported UI locales
   */
  uiLocales?: string[];

  /**
   * Service documentation URL
   */
  serviceDocumentation?: string;

  /**
   * Whether to include JWKS URI in discovery metadata
   */
  includeJwksUri?: boolean;

  /**
   * Whether to include userinfo endpoint in discovery metadata
   */
  includeUserinfoEndpoint?: boolean;

  /**
   * Custom metadata to include in discovery response
   */
  customMetadata?: Record<string, any>;
}

export interface OAuthDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  service_documentation?: string;
  ui_locales_supported?: string[];
  [key: string]: any; // Allow custom metadata
}

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
}

export interface OAuthProtectedResourceConfigV2 {
  /**
   * The protected resource identifier
   */
  resource: string;

  /**
   * List of authorization servers that can issue tokens for this resource
   */
  authorizationServers?: string[];

  /**
   * Scopes supported by this protected resource
   */
  scopes?: string[];

  /**
   * Bearer token methods supported (header, body, query)
   */
  bearerMethods?: string[];

  /**
   * Resource documentation URL
   */
  resourceDocumentation?: string;
}
