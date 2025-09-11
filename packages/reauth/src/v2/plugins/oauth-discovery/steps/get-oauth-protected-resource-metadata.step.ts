/**
 * OAuth Protected Resource Metadata Step V2
 *
 * Generates OAuth 2.0 Protected Resource Metadata per RFC 8693
 * Returns protocol-agnostic data object (no HTTP responses)
 */

import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type {
  OAuthDiscoveryConfigV2,
  OAuthProtectedResourceMetadata,
} from '../types';

export type GetOAuthProtectedResourceMetadataInput = {
  resource?: string;
  authorizationServers?: string[];
  scopes?: string[];
  bearerMethods?: string[];
  resourceDocumentation?: string;
};

export type GetOAuthProtectedResourceMetadataOutput = {
  success: true;
  metadata: OAuthProtectedResourceMetadata;
};

const getOAuthProtectedResourceMetadataValidation = type({
  'resource?': 'string',
  'authorizationServers?': 'string[]',
  'scopes?': 'string[]',
  'bearerMethods?': 'string[]',
  'resourceDocumentation?': 'string',
});

export const getOAuthProtectedResourceMetadataStep: AuthStepV2<
  GetOAuthProtectedResourceMetadataInput,
  GetOAuthProtectedResourceMetadataOutput,
  OAuthDiscoveryConfigV2
> = {
  name: 'get-oauth-protected-resource-metadata',
  description: 'Generate OAuth 2.0 Protected Resource Metadata per RFC 8693',
  validationSchema: getOAuthProtectedResourceMetadataValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200 },
    },
  },
  inputs: [
    'resource',
    'authorizationServers',
    'scopes',
    'bearerMethods',
    'resourceDocumentation',
  ],
  outputs: type({
    success: 'true',
    metadata: 'object',
  }),

  async run(input, ctx) {
    // Merge input with plugin config, with input taking precedence
    const config = { ...(ctx.config || {}), ...(input || {}) };

    const metadata: OAuthProtectedResourceMetadata = {
      resource: config.resource || config.issuer,
      authorization_servers: config.authorizationServers || [config.issuer],
      scopes_supported: config.scopes || ['read', 'write', 'admin'],
      bearer_methods_supported: config.bearerMethods || [
        'header',
        'body',
        'query',
      ],
    };

    if (config.resourceDocumentation) {
      metadata.resource_documentation = config.resourceDocumentation;
    }

    return {
      success: true as const,
      metadata,
    };
  },
};
