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
export { createFacebookOAuthPlugin, type FacebookOAuthConfig } from './providers/facebook';
export { createDiscordOAuthPlugin, type DiscordOAuthConfig } from './providers/discord';
export { createMicrosoftOAuthPlugin, type MicrosoftOAuthConfig } from './providers/microsoft';
export { createAppleOAuthPlugin, type AppleOAuthConfig } from './providers/apple';
export { createAuth0OAuthPlugin, type Auth0OAuthConfig } from './providers/auth0';
export { createLinkedInOAuthPlugin, type LinkedInOAuthConfig } from './providers/linkedin';
export { createRedditOAuthPlugin, type RedditOAuthConfig } from './providers/reddit';
export { createSpotifyOAuthPlugin, type SpotifyOAuthConfig } from './providers/spotify';
export { createTwitchOAuthPlugin, type TwitchOAuthConfig } from './providers/twitch';
export { createTwitterOAuthPlugin, type TwitterOAuthConfig } from './providers/twitter';
export { createWorkOSOAuthPlugin, type WorkOSOAuthConfig } from './providers/workos';

// Default export
export { baseOAuthPluginV2 as default } from './plugin.v2';