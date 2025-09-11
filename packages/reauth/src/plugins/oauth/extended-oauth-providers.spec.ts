import { describe, it, expect } from 'vitest';
import {
  gitlabOAuthPlugin,
  slackOAuthPlugin,
  bitbucketOAuthPlugin,
  dropboxOAuthPlugin,
  salesforceOAuthPlugin,
  type GitLabOAuthConfig,
  type SlackOAuthConfig,
  type BitbucketOAuthConfig,
  type DropboxOAuthConfig,
  type SalesforceOAuthConfig,
} from './index';

describe('Extended OAuth Providers', () => {
  describe('GitLab OAuth Plugin', () => {
    const config: GitLabOAuthConfig = {
      clientId: 'test-gitlab-client-id',
      clientSecret: 'test-gitlab-client-secret',
      redirectUri: 'http://localhost:3000/auth/gitlab/callback',
    };

    it('should create GitLab OAuth plugin', () => {
      const plugin = gitlabOAuthPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('gitlab');
      expect(plugin.steps).toBeDefined();
    });

    it('should support custom GitLab instance URL', () => {
      const selfHostedConfig: GitLabOAuthConfig = {
        ...config,
        baseUrl: 'https://gitlab.company.com',
      };
      const plugin = gitlabOAuthPlugin(selfHostedConfig);
      expect(plugin).toBeDefined();
    });
  });

  describe('Slack OAuth Plugin', () => {
    const config: SlackOAuthConfig = {
      clientId: 'test-slack-client-id',
      clientSecret: 'test-slack-client-secret',
      redirectUri: 'http://localhost:3000/auth/slack/callback',
    };

    it('should create Slack OAuth plugin', () => {
      const plugin = slackOAuthPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('slack');
      expect(plugin.steps).toBeDefined();
    });

    it('should support team restriction', () => {
      const teamConfig: SlackOAuthConfig = {
        ...config,
        team: 'T1234567890',
      };
      const plugin = slackOAuthPlugin(teamConfig);
      expect(plugin).toBeDefined();
    });
  });

  describe('Bitbucket OAuth Plugin', () => {
    const config: BitbucketOAuthConfig = {
      clientId: 'test-bitbucket-client-id',
      clientSecret: 'test-bitbucket-client-secret',
      redirectUri: 'http://localhost:3000/auth/bitbucket/callback',
    };

    it('should create Bitbucket OAuth plugin', () => {
      const plugin = bitbucketOAuthPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('bitbucket');
      expect(plugin.steps).toBeDefined();
    });

    it('should support custom scopes', () => {
      const customScopeConfig: BitbucketOAuthConfig = {
        ...config,
        scopes: ['account', 'email', 'repositories'],
      };
      const plugin = bitbucketOAuthPlugin(customScopeConfig);
      expect(plugin).toBeDefined();
    });
  });

  describe('Dropbox OAuth Plugin', () => {
    const config: DropboxOAuthConfig = {
      clientId: 'test-dropbox-client-id',
      clientSecret: 'test-dropbox-client-secret',
      redirectUri: 'http://localhost:3000/auth/dropbox/callback',
    };

    it('should create Dropbox OAuth plugin', () => {
      const plugin = dropboxOAuthPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('dropbox');
      expect(plugin.steps).toBeDefined();
    });

    it('should support PKCE flow', () => {
      const pkceConfig: DropboxOAuthConfig = {
        ...config,
        usePKCE: true,
      };
      const plugin = dropboxOAuthPlugin(pkceConfig);
      expect(plugin).toBeDefined();
    });
  });

  describe('Salesforce OAuth Plugin', () => {
    const config: SalesforceOAuthConfig = {
      clientId: 'test-salesforce-client-id',
      clientSecret: 'test-salesforce-client-secret',
      redirectUri: 'http://localhost:3000/auth/salesforce/callback',
    };

    it('should create Salesforce OAuth plugin', () => {
      const plugin = salesforceOAuthPlugin(config);
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('salesforce');
      expect(plugin.steps).toBeDefined();
    });

    it('should support custom Salesforce domain', () => {
      const customDomainConfig: SalesforceOAuthConfig = {
        ...config,
        domain: 'test.salesforce.com',
      };
      const plugin = salesforceOAuthPlugin(customDomainConfig);
      expect(plugin).toBeDefined();
    });

    it('should support sandbox environment', () => {
      const sandboxConfig: SalesforceOAuthConfig = {
        ...config,
        domain: 'test.salesforce.com',
      };
      const plugin = salesforceOAuthPlugin(sandboxConfig);
      expect(plugin).toBeDefined();
    });
  });

  describe('Provider Configuration Validation', () => {
    it('should accept valid configurations', () => {
      const validConfig = {
        clientId: 'valid-client-id',
        clientSecret: 'valid-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      };

      expect(() => gitlabOAuthPlugin(validConfig)).not.toThrow();
      expect(() => slackOAuthPlugin(validConfig)).not.toThrow();
      expect(() => bitbucketOAuthPlugin(validConfig)).not.toThrow();
      expect(() => dropboxOAuthPlugin(validConfig)).not.toThrow();
      expect(() => salesforceOAuthPlugin(validConfig)).not.toThrow();
    });
  });

  describe('Plugin Integration', () => {
    it('should all providers have oauth steps', () => {
      const providers = [
        gitlabOAuthPlugin({
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:3000/callback',
        }),
        slackOAuthPlugin({
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:3000/callback',
        }),
        bitbucketOAuthPlugin({
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:3000/callback',
        }),
        dropboxOAuthPlugin({
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:3000/callback',
        }),
        salesforceOAuthPlugin({
          clientId: 'test',
          clientSecret: 'test',
          redirectUri: 'http://localhost:3000/callback',
        }),
      ];

      providers.forEach((provider) => {
        expect(provider.steps).toBeDefined();
        expect(typeof provider.steps).toBe('object');
        expect(Object.keys(provider.steps).length).toBeGreaterThan(0);
      });
    });

    it('should all providers support standard OAuth configuration', () => {
      const standardConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['read:profile'],
      };

      const providers = [
        () => gitlabOAuthPlugin(standardConfig),
        () => slackOAuthPlugin(standardConfig),
        () => bitbucketOAuthPlugin(standardConfig),
        () => dropboxOAuthPlugin(standardConfig),
        () => salesforceOAuthPlugin(standardConfig),
      ];

      providers.forEach((createProvider) => {
        expect(() => createProvider()).not.toThrow();
      });
    });
  });
});