/**
 * OIDC Discovery Document Step V2
 * Implements OpenID Connect Discovery 1.0 specification
 */

import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../types.v2';
import type { OIDCProviderConfigV2 } from '../types';
import { createDiscoveryDocument } from '../utils';

// Input schema for discovery document request
const getDiscoveryDocumentInputSchema = type({
  baseUrl: 'string',
});

// Output schema for discovery document response
const getDiscoveryDocumentOutputSchema = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  discoveryDocument: 'unknown', // Will contain the full discovery document
});

/**
 * Get OIDC Discovery Document Step
 * 
 * Generates and returns the OpenID Connect discovery document as defined by
 * OpenID Connect Discovery 1.0 specification. This endpoint provides metadata
 * about the OIDC provider's configuration.
 * 
 * @example
 * ```typescript
 * const result = await engine.executeStep('get-discovery-document', {
 *   baseUrl: 'https://auth.example.com'
 * });
 * 
 * console.log(result.discoveryDocument.issuer); // https://auth.example.com
 * ```
 */
export const getDiscoveryDocumentStep: AuthStepV2<
  typeof getDiscoveryDocumentInputSchema.infer,
  typeof getDiscoveryDocumentOutputSchema.infer,
  OIDCProviderConfigV2,
  OrmLike
> = {
  name: 'get-discovery-document',
  validationSchema: getDiscoveryDocumentInputSchema,
  inputs: ['baseUrl'],
  outputs: getDiscoveryDocumentOutputSchema,
  protocol: {
    type: 'oidc-provider.get-discovery-document',
    description: 'Get OIDC discovery document',
    method: 'GET',
    path: '/.well-known/openid-configuration',
  },

  async run(input, ctx) {
    const { baseUrl } = input;
    const oidcConfig = ctx.config as OIDCProviderConfigV2;

    try {
      // Generate the discovery document based on configuration
      const discoveryDocument = createDiscoveryDocument(oidcConfig, baseUrl);

      return {
        success: true,
        status: 'discovery_retrieved',
        message: 'OIDC discovery document retrieved successfully',
        discoveryDocument,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        status: 'error',
        message: `Failed to generate discovery document: ${errorMessage}`,
        discoveryDocument: null,
      };
    }
  },
};