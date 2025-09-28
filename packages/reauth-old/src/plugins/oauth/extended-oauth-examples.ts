// import { createReAuthEngine } from '../../auth-engine';
// import {
//   discordOAuthPlugin,
//   auth0OAuthPlugin,
//   spotifyOAuthPlugin,
//   microsoftOAuthPlugin,
//   twitterOAuthPlugin,
//   twitchOAuthPlugin,
//   appleOAuthPlugin,
//   workosOAuthPlugin,
//   redditOAuthPlugin,
//   type DiscordOAuthConfig,
//   type Auth0OAuthConfig,
//   type SpotifyOAuthConfig,
//   type MicrosoftOAuthConfig,
//   type TwitterOAuthConfig,
//   type TwitchOAuthConfig,
//   type AppleOAuthConfig,
//   type WorkOSOAuthConfig,
//   type RedditOAuthConfig,
// } from './index';
// import { KnexEntityService, KnexSessionService } from '../../services';
// import type { Knex } from 'knex';

// /**
//  * Example: Discord OAuth Configuration
//  */
// export function createDiscordOAuthExample() {
//   const discordConfig: DiscordOAuthConfig = {
//     clientId: process.env.DISCORD_CLIENT_ID!,
//     clientSecret: process.env.DISCORD_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/discord/callback',
//     scopes: ['identify', 'email', 'guilds'], // Custom scopes
//     usePKCE: false, // Use confidential client
//   };

//   return discordOAuthPlugin(discordConfig);
// }

// /**
//  * Example: Auth0 OAuth Configuration
//  */
// export function createAuth0OAuthExample() {
//   const auth0Config: Auth0OAuthConfig = {
//     domain: 'your-domain.auth0.com',
//     clientId: process.env.AUTH0_CLIENT_ID!,
//     clientSecret: process.env.AUTH0_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/auth0/callback',
//     scopes: ['openid', 'profile', 'email', 'offline_access'],
//     usePKCE: false, // Use confidential client
//   };

//   return auth0OAuthPlugin(auth0Config);
// }

// /**
//  * Example: Spotify OAuth Configuration
//  */
// export function createSpotifyOAuthExample() {
//   const spotifyConfig: SpotifyOAuthConfig = {
//     clientId: process.env.SPOTIFY_CLIENT_ID!,
//     clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/spotify/callback',
//     scopes: ['user-read-email', 'user-read-private', 'playlist-read-private'],
//     usePKCE: true, // Use public client for enhanced security
//   };

//   return spotifyOAuthPlugin(spotifyConfig);
// }

// /**
//  * Example: Microsoft OAuth Configuration
//  */
// export function createMicrosoftOAuthExample() {
//   const microsoftConfig: MicrosoftOAuthConfig = {
//     tenantId: 'common', // Multi-tenant
//     clientId: process.env.MICROSOFT_CLIENT_ID!,
//     clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/microsoft/callback',
//     scopes: ['openid', 'profile', 'email', 'User.Read', 'Files.Read'],
//   };

//   return microsoftOAuthPlugin(microsoftConfig);
// }

// /**
//  * Example: Twitter OAuth Configuration
//  */
// export function createTwitterOAuthExample() {
//   const twitterConfig: TwitterOAuthConfig = {
//     clientId: process.env.TWITTER_CLIENT_ID!,
//     clientSecret: process.env.TWITTER_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/twitter/callback',
//     scopes: ['tweet.read', 'users.read', 'follows.read'],
//   };

//   return twitterOAuthPlugin(twitterConfig);
// }

// /**
//  * Example: Twitch OAuth Configuration
//  */
// export function createTwitchOAuthExample() {
//   const twitchConfig: TwitchOAuthConfig = {
//     clientId: process.env.TWITCH_CLIENT_ID!,
//     clientSecret: process.env.TWITCH_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/twitch/callback',
//     scopes: ['user:read:email', 'channel:read:subscriptions'],
//   };

//   return twitchOAuthPlugin(twitchConfig);
// }

// /**
//  * Example: Apple OAuth Configuration
//  */
// export function createAppleOAuthExample() {
//   // Convert PEM private key to Uint8Array
//   const pemPrivateKey = process.env.APPLE_PRIVATE_KEY!;
//   const privateKeyString = pemPrivateKey
//     .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
//     .replace(/\n?-----END PRIVATE KEY-----/, '')
//     .replace(/\n/g, '');
//   const privateKey = new TextEncoder().encode(privateKeyString);

//   const appleConfig: AppleOAuthConfig = {
//     clientId: process.env.APPLE_CLIENT_ID!,
//     clientSecret: process.env.APPLE_CLIENT_SECRET!,
//     teamId: process.env.APPLE_TEAM_ID!,
//     keyId: process.env.APPLE_KEY_ID!,
//     privateKey: privateKey,
//     redirectUri: 'http://localhost:3000/auth/apple/callback',
//     scopes: ['name', 'email'],
//   };

//   return appleOAuthPlugin(appleConfig);
// }

// /**
//  * Example: WorkOS OAuth Configuration
//  */
// export function createWorkOSOAuthExample() {
//   const workosConfig: WorkOSOAuthConfig = {
//     clientId: process.env.WORKOS_CLIENT_ID!,
//     clientSecret: process.env.WORKOS_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/workos/callback',
//     scopes: ['openid', 'profile', 'email'],
//     usePKCE: false, // Use confidential client
//   };

//   return workosOAuthPlugin(workosConfig);
// }

// /**
//  * Example: Reddit OAuth Configuration
//  */
// export function createRedditOAuthExample() {
//   const redditConfig: RedditOAuthConfig = {
//     clientId: process.env.REDDIT_CLIENT_ID!,
//     clientSecret: process.env.REDDIT_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/reddit/callback',
//     scopes: ['identity', 'read'],
//   };

//   return redditOAuthPlugin(redditConfig);
// }

// /**
//  * Example: Complete Multi-Provider OAuth Setup
//  */
// export function createMultiProviderOAuthExample(database: Knex) {
//   const entityService = new KnexEntityService(database, 'entities');
//   const sessionService = new KnexSessionService(database, 'sessions');

//   const reAuth = createReAuthEngine({
//     plugins: [
//       // Traditional providers
//       createDiscordOAuthExample(),
//       createAuth0OAuthExample(),
//       createSpotifyOAuthExample(),
//       createMicrosoftOAuthExample(),

//       // Social media
//       createTwitterOAuthExample(),
//       createTwitchOAuthExample(),
//       createRedditOAuthExample(),

//       // Enterprise
//       createWorkOSOAuthExample(),

//       // Mobile
//       createAppleOAuthExample(),
//     ],
//     entity: entityService,
//     session: sessionService,
//   });

//   return reAuth;
// }

// /**
//  * Example: PKCE-enabled OAuth Providers
//  */
// export function createPKCEOAuthExample(database: Knex) {
//   const entityService = new KnexEntityService(database, 'entities');
//   const sessionService = new KnexSessionService(database, 'sessions');

//   // Enable PKCE for enhanced security
//   const spotifyPKCE = spotifyOAuthPlugin({
//     clientId: process.env.SPOTIFY_CLIENT_ID!,
//     clientSecret: '', // Empty string for public clients
//     redirectUri: 'http://localhost:3000/auth/spotify/callback',
//     usePKCE: true,
//   });

//   const discordPKCE = discordOAuthPlugin({
//     clientId: process.env.DISCORD_CLIENT_ID!,
//     clientSecret: '', // Empty string for public clients
//     redirectUri: 'http://localhost:3000/auth/discord/callback',
//     usePKCE: true,
//   });

//   const reAuth = createReAuthEngine({
//     plugins: [spotifyPKCE, discordPKCE],
//     entity: entityService,
//     session: sessionService,
//   });

//   return reAuth;
// }

// /**
//  * Custom User Info Handlers Example
//  */
// export function createCustomUserInfoExample() {
//   const discordWithCustomUserInfo = discordOAuthPlugin({
//     clientId: process.env.DISCORD_CLIENT_ID!,
//     clientSecret: process.env.DISCORD_CLIENT_SECRET!,
//     redirectUri: 'http://localhost:3000/auth/discord/callback',
//     getUserInfo: async (accessToken: string) => {
//       // Custom Discord API call
//       const response = await fetch('https://discord.com/api/users/@me', {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       });
//       const user = await response.json();

//       return {
//         id: user.id,
//         email: user.email,
//         name: user.username,
//         picture: user.avatar
//           ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
//           : undefined,
//         verified_email: user.verified,
//         // Add custom Discord-specific fields
//         discriminator: user.discriminator,
//         locale: user.locale,
//       };
//     },
//   });

//   return discordWithCustomUserInfo;
// }

// /**
//  * Environment Variables Guide
//  */
// export const REQUIRED_ENV_VARS = {
//   DISCORD: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
//   AUTH0: ['AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'],
//   SPOTIFY: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
//   MICROSOFT: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
//   TWITTER: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
//   TWITCH: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'],
//   APPLE: [
//     'APPLE_CLIENT_ID',
//     'APPLE_CLIENT_SECRET',
//     'APPLE_TEAM_ID',
//     'APPLE_KEY_ID',
//     'APPLE_PRIVATE_KEY', // PEM format
//   ],
//   WORKOS: ['WORKOS_CLIENT_ID', 'WORKOS_CLIENT_SECRET'],
//   REDDIT: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
// };
