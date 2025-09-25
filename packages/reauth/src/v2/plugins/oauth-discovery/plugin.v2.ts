/**
 * OAuth Discovery Plugin V2
 *
 * Provides OAuth 2.0 discovery metadata functionality as preparation for advanced OIDC auth plugins.
 * This plugin is protocol/framework/runtime agnostic and returns plain data objects.
 *
 * Implements:
 * - RFC 8414: OAuth 2.0 Authorization Server Metadata
 * - RFC 8693: OAuth 2.0 Token Exchange (Protected Resource Metadata)
 */

import type { AuthPluginV2 } from '../../types.v2';
import type { OAuthDiscoveryConfigV2 } from './types';
export type {
  OAuthDiscoveryConfigV2,
  OAuthDiscoveryMetadata,
  OAuthProtectedResourceMetadata,
} from './types';
import { getOAuthDiscoveryMetadataStep } from './steps/get-oauth-discovery-metadata.step';
import { getOAuthProtectedResourceMetadataStep } from './steps/get-oauth-protected-resource-metadata.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

export const baseOAuthDiscoveryPluginV2: AuthPluginV2<OAuthDiscoveryConfigV2> =
  {
    name: 'oauth-discovery',
    initialize(_engine) {
      // OAuth discovery is stateless - no session resolvers needed
    },
    config: {
      issuer: 'http://localhost:3000',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      responseTypes: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token',
      ],
      grantTypes: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code',
      ],
      tokenEndpointAuthMethods: [
        'client_secret_basic',
        'client_secret_post',
        'private_key_jwt',
        'client_secret_jwt',
      ],
      uiLocales: ['en'],
      includeJwksUri: true,
      includeUserinfoEndpoint: true,
    },
    steps: [
      getOAuthDiscoveryMetadataStep,
      getOAuthProtectedResourceMetadataStep,
    ],
    async getProfile(_subjectId, _ctx) {
      // OAuth Discovery plugin is stateless and serves metadata only.
      // No user/subject-bound data is stored here.
      return {};
    },
  };

/**
 * Create OAuth Discovery Plugin V2 with custom configuration
 */
export function createOAuthDiscoveryPluginV2(
  config: Partial<OAuthDiscoveryConfigV2>,
): AuthPluginV2<OAuthDiscoveryConfigV2> {
  return createAuthPluginV2(baseOAuthDiscoveryPluginV2, { config });
}

/**
 * Default OAuth Discovery Plugin V2 with standard configuration
 */
const oAuthDiscoveryPluginV2: AuthPluginV2<OAuthDiscoveryConfigV2> =
  createOAuthDiscoveryPluginV2({});

export default oAuthDiscoveryPluginV2;
