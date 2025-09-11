# OAuth Plugin Migration Guide: V1 → V2

This guide helps you migrate from OAuth Plugin V1 to the new OAuth Plugin V2 architecture. The V2 plugin provides better type safety, improved performance, and a more flexible architecture.

## Key Differences

### Architecture Changes

| Aspect | V1 | V2 |
|--------|----|----|
| **Architecture** | Arctic library-based | Native OAuth 2.0 implementation |
| **Provider Factory** | `createOAuthPlugin<T>()` | Provider-specific functions |
| **Configuration** | Individual plugin configs | Unified `OAuthConfigV2` |
| **Database Schema** | Provider-specific tables | Unified OAuth tables |
| **Steps** | Built-in Arctic flows | Explicit step-based flows |
| **Type Safety** | Partial typing | Full TypeScript support |

### Breaking Changes

1. **Plugin Creation Syntax**
2. **Database Schema Structure**
3. **Configuration Options**
4. **Step Execution Methods**
5. **Provider Registration**

## Migration Steps

### 1. Update Imports

**Before (V1):**
```typescript
import { 
  googleOAuthPlugin,
  githubOAuthPlugin,
  facebookOAuthPlugin,
  discordOAuthPlugin 
} from '@re-auth/reauth/plugins/oauth';
```

**After (V2):**
```typescript
import { 
  createGoogleOAuthPlugin,
  createGitHubOAuthPlugin,
  createFacebookOAuthPlugin,
  createDiscordOAuthPlugin
} from '@re-auth/reauth/v2/plugins/oauth';
```

### 2. Update Plugin Configuration

**Before (V1):**
```typescript
import { googleOAuthPlugin, GoogleOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const googleConfig: GoogleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
  scopes: ['email', 'profile', 'openid'],
};

const plugin = googleOAuthPlugin(googleConfig);
```

**After (V2):**
```typescript
import { createGoogleOAuthPlugin, GoogleOAuthConfig } from '@re-auth/reauth/v2/plugins/oauth';

const googleOAuth = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
  scopes: ['email', 'profile', 'openid'], // Optional, these are defaults
  sessionTtlSeconds: 86400, // Optional, 24 hours
  allowAccountLinking: true, // Optional, enable account linking
});
```

### 3. Update Engine Registration

**Before (V1):**
```typescript
import { ReAuthEngine } from '@re-auth/reauth';

const engine = new ReAuthEngine({
  dbClient: yourDbClient,
  plugins: [
    googleOAuthPlugin(googleConfig),
    githubOAuthPlugin(githubConfig),
  ],
});
```

**After (V2):**
```typescript
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';

const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [
    createGoogleOAuthPlugin({ /* config */ }),
    createGitHubOAuthPlugin({ /* config */ }),
  ],
});
```

### 4. Update Database Schema

The V2 OAuth plugin uses a unified schema instead of provider-specific tables.

**V1 Schema (per provider):**
```sql
-- Provider-specific tables (e.g., for Google)
ALTER TABLE entities ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE entities ADD COLUMN google_data JSON;

-- Similar for each provider (github_id, facebook_id, etc.)
```

**V2 Schema (unified):**
```sql
-- Unified OAuth tables
CREATE TABLE oauth_providers (
  id UUID PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  client_id VARCHAR(255) NOT NULL,
  client_secret_hash VARCHAR(255) NOT NULL,
  authorization_url VARCHAR(500) NOT NULL,
  token_url VARCHAR(500) NOT NULL,
  user_info_url VARCHAR(500) NOT NULL,
  scopes TEXT[] NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  expires_at TIMESTAMP,
  scope VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE oauth_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  picture VARCHAR(500),
  profile_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Update OAuth Flow Implementation

**Before (V1):**
```typescript
// V1 used Arctic library's built-in flows
const authUrl = await engine.generateAuthorizationUrl('google', {
  state: 'secure-state',
  scopes: ['email', 'profile'],
});

const tokens = await engine.validateAuthorizationCode('google', {
  code: 'auth-code',
  state: 'secure-state',
});
```

**After (V2):**
```typescript
// V2 uses explicit step-based flows
const initiateResult = await engine.executeStep('oauth', 'initiate-oauth', {
  provider: 'google',
  redirectUri: 'http://localhost:3000/auth/google/callback',
  state: 'secure-state',
});

const callbackResult = await engine.executeStep('oauth', 'callback-oauth', {
  provider: 'google',
  code: 'auth-code',
  state: 'secure-state',
  redirectUri: 'http://localhost:3000/auth/google/callback',
});
```

## Provider-Specific Migration

### Google OAuth

**Before (V1):**
```typescript
import { googleOAuthPlugin, GoogleOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const googleConfig: GoogleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
  scopes: ['email', 'profile', 'openid'],
};

const plugin = googleOAuthPlugin(googleConfig);
```

**After (V2):**
```typescript
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const googleOAuth = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
  scopes: ['email', 'profile', 'openid'], // Optional, these are defaults
});
```

### GitHub OAuth

**Before (V1):**
```typescript
import { githubOAuthPlugin, GitHubOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const githubConfig: GitHubOAuthConfig = {
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/github/callback',
  scopes: ['user:email', 'read:user'],
};

const plugin = githubOAuthPlugin(githubConfig);
```

**After (V2):**
```typescript
import { createGitHubOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const githubOAuth = createGitHubOAuthPlugin({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/github/callback',
  scopes: ['user:email', 'read:user'], // Optional, these are defaults
});
```

### Facebook OAuth

**Before (V1):**
```typescript
import { facebookOAuthPlugin, FacebookOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const facebookConfig: FacebookOAuthConfig = {
  clientId: process.env.FACEBOOK_APP_ID!,
  clientSecret: process.env.FACEBOOK_APP_SECRET!,
  redirectUri: 'http://localhost:3000/auth/facebook/callback',
  scopes: ['email', 'public_profile'],
};

const plugin = facebookOAuthPlugin(facebookConfig);
```

**After (V2):**
```typescript
import { createFacebookOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const facebookOAuth = createFacebookOAuthPlugin({
  clientId: process.env.FACEBOOK_APP_ID!,
  clientSecret: process.env.FACEBOOK_APP_SECRET!,
  redirectUri: 'http://localhost:3000/auth/facebook/callback',
  scopes: ['email', 'public_profile'], // Optional, these are defaults
});
```

### Discord OAuth

**Before (V1):**
```typescript
import { discordOAuthPlugin, DiscordOAuthConfig } from '@re-auth/reauth/plugins/oauth';

const discordConfig: DiscordOAuthConfig = {
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  scopes: ['identify', 'email'],
  usePKCE: false, // V1 had PKCE option
};

const plugin = discordOAuthPlugin(discordConfig);
```

**After (V2):**
```typescript
import { createDiscordOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const discordOAuth = createDiscordOAuthPlugin({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/discord/callback',
  scopes: ['identify', 'email'], // Optional, these are defaults
  // Note: PKCE handling is now automatic based on provider configuration
});
```

## New V2 Features

### 1. Account Linking

V2 introduces built-in account linking functionality:

```typescript
// Link OAuth account to existing user
const linkResult = await engine.executeStep('oauth', 'link-oauth', {
  provider: 'github',
  userId: 'existing-user-id',
  oauthUserId: 'github-user-id',
});

// Unlink OAuth account
const unlinkResult = await engine.executeStep('oauth', 'unlink-oauth', {
  provider: 'github',
  userId: 'user-id',
});
```

### 2. Token Refresh

Automatic and manual token refresh:

```typescript
// Manual token refresh
const refreshResult = await engine.executeStep('oauth', 'refresh-token', {
  provider: 'google',
  userId: 'user-id',
  refreshToken: 'refresh-token',
});

// Enable automatic refresh in configuration
const googleOAuth = createGoogleOAuthPlugin({
  // ... other config
  autoRefreshTokens: true,
  tokenRefreshIntervalSeconds: 3000, // Refresh 5 minutes before expiry
});
```

### 3. Profile Management

Fetch latest user profile from OAuth provider:

```typescript
const profileResult = await engine.executeStep('oauth', 'get-profile', {
  provider: 'google',
  userId: 'user-id',
});
```

### 4. Enhanced Security

- Tokens are hashed at rest
- Built-in CSRF protection with state parameters
- Configurable session durations
- Optional email verification

## Migration Checklist

- [ ] Update imports from V1 to V2
- [ ] Replace plugin configuration syntax
- [ ] Update database schema to V2 unified tables
- [ ] Migrate data from provider-specific tables to unified tables
- [ ] Update OAuth flow implementation to use step-based approach
- [ ] Test all OAuth providers in your application
- [ ] Update frontend OAuth initiation code
- [ ] Update OAuth callback handling code
- [ ] Implement new V2 features (account linking, token refresh, etc.)
- [ ] Update documentation and examples
- [ ] Deploy and monitor for any issues

## Data Migration Script

Here's a sample script to migrate data from V1 to V2 schema:

```sql
-- Example migration for Google OAuth data
INSERT INTO oauth_profiles (
  id,
  user_id,
  provider_name,
  provider_user_id,
  email,
  name,
  profile_data,
  created_at
)
SELECT 
  gen_random_uuid(),
  id as user_id,
  'google' as provider_name,
  google_id as provider_user_id,
  email,
  (google_data->>'name') as name,
  google_data as profile_data,
  created_at
FROM entities 
WHERE google_id IS NOT NULL;

-- Repeat similar queries for other providers (github, facebook, etc.)
```

## Troubleshooting

### Common Issues

1. **"Provider not found" error**
   - Ensure provider is properly registered with engine
   - Check provider name matches exactly

2. **Database schema errors**
   - Run V2 schema migration
   - Ensure all required tables exist

3. **Token validation failures**
   - Update OAuth flow to use V2 step-based approach
   - Verify redirect URIs match exactly

4. **Type errors**
   - Update imports to V2 versions
   - Check configuration object structure

### Getting Help

If you encounter issues during migration:

1. Check the [OAuth V2 README](./README.md) for detailed documentation
2. Review the [examples file](./examples.ts) for implementation patterns
3. Run the V2 test suite to verify your setup
4. Open an issue with specific error messages and configuration

## Performance Improvements

V2 provides several performance improvements over V1:

- **Reduced Dependencies**: No longer depends on Arctic library
- **Unified Schema**: Fewer database queries with unified tables  
- **Token Caching**: Built-in token caching mechanisms
- **Batch Operations**: Support for batch token operations
- **Optimized Queries**: More efficient database query patterns

## Conclusion

The OAuth Plugin V2 provides a more robust, flexible, and performant OAuth implementation. While migration requires some code changes, the improved architecture and new features make it worthwhile for production applications.

The step-based approach provides better control over OAuth flows, and the unified schema simplifies database management while maintaining full provider compatibility.