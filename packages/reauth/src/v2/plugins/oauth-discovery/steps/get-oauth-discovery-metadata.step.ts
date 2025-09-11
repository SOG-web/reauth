/**
 * OAuth Discovery Metadata Step V2
 * 
 * Generates OAuth 2.0 Authorization Server Metadata per RFC 8414
 * Returns protocol-agnostic data object (no HTTP responses)
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { OAuthDiscoveryConfigV2, OAuthDiscoveryMetadata } from '../types';

export type GetOAuthDiscoveryMetadataInput = {
  issuer?: string;
  baseUrl?: string;
  scopes?: string[];
  responseTypes?: string[];
  grantTypes?: string[];
  tokenEndpointAuthMethods?: string[];
  uiLocales?: string[];
  serviceDocumentation?: string;
  includeJwksUri?: boolean;
  includeUserinfoEndpoint?: boolean;
  customMetadata?: Record<string, any>;
};

export type GetOAuthDiscoveryMetadataOutput = {
  success: true;
  metadata: OAuthDiscoveryMetadata;
};

const getOAuthDiscoveryMetadataValidation = type({
  'issuer?': 'string',
  'baseUrl?': 'string',
  'scopes?': 'string[]',
  'responseTypes?': 'string[]',
  'grantTypes?': 'string[]',
  'tokenEndpointAuthMethods?': 'string[]',
  'uiLocales?': 'string[]',
  'serviceDocumentation?': 'string',
  'includeJwksUri?': 'boolean',
  'includeUserinfoEndpoint?': 'boolean',
  'customMetadata?': 'object',
});

export const getOAuthDiscoveryMetadataStep: AuthStepV2<
  GetOAuthDiscoveryMetadataInput,
  GetOAuthDiscoveryMetadataOutput,
  OAuthDiscoveryConfigV2
> = {
  name: 'get-oauth-discovery-metadata',
  description: 'Generate OAuth 2.0 Authorization Server Metadata per RFC 8414',
  validationSchema: getOAuthDiscoveryMetadataValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200 },
    },
  },
  inputs: ['issuer', 'baseUrl', 'scopes', 'responseTypes', 'grantTypes', 'tokenEndpointAuthMethods', 'uiLocales', 'serviceDocumentation', 'includeJwksUri', 'includeUserinfoEndpoint', 'customMetadata'],
  outputs: type({
    success: 'true',
    metadata: 'object',
  }),
  
  async run(input, ctx) {
    // Merge input with plugin config, with input taking precedence
    const config = { ...(ctx.config || {}), ...(input || {}) };
    
    const baseUrl = config.baseUrl || config.issuer;
    
    const metadata: OAuthDiscoveryMetadata = {
      issuer: config.issuer,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      scopes_supported: config.scopes || [
        'openid',
        'profile',
        'email',
        'offline_access'
      ],
      response_types_supported: config.responseTypes || [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token'
      ],
      grant_types_supported: config.grantTypes || [
        'authorization_code',
        'client_credentials',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code'
      ],
      token_endpoint_auth_methods_supported: config.tokenEndpointAuthMethods || [
        'client_secret_basic',
        'client_secret_post',
        'private_key_jwt',
        'client_secret_jwt'
      ],
      ui_locales_supported: config.uiLocales || ['en']
    };
    
    // Add optional endpoints if configured
    if (config.includeUserinfoEndpoint !== false) {
      metadata.userinfo_endpoint = `${baseUrl}/oauth/userinfo`;
    }
    
    if (config.includeJwksUri !== false) {
      metadata.jwks_uri = `${baseUrl}/.well-known/jwks.json`;
    }
    
    if (config.serviceDocumentation) {
      metadata.service_documentation = config.serviceDocumentation;
    }
    
    // Add custom metadata if provided
    if (config.customMetadata && typeof config.customMetadata === 'object') {
      Object.assign(metadata, config.customMetadata);
    }
    
    return {
      success: true as const,
      metadata
    };
  }
};