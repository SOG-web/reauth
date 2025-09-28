# OAuth V2 End-to-End Flow Testing Guide

This guide demonstrates how to test OAuth flows end-to-end in your application. These examples show complete OAuth flows from initiation to user authentication.

## Complete OAuth Flow Examples

### 1. Google OAuth Flow

```typescript
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createGoogleOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

// Setup
const googleOAuth = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
});

const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [googleOAuth],
});

// Step 1: Initiate OAuth flow
async function initiateGoogleAuth() {
  const state = generateSecureRandomString();
  
  const result = await engine.executeStep('oauth', 'initiate-oauth', {
    provider: 'google',
    redirectUri: 'http://localhost:3000/auth/google/callback',
    state,
  });

  if (result.success) {
    // Store state for CSRF verification
    sessionStorage.setItem('oauth-state', state);
    
    // Redirect user to Google
    window.location.href = result.authorizationUrl;
  }
}

// Step 2: Handle callback (server-side)
async function handleGoogleCallback(code: string, state: string) {
  const expectedState = getStoredState(); // Get from session/cookie
  
  if (state !== expectedState) {
    throw new Error('Invalid state - possible CSRF attack');
  }

  const result = await engine.executeStep('oauth', 'callback-oauth', {
    provider: 'google',
    code,
    state,
    redirectUri: 'http://localhost:3000/auth/google/callback',
  });

  if (result.success) {
    return {
      user: result.user,
      session: result.session,
      isNewUser: result.isNewUser,
    };
  } else {
    throw new Error(`Authentication failed: ${result.error}`);
  }
}

// Step 3: Get user profile
async function getUserProfile(userId: string) {
  const result = await engine.executeStep('oauth', 'get-profile', {
    provider: 'google',
    userId,
  });

  if (result.success) {
    return result.profile;
  } else {
    throw new Error(`Profile fetch failed: ${result.error}`);
  }
}
```

### 2. GitHub OAuth Flow with Account Linking

```typescript
import { createGitHubOAuthPlugin } from '@re-auth/reauth/v2/plugins/oauth';

const githubOAuth = createGitHubOAuthPlugin({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/github/callback',
  allowAccountLinking: true,
});

// Complete flow with account linking
async function githubOAuthWithLinking() {
  // 1. Initiate OAuth
  const state = generateSecureRandomString();
  const initiateResult = await engine.executeStep('oauth', 'initiate-oauth', {
    provider: 'github',
    redirectUri: 'http://localhost:3000/auth/github/callback',
    state,
  });

  // 2. After user returns from GitHub...
  const callbackResult = await engine.executeStep('oauth', 'callback-oauth', {
    provider: 'github',
    code: 'received-auth-code',
    state,
    redirectUri: 'http://localhost:3000/auth/github/callback',
  });

  // 3. If user wants to link to existing account
  if (callbackResult.success && existingUserId) {
    const linkResult = await engine.executeStep('oauth', 'link-oauth', {
      provider: 'github',
      userId: existingUserId,
      oauthUserId: callbackResult.user.oauthProfile.id,
    });

    if (linkResult.success) {
      console.log('GitHub account linked successfully');
    }
  }

  return callbackResult;
}
```

### 3. Multi-Provider Setup

```typescript
import {
  createGoogleOAuthPlugin,
  createGitHubOAuthPlugin,
  createFacebookOAuthPlugin,
  createDiscordOAuthPlugin,
  createMicrosoftOAuthPlugin,
} from '@re-auth/reauth/v2/plugins/oauth';

// Setup multiple providers
const multiProviderEngine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [
    createGoogleOAuthPlugin({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/oauth/callback',
    }),
    createGitHubOAuthPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/oauth/callback',
    }),
    createFacebookOAuthPlugin({
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      redirectUri: 'http://localhost:3000/auth/oauth/callback',
    }),
    createDiscordOAuthPlugin({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/oauth/callback',
    }),
    createMicrosoftOAuthPlugin({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/oauth/callback',
      tenantId: 'common',
    }),
  ],
});

// Generic OAuth handler
async function handleOAuthFlow(provider: string) {
  const state = generateSecureRandomString();
  
  // 1. Initiate
  const initiateResult = await multiProviderEngine.executeStep('oauth', 'initiate-oauth', {
    provider,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
    state,
  });

  if (!initiateResult.success) {
    throw new Error(`Failed to initiate ${provider} OAuth: ${initiateResult.error}`);
  }

  return {
    authorizationUrl: initiateResult.authorizationUrl,
    state,
  };
}

// Generic callback handler
async function handleOAuthCallback(provider: string, code: string, state: string, expectedState: string) {
  if (state !== expectedState) {
    throw new Error('Invalid state parameter');
  }

  const result = await multiProviderEngine.executeStep('oauth', 'callback-oauth', {
    provider,
    code,
    state,
    redirectUri: 'http://localhost:3000/auth/oauth/callback',
  });

  return result;
}
```

### 4. Token Refresh Flow

```typescript
// Automatic token refresh setup
const googleOAuthWithRefresh = createGoogleOAuthPlugin({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
  autoRefreshTokens: true,
  tokenRefreshIntervalSeconds: 3000, // Refresh 5 minutes before expiry
});

// Manual token refresh
async function refreshUserToken(userId: string, refreshToken: string) {
  const result = await engine.executeStep('oauth', 'refresh-token', {
    provider: 'google',
    userId,
    refreshToken,
  });

  if (result.success) {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  } else {
    throw new Error(`Token refresh failed: ${result.error}`);
  }
}
```

### 5. Account Management Flow

```typescript
// Unlink OAuth account
async function unlinkOAuthAccount(provider: string, userId: string) {
  const result = await engine.executeStep('oauth', 'unlink-oauth', {
    provider,
    userId,
  });

  if (result.success) {
    console.log(`${provider} account unlinked successfully`);
    return true;
  } else {
    throw new Error(`Failed to unlink ${provider} account: ${result.error}`);
  }
}

// Get all linked accounts for a user
async function getLinkedAccounts(userId: string) {
  const profiles = [];
  const providers = ['google', 'github', 'facebook', 'discord', 'microsoft'];

  for (const provider of providers) {
    try {
      const result = await engine.executeStep('oauth', 'get-profile', {
        provider,
        userId,
      });

      if (result.success) {
        profiles.push({
          provider,
          profile: result.profile,
        });
      }
    } catch (error) {
      // Provider not linked, continue
    }
  }

  return profiles;
}
```

## Testing Strategies

### 1. Unit Testing OAuth Steps

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('OAuth Flow Unit Tests', () => {
  it('should generate valid authorization URL', async () => {
    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'google',
      redirectUri: 'http://localhost:3000/callback',
      state: 'test-state',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(result.authorizationUrl).toContain('state=test-state');
    expect(result.authorizationUrl).toContain('client_id=');
  });

  it('should handle invalid provider', async () => {
    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'invalid-provider',
      redirectUri: 'http://localhost:3000/callback',
      state: 'test-state',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Provider not found');
  });
});
```

### 2. Integration Testing with Mock APIs

```typescript
import { vi } from 'vitest';

// Mock fetch for OAuth API calls
vi.stubGlobal('fetch', vi.fn());

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OAuth Integration Tests', () => {
  it('should complete OAuth callback flow', async () => {
    // Mock token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      }),
    });

    // Mock user profile fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'google-user-123',
        email: 'user@gmail.com',
        name: 'Test User',
      }),
    });

    const result = await engine.executeStep('oauth', 'callback-oauth', {
      provider: 'google',
      code: 'mock-auth-code',
      state: 'test-state',
      redirectUri: 'http://localhost:3000/callback',
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.session).toBeDefined();
  });
});
```

### 3. End-to-End Testing with Real Providers

For E2E testing with real OAuth providers, use test accounts and sandbox environments:

```typescript
// E2E test configuration
const E2E_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_TEST_CLIENT_ID,
    clientSecret: process.env.GOOGLE_TEST_CLIENT_SECRET,
    testAccount: process.env.GOOGLE_TEST_ACCOUNT,
  },
  github: {
    clientId: process.env.GITHUB_TEST_CLIENT_ID,
    clientSecret: process.env.GITHUB_TEST_CLIENT_SECRET,
    testAccount: process.env.GITHUB_TEST_ACCOUNT,
  },
};

// Use Playwright or similar for browser automation
async function testOAuthE2E(provider: string) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  // Navigate to OAuth initiation
  await page.goto(`http://localhost:3000/auth/${provider}`);
  
  // Fill OAuth provider login form
  await page.fill('[name="email"]', E2E_CONFIG[provider].testAccount);
  await page.fill('[name="password"]', 'test-password');
  await page.click('button[type="submit"]');
  
  // Wait for redirect back to app
  await page.waitForURL('**/dashboard');
  
  // Verify user is authenticated
  const userInfo = await page.textContent('[data-testid="user-info"]');
  expect(userInfo).toContain(E2E_CONFIG[provider].testAccount);

  await browser.close();
}
```

## Error Handling Patterns

### 1. Network Failures

```typescript
async function robustOAuthCallback(provider: string, code: string, state: string) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await engine.executeStep('oauth', 'callback-oauth', {
        provider,
        code,
        state,
        redirectUri: 'http://localhost:3000/callback',
      });

      if (result.success) {
        return result;
      } else if (isRetryableError(result.error)) {
        attempt++;
        await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      if (isNetworkError(error) && attempt < maxRetries - 1) {
        attempt++;
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw error;
    }
  }

  throw new Error('OAuth callback failed after maximum retries');
}
```

### 2. State Validation

```typescript
function validateOAuthState(receivedState: string, expectedState: string) {
  if (!receivedState || !expectedState) {
    throw new Error('Missing OAuth state parameter');
  }

  if (receivedState !== expectedState) {
    throw new Error('Invalid OAuth state - possible CSRF attack');
  }

  // Additional validation: check state format, timestamp, etc.
  try {
    const stateData = JSON.parse(atob(receivedState));
    const now = Date.now();
    
    if (now - stateData.timestamp > 10 * 60 * 1000) { // 10 minutes
      throw new Error('OAuth state expired');
    }
  } catch (error) {
    throw new Error('Invalid OAuth state format');
  }
}
```

## Performance Optimization

### 1. Token Caching

```typescript
class TokenCache {
  private cache = new Map<string, { token: string; expires: number }>();

  async getToken(userId: string, provider: string): Promise<string | null> {
    const key = `${userId}:${provider}`;
    const cached = this.cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }

    // Fetch fresh token
    const result = await engine.executeStep('oauth', 'refresh-token', {
      provider,
      userId,
      refreshToken: await getStoredRefreshToken(userId, provider),
    });

    if (result.success) {
      this.cache.set(key, {
        token: result.accessToken,
        expires: Date.now() + (result.expiresIn * 1000) - 60000, // 1 minute buffer
      });
      return result.accessToken;
    }

    return null;
  }
}
```

### 2. Batch Operations

```typescript
async function linkMultipleAccounts(userId: string, oauthAccounts: Array<{ provider: string; oauthUserId: string }>) {
  const results = await Promise.allSettled(
    oauthAccounts.map(({ provider, oauthUserId }) =>
      engine.executeStep('oauth', 'link-oauth', {
        provider,
        userId,
        oauthUserId,
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
  const failed = results.filter(r => r.status === 'rejected' || !r.value.success);

  return {
    successful: successful.length,
    failed: failed.length,
    results,
  };
}
```

This guide provides comprehensive examples for testing OAuth flows end-to-end in various scenarios. Use these patterns to ensure your OAuth implementation is robust and handles edge cases properly.