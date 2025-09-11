/**
 * Single Sign-On (SSO) Plugin V2 - Index
 * Exports the SSO plugin and related types
 */

export { default as singleSignOnPluginV2, baseSingleSignOnPluginV2 } from './plugin.v2';
export type { SingleSignOnConfigV2 } from './types';
export { singleSignOnSchemaV2 } from './schema.v2';

// Export utility classes for advanced usage
export { CrossPlatformCrypto } from './utils/crypto';
export { CrossPlatformXml } from './utils/xml';
export { SamlUtils } from './utils/saml';
export { OidcUtils } from './utils/oidc';

// Export cleanup utilities
export { 
  cleanupAllSsoEntities,
  cleanupExpiredAssertions,
  cleanupExpiredSsoSessions,
  cleanupExpiredFederatedSessions,
  cleanupCompletedSsoRequests,
  cleanupCompletedLogoutRequests,
} from './utils/cleanup';