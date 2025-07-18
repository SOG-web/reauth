// OAuth Plugin Factory and Utilities
export {
  createOAuthPlugin,
  defaultUserInfoFetchers,
  type BaseOAuthConfig,
  type OAuthUserInfo,
  type OAuthProviderType,
  type OAuthClientFactory,
} from './utils/oauth-plugin-factory';

// OAuth Providers
export {
  googleOAuthPlugin,
  type GoogleOAuthConfig,
} from './google-oauth.plugin';
export {
  facebookOAuthPlugin,
  type FacebookOAuthConfig,
} from './facebook-oauth.plugin';
export {
  githubOAuthPlugin,
  type GitHubOAuthConfig,
} from './github-oauth.plugin';
export {
  linkedinOAuthPlugin,
  type LinkedInOAuthConfig,
} from './linkedin-oauth.plugin';
export {
  discordOAuthPlugin,
  type DiscordOAuthConfig,
} from './discord-oauth.plugin';
export { auth0OAuthPlugin, type Auth0OAuthConfig } from './auth0-oauth.plugin';
export {
  spotifyOAuthPlugin,
  type SpotifyOAuthConfig,
} from './spotify-oauth.plugin';
export {
  microsoftOAuthPlugin,
  type MicrosoftOAuthConfig,
} from './microsoft-oauth.plugin';
export {
  twitterOAuthPlugin,
  type TwitterOAuthConfig,
} from './twitter-oauth.plugin';
export {
  twitchOAuthPlugin,
  type TwitchOAuthConfig,
} from './twitch-oauth.plugin';
export { appleOAuthPlugin, type AppleOAuthConfig } from './apple-oauth.plugin';
export {
  workosOAuthPlugin,
  type WorkOSOAuthConfig,
} from './workos-oauth.plugin';
export {
  redditOAuthPlugin,
  type RedditOAuthConfig,
} from './reddit-oauth.plugin';

// Import for re-export object
import {
  createOAuthPlugin,
  defaultUserInfoFetchers,
} from './utils/oauth-plugin-factory';
import googleOAuthPlugin from './google-oauth.plugin';
import facebookOAuthPlugin from './facebook-oauth.plugin';
import githubOAuthPlugin from './github-oauth.plugin';
import linkedinOAuthPlugin from './linkedin-oauth.plugin';
import discordOAuthPlugin from './discord-oauth.plugin';
import auth0OAuthPlugin from './auth0-oauth.plugin';
import spotifyOAuthPlugin from './spotify-oauth.plugin';
import microsoftOAuthPlugin from './microsoft-oauth.plugin';
import twitterOAuthPlugin from './twitter-oauth.plugin';
import twitchOAuthPlugin from './twitch-oauth.plugin';
import appleOAuthPlugin from './apple-oauth.plugin';
import workosOAuthPlugin from './workos-oauth.plugin';
import redditOAuthPlugin from './reddit-oauth.plugin';

// Re-export everything as a default object for convenience
export default {
  // Factory
  createOAuthPlugin,
  defaultUserInfoFetchers,

  // Providers
  google: googleOAuthPlugin,
  facebook: facebookOAuthPlugin,
  github: githubOAuthPlugin,
  linkedin: linkedinOAuthPlugin,
  discord: discordOAuthPlugin,
  auth0: auth0OAuthPlugin,
  spotify: spotifyOAuthPlugin,
  microsoft: microsoftOAuthPlugin,
  twitter: twitterOAuthPlugin,
  twitch: twitchOAuthPlugin,
  apple: appleOAuthPlugin,
  workos: workosOAuthPlugin,
  reddit: redditOAuthPlugin,
};
