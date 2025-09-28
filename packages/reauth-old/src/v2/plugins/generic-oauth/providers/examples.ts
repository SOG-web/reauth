/**
 * Generic OAuth Plugin V2 - Provider Examples
 * 
 * Pre-configured provider examples for popular OAuth services.
 */

import type { GenericOAuthProvider } from '../types';

/**
 * Google OAuth 2.0 Provider Configuration
 */
export const googleProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'google',
  version: '2.0',
  discoveryUrl: 'https://accounts.google.com/.well-known/openid_configuration',
  scopes: ['openid', 'email', 'profile'],
  profileMapping: {
    id: 'sub',
    email: 'email',
    name: 'name',
    avatar: 'picture',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * GitHub OAuth 2.0 Provider Configuration
 */
export const githubProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'github',
  version: '2.0',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['user:email'],
  profileMapping: {
    id: 'id',
    email: 'email',
    name: 'name',
    avatar: 'avatar_url',
  },
  headers: {
    'Accept': 'application/vnd.github.v3+json',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Facebook OAuth 2.0 Provider Configuration
 */
export const facebookProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'facebook',
  version: '2.0',
  authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
  userInfoUrl: 'https://graph.facebook.com/me',
  scopes: ['email', 'public_profile'],
  additionalParams: {
    fields: 'id,name,email,picture',
  },
  profileMapping: {
    id: 'id',
    email: 'email',
    name: 'name',
    avatar: 'picture.data.url',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Microsoft OAuth 2.0 Provider Configuration
 */
export const microsoftProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'microsoft',
  version: '2.0',
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  scopes: ['openid', 'email', 'profile'],
  profileMapping: {
    id: 'id',
    email: 'mail',
    name: 'displayName',
    avatar: 'photo', // Requires additional Graph API call
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Twitter OAuth 1.0a Provider Configuration
 */
export const twitterProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'twitter',
  version: '1.0a',
  requestTokenUrl: 'https://api.twitter.com/oauth/request_token',
  authorizationUrl: 'https://api.twitter.com/oauth/authorize',
  accessTokenUrl: 'https://api.twitter.com/oauth/access_token',
  userInfoUrl: 'https://api.twitter.com/1.1/account/verify_credentials.json',
  signatureMethod: 'HMAC-SHA1',
  profileMapping: {
    id: 'id_str',
    email: 'email', // Requires additional permission
    name: 'name',
    avatar: 'profile_image_url_https',
  },
  additionalParams: {
    include_email: 'true',
  },
  isActive: true,
};

/**
 * LinkedIn OAuth 2.0 Provider Configuration
 */
export const linkedinProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'linkedin',
  version: '2.0',
  authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  userInfoUrl: 'https://api.linkedin.com/v2/people/~',
  scopes: ['r_liteprofile', 'r_emailaddress'],
  profileMapping: {
    id: 'id',
    email: 'emailAddress', // Requires separate API call
    name: 'localizedFirstName',
    avatar: 'profilePicture.displayImage~.elements[0].identifiers[0].identifier',
  },
  headers: {
    'Accept': 'application/json',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Discord OAuth 2.0 Provider Configuration
 */
export const discordProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'discord',
  version: '2.0',
  authorizationUrl: 'https://discord.com/api/oauth2/authorize',
  tokenUrl: 'https://discord.com/api/oauth2/token',
  userInfoUrl: 'https://discord.com/api/users/@me',
  scopes: ['identify', 'email'],
  profileMapping: {
    id: 'id',
    email: 'email',
    name: 'username',
    avatar: 'avatar', // Needs to be constructed as CDN URL
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Spotify OAuth 2.0 Provider Configuration
 */
export const spotifyProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'spotify',
  version: '2.0',
  authorizationUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  userInfoUrl: 'https://api.spotify.com/v1/me',
  scopes: ['user-read-private', 'user-read-email'],
  profileMapping: {
    id: 'id',
    email: 'email',
    name: 'display_name',
    avatar: 'images[0].url',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * Apple OAuth 2.0 Provider Configuration
 */
export const appleProvider: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'> = {
  name: 'apple',
  version: '2.0',
  authorizationUrl: 'https://appleid.apple.com/auth/authorize',
  tokenUrl: 'https://appleid.apple.com/auth/token',
  // Apple doesn't have a userinfo endpoint, profile is included in ID token
  scopes: ['name', 'email'],
  additionalParams: {
    response_mode: 'form_post',
  },
  profileMapping: {
    id: 'sub',
    email: 'email',
    name: 'name.firstName',
  },
  pkce: true,
  state: true,
  isActive: true,
};

/**
 * All provider examples
 */
export const providerExamples = {
  google: googleProvider,
  github: githubProvider,
  facebook: facebookProvider,
  microsoft: microsoftProvider,
  twitter: twitterProvider,
  linkedin: linkedinProvider,
  discord: discordProvider,
  spotify: spotifyProvider,
  apple: appleProvider,
} as const;

/**
 * Helper function to create a complete provider configuration
 */
export function createProviderConfig(
  providerTemplate: Omit<GenericOAuthProvider, 'clientId' | 'clientSecret'>,
  credentials: { clientId: string; clientSecret: string }
): GenericOAuthProvider {
  return {
    ...providerTemplate,
    ...credentials,
  };
}

/**
 * Create Google OAuth provider with credentials
 */
export function createGoogleProvider(credentials: { clientId: string; clientSecret: string }): GenericOAuthProvider {
  return createProviderConfig(googleProvider, credentials);
}

/**
 * Create GitHub OAuth provider with credentials
 */
export function createGitHubProvider(credentials: { clientId: string; clientSecret: string }): GenericOAuthProvider {
  return createProviderConfig(githubProvider, credentials);
}

/**
 * Create Facebook OAuth provider with credentials
 */
export function createFacebookProvider(credentials: { clientId: string; clientSecret: string }): GenericOAuthProvider {
  return createProviderConfig(facebookProvider, credentials);
}

/**
 * Create Microsoft OAuth provider with credentials
 */
export function createMicrosoftProvider(credentials: { clientId: string; clientSecret: string }): GenericOAuthProvider {
  return createProviderConfig(microsoftProvider, credentials);
}

/**
 * Create Twitter OAuth provider with credentials
 */
export function createTwitterProvider(credentials: { clientId: string; clientSecret: string }): GenericOAuthProvider {
  return createProviderConfig(twitterProvider, credentials);
}