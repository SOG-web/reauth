import { describe, it, expect } from 'vitest';
import { ReAuthEngineV2 } from '../../engine.v2';
import { createOAuthPlugin } from './plugin.v2';
import { createGoogleOAuthPlugin } from './providers/google';
import { createGitHubOAuthPlugin } from './providers/github';

describe('OAuth Plugin V2 Integration', () => {
  const mockDbClient = {
    version: async () => '1.0.0',
    orm: () => ({
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({ id: 'test-id' }),
      update: async () => ({ id: 'test-id' }),
      delete: async () => ({ id: 'test-id' }),
    }),
  };

  it('should integrate OAuth plugin with ReAuth engine successfully', async () => {
    const oauthPlugin = createOAuthPlugin({
      config: {
        providers: [
          {
            name: 'test-provider',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            authorizationUrl: 'https://test.com/oauth/authorize',
            tokenUrl: 'https://test.com/oauth/token',
            userInfoUrl: 'https://test.com/oauth/userinfo',
            scopes: ['email', 'profile'],
            redirectUri: 'http://localhost:3000/callback',
          },
        ],
      },
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [oauthPlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();
    expect(plugin?.name).toBe('oauth');
  });

  it('should execute OAuth initiate-oauth step through the engine', async () => {
    const oauthPlugin = createOAuthPlugin({
      config: {
        providers: [
          {
            name: 'google',
            clientId: 'test-google-client',
            clientSecret: 'test-google-secret',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            scopes: ['email', 'profile'],
            redirectUri: 'http://localhost:3000/callback',
          },
        ],
      },
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [oauthPlugin],
      enableCleanupScheduler: false,
    });

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'google',
      redirectUri: 'http://localhost:3000/callback',
      state: 'test-state-123',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(result.state).toBe('test-state-123');
  });

  it('should handle OAuth provider not found error', async () => {
    const oauthPlugin = createOAuthPlugin({
      config: {
        providers: [
          {
            name: 'google',
            clientId: 'test-client',
            clientSecret: 'test-secret',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            scopes: ['email', 'profile'],
            redirectUri: 'http://localhost:3000/callback',
          },
        ],
      },
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [oauthPlugin],
      enableCleanupScheduler: false,
    });

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'facebook', // Not configured
      redirectUri: 'http://localhost:3000/callback',
      state: 'test-state',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Provider facebook not found');
  });

  it('should integrate Google OAuth plugin with engine', async () => {
    const googlePlugin = createGoogleOAuthPlugin({
      clientId: 'google-test-client',
      clientSecret: 'google-test-secret',
      redirectUri: 'http://localhost:3000/auth/google/callback',
      scopes: ['email', 'profile', 'openid'],
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [googlePlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'google',
      redirectUri: 'http://localhost:3000/auth/google/callback',
      state: 'google-state-123',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(result.authorizationUrl).toContain('scope=email+profile+openid');
  });

  it('should integrate GitHub OAuth plugin with engine', async () => {
    const githubPlugin = createGitHubOAuthPlugin({
      clientId: 'github-test-client',
      clientSecret: 'github-test-secret',
      redirectUri: 'http://localhost:3000/auth/github/callback',
      scopes: ['user:email', 'read:user'],
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [githubPlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'github',
      redirectUri: 'http://localhost:3000/auth/github/callback',
      state: 'github-state-456',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('github.com/login/oauth/authorize');
    expect(result.authorizationUrl).toContain('scope=user%3Aemail+read%3Auser');
  });

  it('should validate OAuth plugin configuration', () => {
    // Test that invalid configuration is rejected
    expect(() => {
      createOAuthPlugin({
        config: {
          providers: [], // Empty providers should trigger validation error
        },
      });
    }).toThrow();

    expect(() => {
      createOAuthPlugin({
        config: {
          providers: [
            {
              name: 'invalid-provider',
              clientId: '', // Missing required fields
              clientSecret: '',
              authorizationUrl: '',
              tokenUrl: '',
              userInfoUrl: '',
              scopes: [],
              redirectUri: '',
            },
          ],
        },
      });
    }).toThrow();
  });
});