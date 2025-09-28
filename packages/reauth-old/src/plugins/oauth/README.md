# OAuth Plugins for ReAuth

This directory contains OAuth plugins for various popular providers, built on top of [Arctic.js](https://arcticjs.dev/) - a collection of OAuth 2.0 clients for popular providers.

## Available Providers

### Social Media & Communication

- **Discord** - Discord OAuth with support for PKCE flow
- **Twitter/X** - Twitter OAuth for social media authentication
- **Reddit** - Reddit OAuth for social platform integration
- **Twitch** - Twitch OAuth for streaming platform authentication

### Business & Enterprise

- **Microsoft** - Microsoft Entra ID (Azure AD) OAuth with PKCE support
- **Auth0** - Auth0 OAuth with both confidential and public client support
- **WorkOS** - WorkOS OAuth for enterprise authentication
- **LinkedIn** - LinkedIn OAuth for professional networking

### Entertainment & Media

- **Spotify** - Spotify OAuth with PKCE support for music platform integration
- **Apple** - Apple OAuth for iOS and macOS applications

### Development & Tech

- **GitHub** - GitHub OAuth for developer platform authentication
- **Google** - Google OAuth with PKCE support

### General

- **Facebook** - Facebook OAuth for social platform integration

## Installation

The OAuth plugins are built on Arctic.js, which needs to be installed as a dependency:

```bash
npm install arctic
```

## Basic Usage

```typescript
import { createReAuthEngine } from '@re-auth/reauth';
import { googleOAuthPlugin, discordOAuthPlugin } from '@re-auth/reauth/plugins/oauth';

const reAuth = createReAuthEngine({
  plugins: [
    googleOAuthPlugin({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/google/callback',
    }),
    discordOAuthPlugin({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/discord/callback',
      scopes: ['identify', 'email', 'guilds'],
    }),
  ],
  entity: entityService,
  session: sessionService,
});
```

## Provider-Specific Configuration

### Discord OAuth

```typescript
import { discordOAuthPlugin, type DiscordOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const discordConfig: DiscordOAuthConfig = {
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  scopes: ['identify', 'email', 'guilds'], // Optional custom scopes
  usePKCE: false, // Set to true for public clients
};

const plugin = discordOAuthPlugin(discordConfig);
```

### Auth0 OAuth

```typescript
import { auth0OAuthPlugin, type Auth0OAuthConfig } from '@re-auth/reauth/plugins/oauth';

const auth0Config: Auth0OAuthConfig = {
  domain: 'your-domain.auth0.com', // Required: Auth0 domain
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/auth0/callback',
  scopes: ['openid', 'profile', 'email'], // Optional custom scopes
  usePKCE: false, // Set to true for public clients
};

const plugin = auth0OAuthPlugin(auth0Config);
```

### Spotify OAuth

```typescript
import { spotifyOAuthPlugin, type SpotifyOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const spotifyConfig: SpotifyOAuthConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID!,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/spotify/callback',
  scopes: ['user-read-email', 'user-read-private', 'playlist-read-private'],
  usePKCE: true, // Recommended for enhanced security
};

const plugin = spotifyOAuthPlugin(spotifyConfig);
```

### Microsoft OAuth

```typescript
import { microsoftOAuthPlugin, type MicrosoftOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const microsoftConfig: MicrosoftOAuthConfig = {
  tenantId: 'common', // 'common', 'organizations', 'consumers', or specific tenant ID
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

const plugin = microsoftOAuthPlugin(microsoftConfig);
```

### Apple OAuth

```typescript
import { appleOAuthPlugin, type AppleOAuthConfig } from '@re-auth/reauth/plugins/oauth';

// Convert PEM private key to Uint8Array
const pemPrivateKey = process.env.APPLE_PRIVATE_KEY!;
const privateKeyString = pemPrivateKey
  .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
  .replace(/\n?-----END PRIVATE KEY-----/, '')
  .replace(/\n/g, '');
const privateKey = new TextEncoder().encode(privateKeyString);

const appleConfig: AppleOAuthConfig = {
  clientId: process.env.APPLE_CLIENT_ID!,
  clientSecret: process.env.APPLE_CLIENT_SECRET!,
  teamId: process.env.APPLE_TEAM_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: privateKey, // Uint8Array format required
  redirectUri: 'http://localhost:3000/auth/apple/callback',
  scopes: ['name', 'email'],
};

const plugin = appleOAuthPlugin(appleConfig);
```

## PKCE Support

Several providers support PKCE (Proof Key for Code Exchange) for enhanced security, especially recommended for public clients:

```typescript
// Enable PKCE for Discord
const discordPKCE = discordOAuthPlugin({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: '', // Empty for public clients
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  usePKCE: true,
});

// Enable PKCE for Spotify
const spotifyPKCE = spotifyOAuthPlugin({
  clientId: process.env.SPOTIFY_CLIENT_ID!,
  clientSecret: '', // Empty for public clients
  redirectUri: 'http://localhost:3000/auth/spotify/callback',
  usePKCE: true,
});
```

## Custom User Info Handlers

You can provide custom functions to fetch user information from OAuth providers:

```typescript
const customDiscord = discordOAuthPlugin({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  getUserInfo: async (accessToken: string) => {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const user = await response.json();

    return {
      id: user.id,
      email: user.email,
      name: user.username,
      picture: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
      verified_email: user.verified,
      // Custom fields
      discriminator: user.discriminator,
      locale: user.locale,
    };
  },
});
```

## Required Environment Variables

### Discord

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

### Auth0

- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`

### Spotify

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### Microsoft

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

### Twitter

- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

### Twitch

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

### Apple

- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_SECRET`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (PEM format)

### WorkOS

- `WORKOS_CLIENT_ID`
- `WORKOS_CLIENT_SECRET`

### Reddit

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`

## Multi-Provider Setup

```typescript
import { createReAuthEngine } from '@re-auth/reauth';
import { googleOAuthPlugin, discordOAuthPlugin, githubOAuthPlugin, spotifyOAuthPlugin, microsoftOAuthPlugin } from '@re-auth/reauth/plugins/oauth';

const reAuth = createReAuthEngine({
  plugins: [
    googleOAuthPlugin({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/google/callback',
    }),
    discordOAuthPlugin({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/discord/callback',
    }),
    githubOAuthPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/github/callback',
    }),
    spotifyOAuthPlugin({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/spotify/callback',
      usePKCE: true,
    }),
    microsoftOAuthPlugin({
      tenantId: 'common',
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/microsoft/callback',
    }),
  ],
  entity: entityService,
  session: sessionService,
});
```

## Default Scopes

Each provider comes with sensible default scopes, but you can customize them:

| Provider  | Default Scopes                                |
| --------- | --------------------------------------------- |
| Google    | `['openid', 'email', 'profile']`              |
| Discord   | `['identify', 'email']`                       |
| GitHub    | `['user:email', 'read:user']`                 |
| LinkedIn  | `['openid', 'profile', 'email']`              |
| Facebook  | `['email', 'public_profile']`                 |
| Spotify   | `['user-read-email', 'user-read-private']`    |
| Microsoft | `['openid', 'profile', 'email', 'User.Read']` |
| Twitter   | `['tweet.read', 'users.read']`                |
| Twitch    | `['user:read:email']`                         |
| Apple     | `['name', 'email']`                           |
| Auth0     | `['openid', 'profile', 'email']`              |
| WorkOS    | `['openid', 'profile', 'email']`              |
| Reddit    | `['identity']`                                |

## Provider Support Matrix

| Provider  | Regular OAuth | PKCE Support | Custom Domains | Notes                |
| --------- | ------------- | ------------ | -------------- | -------------------- |
| Google    | ✅            | ✅           | ❌             |                      |
| Discord   | ✅            | ✅           | ❌             |                      |
| GitHub    | ✅            | ❌           | ❌             |                      |
| LinkedIn  | ✅            | ❌           | ❌             |                      |
| Facebook  | ✅            | ❌           | ❌             |                      |
| Spotify   | ✅            | ✅           | ❌             |                      |
| Microsoft | ✅            | ✅           | ❌             | Multi-tenant support |
| Twitter   | ✅            | ❌           | ❌             |                      |
| Twitch    | ✅            | ❌           | ❌             |                      |
| Apple     | ✅            | ❌           | ❌             | Requires private key |
| Auth0     | ✅            | ✅           | ✅             | Custom domains       |
| WorkOS    | ✅            | ✅           | ❌             | Enterprise SSO       |
| Reddit    | ✅            | ❌           | ❌             |                      |

## Migration from Arctic.js to v3

If you're upgrading from Arctic.js , note these breaking changes:

1. **PKCE Parameters**: Providers supporting PKCE now require explicit `null` or `codeVerifier` parameters
2. **Self-hosted Providers**: Use unified `baseURL` parameter
3. **Custom Domain Providers**: Use unified `domain` parameter

See the [Arctic.js v3 migration guide](https://arcticjs.dev/guides/migrate-v3) for more details.

## Error Handling

```typescript
try {
  const result = await reAuth.executeStep('Discord', 'authorize', {
    /* inputs */
  });

  if (result.success) {
    // Handle success
    const { entity, token } = result;
  } else {
    // Handle OAuth errors
    console.error('OAuth error:', result.message);
  }
} catch (error) {
  if (error instanceof OAuth2RequestError) {
    // Invalid authorization code, credentials, or redirect URI
    console.error('OAuth2 Error:', error.code);
  } else if (error instanceof ArcticFetchError) {
    // Network or fetch errors
    console.error('Network Error:', error.cause);
  } else {
    // Other errors
    console.error('Error:', error);
  }
}
```

## Contributing

To add a new OAuth provider:

1. Create a new file following the naming pattern: `{provider}-oauth.plugin.ts`
2. Use the `createOAuthPlugin` factory with the appropriate Arctic.js client
3. Define the provider-specific configuration interface
4. Add exports to `index.ts`
5. Update this README with the new provider

## Resources

- [Arctic.js Documentation](https://arcticjs.dev/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [PKCE Specification](https://tools.ietf.org/html/rfc7636)
- [ReAuth Documentation](../../README.md)
