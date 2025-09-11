import { describe, it, expect } from 'vitest';
import { baseOAuthPluginV2, createOAuthPlugin, type OAuthConfigV2 } from './plugin.v2';
import { createGoogleOAuthPlugin } from './providers/google';
import { createGitHubOAuthPlugin } from './providers/github';

describe('OAuth Plugin V2', () => {
  it('should export the base OAuth plugin correctly', () => {
    expect(baseOAuthPluginV2).toBeDefined();
    expect(baseOAuthPluginV2.name).toBe('oauth');
    expect(baseOAuthPluginV2.steps).toBeDefined();
    expect(Array.isArray(baseOAuthPluginV2.steps)).toBe(true);
    expect(baseOAuthPluginV2.steps).toHaveLength(6); // 6 OAuth steps
  });

  it('should have all required OAuth steps', () => {
    const stepNames = baseOAuthPluginV2.steps.map(step => step.name);
    expect(stepNames).toContain('initiate-oauth');
    expect(stepNames).toContain('callback-oauth');
    expect(stepNames).toContain('link-oauth');
    expect(stepNames).toContain('unlink-oauth');
    expect(stepNames).toContain('refresh-token');
    expect(stepNames).toContain('get-profile');
  });

  it('should have default configuration values', () => {
    expect(baseOAuthPluginV2.config).toBeDefined();
    expect(baseOAuthPluginV2.config).toEqual({
      providers: [],
      defaultScopes: ['email', 'profile'],
      sessionTtlSeconds: 24 * 60 * 60, // 24 hours
      allowAccountLinking: true,
      requireEmailVerification: false,
      tokenRefreshIntervalSeconds: 3600, // 1 hour
      autoRefreshTokens: true,
    });
  });

  it('should have schema tables defined', () => {
    expect(baseOAuthPluginV2.schema).toBeDefined();
    expect(baseOAuthPluginV2.schema.tables).toBeDefined();
    expect(baseOAuthPluginV2.schema.tables.oauth_providers).toBe('oauth_providers');
    expect(baseOAuthPluginV2.schema.tables.oauth_tokens).toBe('oauth_tokens');
    expect(baseOAuthPluginV2.schema.tables.oauth_profiles).toBe('oauth_profiles');
  });

  it('should validate configuration correctly', () => {
    expect(() => {
      createOAuthPlugin({
        config: {
          providers: []
        }
      });
    }).toThrow('providers array is required');

    expect(() => {
      createOAuthPlugin({
        config: {
          providers: [
            {
              name: 'google',
              clientId: '',
              clientSecret: 'secret',
              authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
              tokenUrl: 'https://oauth2.googleapis.com/token',
              userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
              scopes: ['email', 'profile'],
              redirectUri: 'http://localhost:3000/callback',
            }
          ]
        }
      });
    }).toThrow('provider google: clientId is required');
  });

  it('should create Google OAuth plugin correctly', () => {
    const googlePlugin = createGoogleOAuthPlugin({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['email', 'profile', 'openid'],
    });

    expect(googlePlugin).toBeDefined();
    expect(googlePlugin.name).toBe('oauth');
    expect(googlePlugin.config?.providers).toHaveLength(1);
    expect(googlePlugin.config?.providers[0]?.name).toBe('google');
    expect(googlePlugin.config?.providers[0]?.clientId).toBe('test-client-id');
    expect(googlePlugin.config?.providers[0]?.scopes).toEqual(['email', 'profile', 'openid']);
  });

  it('should create GitHub OAuth plugin correctly', () => {
    const githubPlugin = createGitHubOAuthPlugin({
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['user:email', 'read:user'],
    });

    expect(githubPlugin).toBeDefined();
    expect(githubPlugin.name).toBe('oauth');
    expect(githubPlugin.config?.providers).toHaveLength(1);
    expect(githubPlugin.config?.providers[0]?.name).toBe('github');
    expect(githubPlugin.config?.providers[0]?.clientId).toBe('github-client-id');
    expect(githubPlugin.config?.providers[0]?.scopes).toEqual(['user:email', 'read:user']);
  });

  it('should create custom OAuth plugin with multiple providers', () => {
    const multiProviderPlugin = createOAuthPlugin({
      config: {
        providers: [
          {
            name: 'google',
            clientId: 'google-client-id',
            clientSecret: 'google-secret',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            scopes: ['email', 'profile'],
            redirectUri: 'http://localhost:3000/callback',
          },
          {
            name: 'github',
            clientId: 'github-client-id',
            clientSecret: 'github-secret',
            authorizationUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            userInfoUrl: 'https://api.github.com/user',
            scopes: ['user:email'],
            redirectUri: 'http://localhost:3000/callback',
          },
        ],
        allowAccountLinking: true,
        sessionTtlSeconds: 7 * 24 * 60 * 60, // 7 days
      },
    });

    expect(multiProviderPlugin).toBeDefined();
    expect(multiProviderPlugin.config?.providers).toHaveLength(2);
    expect(multiProviderPlugin.config?.allowAccountLinking).toBe(true);
    expect(multiProviderPlugin.config?.sessionTtlSeconds).toBe(7 * 24 * 60 * 60);
  });
});