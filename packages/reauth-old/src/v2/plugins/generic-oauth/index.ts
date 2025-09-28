/**
 * Generic OAuth Plugin V2 for ReAuth
 * 
 * Comprehensive OAuth 2.0 and OAuth 1.0a authentication plugin with security features.
 * Protocol-agnostic, platform-agnostic, and runtime-agnostic implementation.
 */

// Main plugin exports
export { 
  baseGenericOAuthPluginV2, 
  createGenericOAuthPlugin,
  type GenericOAuthConfigV2,
} from './plugin.v2';

// Type exports
export type {
  OAuthVersion,
  OAuth1SignatureMethod,
  ProfileMapping,
  GenericOAuthProvider,
  SecuritySettings,
  TokenSettings,
  CleanupSettings,
  OAuthUserProfile,
  OAuthConnection,
  OAuthAuthorizationSession,
  OAuth1RequestToken,
  OAuthProviderDiscovery,
  TokenValidationResult,
} from './types';

// Schema export
export { genericOauthSchemaV2 } from './schema.v2';

// Utility exports
export {
  CrossPlatformCrypto,
  generateOAuthState,
  generatePKCE,
  buildOAuth2AuthorizationUrl,
  OAuth1SignatureGenerator,
  buildOAuth1AuthorizationUrl,
  parseUserProfile,
  TokenEncryption,
  validateOAuthState,
  cleanupExpiredOAuthData,
} from './utils';

// Step exports
export { beginOAuth2AuthorizationStep } from './steps/begin-oauth2-authorization.step';
export { completeOAuth2AuthorizationStep } from './steps/complete-oauth2-authorization.step';
export { refreshOAuth2TokenStep } from './steps/refresh-oauth2-token.step';
export { beginOAuth1AuthorizationStep } from './steps/begin-oauth1-authorization.step';
export { getUserProfileStep } from './steps/get-user-profile.step';
export { disconnectOAuthStep } from './steps/disconnect-oauth.step';

// Default plugin export
export default baseGenericOAuthPluginV2;