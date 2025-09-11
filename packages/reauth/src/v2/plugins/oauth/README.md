# OAuth Plugin V2 - Third-Party Authentication

The OAuth V2 plugin provides comprehensive third-party authentication support for ReAuth, enabling users to sign in with popular services like Google, GitHub, Facebook, Discord, Microsoft, and Apple.

## Features

- 🔐 **Secure OAuth 2.0 flows** with CSRF protection
- 🔗 **Account linking** - Link multiple OAuth providers to one user
- 🔄 **Automatic token refresh** with configurable intervals
- 📱 **Multiple providers** - Google, GitHub, Facebook, Discord, Microsoft, Apple
- 🛡️ **Token security** - Tokens are hashed at rest
- ⚡ **Framework agnostic** - Works with any JavaScript runtime
- 🧪 **Type-safe** - Full TypeScript support with strict typing

## Quick Start

### Basic Setup

```typescript
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

// Create Google OAuth plugin
const googleOAuth = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['email', 'profile', 'openid'],
});

// Initialize ReAuth engine with OAuth plugin
const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [googleOAuth],
});
```

## Supported Providers

### Google OAuth

```typescript
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const googleOAuth = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['email', 'profile', 'openid'], // Optional, these are defaults
});
```

### GitHub OAuth

```typescript
import { createGitHubOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const githubOAuth = createGitHubOAuthPlugin({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['user:email', 'read:user'], // Optional, these are defaults
});
```

### Facebook OAuth

```typescript
import { createFacebookOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const facebookOAuth = createFacebookOAuthPlugin({
  clientId: process.env.FACEBOOK_APP_ID!,
  clientSecret: process.env.FACEBOOK_APP_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['email', 'public_profile'], // Optional, these are defaults
});
```

### Discord OAuth

```typescript
import { createDiscordOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const discordOAuth = createDiscordOAuthPlugin({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['identify', 'email'], // Optional, these are defaults
});
```

### Microsoft OAuth

```typescript
import { createMicrosoftOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const microsoftOAuth = createMicrosoftOAuthPlugin({
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  tenantId: 'common', // Optional, defaults to 'common' for multi-tenant
  scopes: ['openid', 'profile', 'email', 'User.Read'], // Optional, these are defaults
});
```

### Apple OAuth

```typescript
import { createAppleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const appleOAuth = createAppleOAuthPlugin({
  clientId: process.env.APPLE_CLIENT_ID!,
  teamId: process.env.APPLE_TEAM_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!, // PEM format
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  scopes: ['name', 'email'], // Optional, these are defaults
});
```

## OAuth Flow Steps

The OAuth plugin provides 6 main steps for complete OAuth functionality:

### 1. Initiate OAuth Flow

Start the OAuth flow and get authorization URL:

```typescript
const result = await engine.executeStep('oauth', 'initiate-oauth', {
  provider: 'google',
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  state: 'secure-random-state', // CSRF protection
});

// Redirect user to result.authorizationUrl
window.location.href = result.authorizationUrl;
```

### 2. Handle OAuth Callback

Exchange authorization code for tokens and create/login user:

```typescript
const result = await engine.executeStep('oauth', 'callback-oauth', {
  provider: 'google',
  code: 'authorization-code-from-callback',
  state: 'secure-random-state',
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
});

if (result.success) {
  // User is now authenticated
  console.log('User:', result.user);
  console.log('Session:', result.session);
}
```

### 3. Link OAuth Account (Optional)

Link an OAuth provider to an existing authenticated user:

```typescript
const result = await engine.executeStep('oauth', 'link-oauth', {
  provider: 'github',
  userId: 'existing-user-id',
  oauthUserId: 'github-user-id',
});
```

### 4. Unlink OAuth Account

Remove an OAuth provider from a user's account:

```typescript
const result = await engine.executeStep('oauth', 'unlink-oauth', {
  provider: 'github',
  userId: 'user-id',
});
```

### 5. Refresh Access Token

Refresh an expired OAuth access token:

```typescript
const result = await engine.executeStep('oauth', 'refresh-token', {
  provider: 'google',
  userId: 'user-id',
  refreshToken: 'refresh-token',
});
```

### 6. Get User Profile

Fetch user profile data from OAuth provider:

```typescript
const result = await engine.executeStep('oauth', 'get-profile', {
  provider: 'google',
  userId: 'user-id',
});

console.log('Profile:', result.profile);
```

## Advanced Configuration

### Multiple Providers

You can configure multiple OAuth providers in a single plugin:

```typescript
import { createOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const multiOAuth = createOAuthPlugin({
  config: {
    providers: [
      {
        name: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['email', 'profile', 'openid'],
        redirectUri: 'http://localhost:3000/auth/oauth/callback',
      },
      {
        name: 'github',
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email', 'read:user'],
        redirectUri: 'http://localhost:3000/auth/oauth/callback',
      },
    ],
    allowAccountLinking: true,
    autoRefreshTokens: true,
    sessionTtlSeconds: 86400, // 24 hours
  },
});
```

### Account Linking Configuration

```typescript
const oauthPlugin = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  allowAccountLinking: true, // Enable linking multiple OAuth accounts
  requireEmailVerification: false, // Skip email verification for OAuth users
});
```

### Automatic Token Refresh

```typescript
const oauthPlugin = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/oauth/callback',
  autoRefreshTokens: true, // Enable automatic token refresh
  tokenRefreshIntervalSeconds: 3000, // Refresh 5 minutes before expiry
});
```

## Database Schema

The OAuth plugin automatically creates the following database tables:

### oauth_providers
Stores OAuth provider configurations.

### oauth_tokens  
Stores OAuth access and refresh tokens (hashed for security).

### oauth_profiles
Stores user profile data from OAuth providers.

## Framework Integration Examples

### Express.js

```typescript
import express from 'express';
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const app = express();
const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [createGoogleOAuthPlugin({ /* config */ })],
});

// Initiate OAuth flow
app.get('/auth/:provider', async (req, res) => {
  const { provider } = req.params;
  const state = generateSecureRandomString();
  
  const result = await engine.executeStep('oauth', 'initiate-oauth', {
    provider,
    redirectUri: `${req.protocol}://${req.get('host')}/auth/${provider}/callback`,
    state,
  });
  
  // Store state in session for CSRF protection
  req.session.oauthState = state;
  
  res.redirect(result.authorizationUrl);
});

// Handle OAuth callback
app.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state } = req.query;
  
  // Verify CSRF state
  if (state !== req.session.oauthState) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  
  const result = await engine.executeStep('oauth', 'callback-oauth', {
    provider,
    code: code as string,
    state: state as string,
    redirectUri: `${req.protocol}://${req.get('host')}/auth/${provider}/callback`,
  });
  
  if (result.success) {
    // Set session cookie
    req.session.userId = result.user.id;
    res.redirect('/dashboard');
  } else {
    res.status(400).json({ error: result.error });
  }
});
```

### Next.js App Router

```typescript
// app/auth/[provider]/route.ts
import { NextRequest } from 'next/server';
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [createGoogleOAuthPlugin({ /* config */ })],
});

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider;
  const state = generateSecureRandomString();
  
  const result = await engine.executeStep('oauth', 'initiate-oauth', {
    provider,
    redirectUri: `${process.env.NEXTAUTH_URL}/auth/${provider}/callback`,
    state,
  });
  
  // Store state in cookie for CSRF protection
  const response = Response.redirect(result.authorizationUrl);
  response.cookies.set('oauth-state', state, { 
    httpOnly: true, 
    secure: true,
    maxAge: 600 // 10 minutes
  });
  
  return response;
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createGitHubOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const fastify = Fastify();
const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [createGitHubOAuthPlugin({ /* config */ })],
});

fastify.get('/auth/:provider', async (request, reply) => {
  const { provider } = request.params as { provider: string };
  const state = generateSecureRandomString();
  
  const result = await engine.executeStep('oauth', 'initiate-oauth', {
    provider,
    redirectUri: `${request.protocol}://${request.hostname}/auth/${provider}/callback`,
    state,
  });
  
  reply.setCookie('oauth-state', state, { httpOnly: true });
  reply.redirect(result.authorizationUrl);
});
```

## Error Handling

The OAuth plugin provides comprehensive error handling:

```typescript
const result = await engine.executeStep('oauth', 'callback-oauth', {
  provider: 'google',
  code: 'auth-code',
  state: 'state',
  redirectUri: 'http://localhost:3000/callback',
});

if (!result.success) {
  switch (result.error) {
    case 'Provider not found':
      // Handle unknown provider
      break;
    case 'Invalid authorization code':
      // Handle expired/invalid code
      break;
    case 'Token exchange failed':
      // Handle OAuth provider API errors
      break;
    case 'Profile fetch failed':
      // Handle user profile API errors
      break;
    default:
      // Handle other errors
      console.error('OAuth error:', result.error);
  }
}
```

## Security Best Practices

1. **CSRF Protection**: Always use and validate the `state` parameter
2. **Secure Redirect URIs**: Use HTTPS in production
3. **Token Storage**: Tokens are automatically hashed at rest
4. **Scope Limitation**: Request only necessary OAuth scopes
5. **Token Expiry**: Enable automatic token refresh for better UX

## Environment Variables

Set up your OAuth provider credentials:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth  
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Apple OAuth (more complex setup required)
APPLE_CLIENT_ID=your_apple_client_id
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY=your_apple_private_key_pem_content
```

## TypeScript Support

The OAuth plugin is fully typed with TypeScript:

```typescript
import type { 
  OAuthConfigV2,
  OAuthProviderConfig,
  OAuthUserProfile,
  OAuthTokenResponse,
  GoogleOAuthConfig,
  GitHubOAuthConfig,
  FacebookOAuthConfig,
} from '@re-auth/reauth/v2/plugins/oauth';

// All plugin functions and steps are fully typed
const result: OAuthCallbackResult = await engine.executeStep('oauth', 'callback-oauth', {
  provider: 'google', // Typed as available provider names
  code: 'auth-code',
  state: 'state',
  redirectUri: 'http://localhost:3000/callback',
});
```

## Migration from V1

If you're migrating from OAuth Plugin V1, see the [Migration Guide](./MIGRATION_V1_TO_V2.md) for detailed steps and breaking changes.

## Contributing

Contributions are welcome! To add a new OAuth provider:

1. Create a provider file in `providers/` directory
2. Follow the existing provider pattern
3. Add provider configuration to the main exports
4. Add integration tests
5. Update this documentation

## License

MIT License - see LICENSE file for details.