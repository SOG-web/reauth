// Main OAuth plugin
export { 
  baseOAuthPluginV2,
  createOAuthPlugin,
  type OAuthConfigV2,
} from './plugin.v2';

// OAuth types
export type {
  OAuthProviderConfig,
  OAuthUserProfile,
  OAuthTokenResponse,
  OAuthState,
} from './types';

// OAuth schema
export { oauthSchemaV2 } from './schema.v2';

// OAuth utilities
export {
  generateOAuthState,
  validateOAuthState,
  hashOAuthToken,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  fetchOAuthUserProfile,
  refreshOAuthToken,
  getOAuthProvider,
  storeOAuthTokens,
  storeOAuthProfile,
} from './utils';

// Individual steps (for advanced customization)
export { initiateOAuthStep } from './steps/initiate-oauth.step';
export { callbackOAuthStep } from './steps/callback-oauth.step';
export { linkOAuthStep } from './steps/link-oauth.step';
export { unlinkOAuthStep } from './steps/unlink-oauth.step';
export { refreshTokenStep } from './steps/refresh-token.step';
export { getProfileStep } from './steps/get-profile.step';

// Provider-specific plugins
export { createGoogleOAuthPlugin, type GoogleOAuthConfig } from './providers/google';
export { createGitHubOAuthPlugin, type GitHubOAuthConfig } from './providers/github';

// Default export
export { baseOAuthPluginV2 as default } from './plugin.v2';