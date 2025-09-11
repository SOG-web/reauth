import { describe, it, expect } from 'vitest';
import { ReAuthEngineV2 } from '../../engine.v2';
import { createOAuthPlugin } from './plugin.v2';
import { createGoogleOAuthPlugin } from './providers/google';
import { createGitHubOAuthPlugin } from './providers/github';
import { createFacebookOAuthPlugin } from './providers/facebook';
import { createDiscordOAuthPlugin } from './providers/discord';
import { createMicrosoftOAuthPlugin } from './providers/microsoft';
import { createAppleOAuthPlugin } from './providers/apple';

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

  it('should integrate Facebook OAuth plugin with engine', async () => {
    const facebookPlugin = createFacebookOAuthPlugin({
      clientId: 'facebook-test-client',
      clientSecret: 'facebook-test-secret',
      redirectUri: 'http://localhost:3000/auth/facebook/callback',
      scopes: ['email', 'public_profile'],
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [facebookPlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'facebook',
      redirectUri: 'http://localhost:3000/auth/facebook/callback',
      state: 'facebook-state-789',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('facebook.com/v18.0/dialog/oauth');
    expect(result.authorizationUrl).toContain('scope=email+public_profile');
  });

  it('should integrate Discord OAuth plugin with engine', async () => {
    const discordPlugin = createDiscordOAuthPlugin({
      clientId: 'discord-test-client',
      clientSecret: 'discord-test-secret',
      redirectUri: 'http://localhost:3000/auth/discord/callback',
      scopes: ['identify', 'email'],
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [discordPlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'discord',
      redirectUri: 'http://localhost:3000/auth/discord/callback',
      state: 'discord-state-abc',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('discord.com/api/oauth2/authorize');
    expect(result.authorizationUrl).toContain('scope=identify+email');
  });

  it('should integrate Microsoft OAuth plugin with engine', async () => {
    const microsoftPlugin = createMicrosoftOAuthPlugin({
      clientId: 'microsoft-test-client',
      clientSecret: 'microsoft-test-secret',
      redirectUri: 'http://localhost:3000/auth/microsoft/callback',
      tenantId: 'common',
      scopes: ['openid', 'profile', 'email'],
    });

    const engine = new ReAuthEngineV2({
      dbClient: mockDbClient as any,
      plugins: [microsoftPlugin],
      enableCleanupScheduler: false,
    });

    const plugin = engine.getPlugin('oauth');
    expect(plugin).toBeDefined();

    const result = await engine.executeStep('oauth', 'initiate-oauth', {
      provider: 'microsoft',
      redirectUri: 'http://localhost:3000/auth/microsoft/callback',
      state: 'microsoft-state-def',
    });

    expect(result.success).toBe(true);
    expect(result.authorizationUrl).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(result.authorizationUrl).toContain('scope=openid+profile+email');
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