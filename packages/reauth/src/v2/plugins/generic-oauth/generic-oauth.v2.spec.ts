import { describe, it, expect, beforeEach } from 'vitest';
import { createGenericOAuthPlugin, type GenericOAuthConfigV2 } from './plugin.v2';
import { 
  CrossPlatformCrypto,
  generateOAuthState,
  generatePKCE,
  buildOAuth2AuthorizationUrl,
  OAuth1SignatureGenerator,
  validateOAuthState,
} from './utils';
import { 
  createGoogleProvider,
  createGitHubProvider,
  createTwitterProvider,
} from './providers/examples';

describe('Generic OAuth Plugin V2', () => {
  describe('Plugin Configuration', () => {
    it('should create plugin with valid configuration', () => {
      const config: Partial<GenericOAuthConfigV2> = {
        providers: {
          google: createGoogleProvider({
            clientId: 'test-google-client-id',
            clientSecret: 'test-google-client-secret',
          }),
          github: createGitHubProvider({
            clientId: 'test-github-client-id',
            clientSecret: 'test-github-client-secret',
          }),
        },
        security: {
          stateLength: 32,
          codeVerifierLength: 32,
          tokenEncryption: true,
          validateIssuer: true,
          clockSkewSeconds: 30,
        },
      };

      expect(() => createGenericOAuthPlugin({ config })).not.toThrow();
    });

    it('should validate provider configuration', () => {
      const invalidConfig: Partial<GenericOAuthConfigV2> = {
        providers: {
          invalid: {
            name: 'invalid',
            version: '2.0',
            clientId: '', // Invalid: empty client ID
            clientSecret: 'test-secret',
          },
        } as any,
      };

      expect(() => createGenericOAuthPlugin({ config: invalidConfig }))
        .toThrow(/clientId is required/);
    });

    it('should validate OAuth 2.0 provider requirements', () => {
      const oauth2Config: Partial<GenericOAuthConfigV2> = {
        providers: {
          oauth2: {
            name: 'oauth2',
            version: '2.0',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            // Missing authorizationUrl and discoveryUrl
          },
        } as any,
      };

      expect(() => createGenericOAuthPlugin({ config: oauth2Config }))
        .toThrow(/authorizationUrl or discoveryUrl is required for OAuth 2\.0/);
    });

    it('should validate OAuth 1.0a provider requirements', () => {
      const oauth1Config: Partial<GenericOAuthConfigV2> = {
        providers: {
          oauth1: {
            name: 'oauth1',
            version: '1.0a',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            // Missing required URLs
          },
        } as any,
      };

      expect(() => createGenericOAuthPlugin({ config: oauth1Config }))
        .toThrow(/requestTokenUrl is required for OAuth 1\.0a/);
    });

    it('should have correct plugin name', () => {
      const plugin = createGenericOAuthPlugin({ config: { providers: {} } });
      expect(plugin.name).toBe('generic-oauth');
    });

    it('should have default configuration values', () => {
      const plugin = createGenericOAuthPlugin({ config: { providers: {} } });
      expect(plugin.config).toMatchObject({
        security: {
          stateLength: 32,
          codeVerifierLength: 32,
          tokenEncryption: true,
          validateIssuer: true,
          clockSkewSeconds: 30,
        },
        tokens: {
          accessTokenTtl: 60,
          refreshTokenTtl: 30,
          autoRefresh: true,
          revokeOnDisconnect: true,
        },
        cleanup: {
          enabled: true,
          intervalMinutes: 60,
          expiredTokenRetentionDays: 7,
          expiredCodeRetentionHours: 1,
        },
      });
    });
  });

  describe('OAuth 2.0 Steps', () => {
    let plugin: ReturnType<typeof createGenericOAuthPlugin>;
    let mockOrm: any;

    beforeEach(() => {
      plugin = createGenericOAuthPlugin({
        config: {
          providers: {
            google: createGoogleProvider({
              clientId: 'test-google-client-id',
              clientSecret: 'test-google-client-secret',
            }),
          },
        },
      });

      mockOrm = {
        insertOne: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
    });

    it('should have begin-oauth2-authorization step', () => {
      const step = plugin.steps.find(s => s.name === 'begin-oauth2-authorization');
      expect(step).toBeDefined();
      expect(step?.protocol).toBe('generic-oauth.begin-oauth2-authorization.v1');
    });

    it('should have complete-oauth2-authorization step', () => {
      const step = plugin.steps.find(s => s.name === 'complete-oauth2-authorization');
      expect(step).toBeDefined();
      expect(step?.protocol).toBe('generic-oauth.complete-oauth2-authorization.v1');
    });

    it('should have refresh-oauth2-token step', () => {
      const step = plugin.steps.find(s => s.name === 'refresh-oauth2-token');
      expect(step).toBeDefined();
      expect(step?.protocol).toBe('generic-oauth.refresh-oauth2-token.v1');
    });
  });

  describe('OAuth 1.0a Steps', () => {
    let plugin: ReturnType<typeof createGenericOAuthPlugin>;

    beforeEach(() => {
      plugin = createGenericOAuthPlugin({
        config: {
          providers: {
            twitter: createTwitterProvider({
              clientId: 'test-twitter-consumer-key',
              clientSecret: 'test-twitter-consumer-secret',
            }),
          },
        },
      });
    });

    it('should have begin-oauth1-authorization step', () => {
      const step = plugin.steps.find(s => s.name === 'begin-oauth1-authorization');
      expect(step).toBeDefined();
      expect(step?.protocol).toBe('generic-oauth.begin-oauth1-authorization.v1');
    });
  });

  describe('Cross-Platform Utilities', () => {
    describe('CrossPlatformCrypto', () => {
      it('should generate random bytes', async () => {
        const bytes = await CrossPlatformCrypto.randomBytes(16);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBe(16);
      });

      it('should generate random string', async () => {
        const str = await CrossPlatformCrypto.generateRandomString(16);
        expect(typeof str).toBe('string');
        expect(str.length).toBe(32); // 16 bytes = 32 hex chars
      });

      it('should generate SHA-256 hash', async () => {
        const hash = await CrossPlatformCrypto.sha256('test');
        expect(hash).toBeInstanceOf(ArrayBuffer);
        expect(hash.byteLength).toBe(32); // SHA-256 = 32 bytes
      });

      it('should base64 URL encode', () => {
        const buffer = new ArrayBuffer(16);
        const encoded = CrossPlatformCrypto.base64UrlEncode(buffer);
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toMatch(/[+/=]/); // No standard base64 chars
      });
    });

    describe('OAuth State and PKCE', () => {
      it('should generate OAuth state', async () => {
        const state = await generateOAuthState();
        expect(typeof state).toBe('string');
        expect(state.length).toBe(64); // 32 bytes = 64 hex chars
      });

      it('should generate PKCE pair', async () => {
        const { verifier, challenge } = await generatePKCE();
        expect(typeof verifier).toBe('string');
        expect(typeof challenge).toBe('string');
        expect(verifier.length).toBe(64); // 32 bytes = 64 hex chars
        expect(challenge.length).toBeGreaterThan(0);
      });

      it('should validate OAuth state', () => {
        const state = 'test-state-value';
        expect(validateOAuthState(state, state)).toBe(true);
        expect(validateOAuthState(state, 'different-state')).toBe(false);
        expect(validateOAuthState('', state)).toBe(false);
        expect(validateOAuthState(state, '')).toBe(false);
      });
    });

    describe('OAuth 2.0 URL Building', () => {
      it('should build OAuth 2.0 authorization URL', () => {
        const provider = createGoogleProvider({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        });

        const url = buildOAuth2AuthorizationUrl(provider, {
          redirectUri: 'https://example.com/callback',
          state: 'test-state',
          scopes: ['email', 'profile'],
          codeChallenge: 'test-challenge',
        });

        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('response_type=code');
        expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
        expect(url).toContain('state=test-state');
        expect(url).toContain('scope=email%20profile');
        expect(url).toContain('code_challenge=test-challenge');
      });

      it('should throw error for missing authorization URL', () => {
        const provider = {
          name: 'test',
          version: '2.0' as const,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          // Missing authorizationUrl
        };

        expect(() => buildOAuth2AuthorizationUrl(provider, {
          redirectUri: 'https://example.com/callback',
          state: 'test-state',
        })).toThrow(/Authorization URL not configured/);
      });
    });

    describe('OAuth 1.0a Signature Generation', () => {
      it('should generate timestamp', () => {
        const timestamp = OAuth1SignatureGenerator.generateTimestamp();
        expect(typeof timestamp).toBe('string');
        expect(/^\d+$/.test(timestamp)).toBe(true);
      });

      it('should generate nonce', async () => {
        const nonce = await OAuth1SignatureGenerator.generateNonce();
        expect(typeof nonce).toBe('string');
        expect(nonce.length).toBe(32); // 16 bytes = 32 hex chars
      });

      it('should percent encode strings', () => {
        expect(OAuth1SignatureGenerator.percentEncode('hello world'))
          .toBe('hello%20world');
        expect(OAuth1SignatureGenerator.percentEncode('test!'))
          .toBe('test%21');
      });

      it('should create signature base string', () => {
        const baseString = OAuth1SignatureGenerator.createSignatureBaseString(
          'POST',
          'https://api.example.com/oauth/request_token',
          {
            oauth_consumer_key: 'test-key',
            oauth_nonce: 'test-nonce',
            oauth_timestamp: '1234567890',
          }
        );

        expect(baseString).toContain('POST');
        expect(baseString).toContain('https%3A%2F%2Fapi.example.com%2Foauth%2Frequest_token');
        expect(baseString).toContain('oauth_consumer_key%3Dtest-key');
      });
    });
  });

  describe('Provider Examples', () => {
    it('should create Google provider', () => {
      const provider = createGoogleProvider({
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
      });

      expect(provider.name).toBe('google');
      expect(provider.version).toBe('2.0');
      expect(provider.clientId).toBe('google-client-id');
      expect(provider.discoveryUrl).toBe('https://accounts.google.com/.well-known/openid_configuration');
      expect(provider.scopes).toEqual(['openid', 'email', 'profile']);
    });

    it('should create GitHub provider', () => {
      const provider = createGitHubProvider({
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
      });

      expect(provider.name).toBe('github');
      expect(provider.version).toBe('2.0');
      expect(provider.authorizationUrl).toBe('https://github.com/login/oauth/authorize');
      expect(provider.tokenUrl).toBe('https://github.com/login/oauth/access_token');
    });

    it('should create Twitter provider', () => {
      const provider = createTwitterProvider({
        clientId: 'twitter-consumer-key',
        clientSecret: 'twitter-consumer-secret',
      });

      expect(provider.name).toBe('twitter');
      expect(provider.version).toBe('1.0a');
      expect(provider.requestTokenUrl).toBe('https://api.twitter.com/oauth/request_token');
      expect(provider.signatureMethod).toBe('HMAC-SHA1');
    });
  });

  describe('Security Validation', () => {
    it('should validate security configuration', () => {
      const invalidSecurityConfig: Partial<GenericOAuthConfigV2> = {
        providers: {},
        security: {
          stateLength: 8, // Too short
          codeVerifierLength: 8, // Too short
          tokenEncryption: true,
          validateIssuer: true,
          clockSkewSeconds: -1, // Invalid negative value
        },
      };

      expect(() => createGenericOAuthPlugin({ config: invalidSecurityConfig }))
        .toThrow();
    });

    it('should validate token configuration', () => {
      const invalidTokenConfig: Partial<GenericOAuthConfigV2> = {
        providers: {},
        tokens: {
          accessTokenTtl: 0, // Invalid
          refreshTokenTtl: 0, // Invalid
          autoRefresh: true,
          revokeOnDisconnect: true,
        },
      };

      expect(() => createGenericOAuthPlugin({ config: invalidTokenConfig }))
        .toThrow();
    });

    it('should validate cleanup configuration', () => {
      const invalidCleanupConfig: Partial<GenericOAuthConfigV2> = {
        providers: {},
        cleanup: {
          enabled: true,
          intervalMinutes: 0, // Invalid
          expiredTokenRetentionDays: 0, // Invalid
          expiredCodeRetentionHours: 0, // Invalid
        },
      };

      expect(() => createGenericOAuthPlugin({ config: invalidCleanupConfig }))
        .toThrow();
    });
  });

  describe('Plugin Steps Integration', () => {
    it('should have all required OAuth 2.0 steps', () => {
      const plugin = createGenericOAuthPlugin({
        config: {
          providers: {
            google: createGoogleProvider({
              clientId: 'test-client-id',
              clientSecret: 'test-client-secret',
            }),
          },
        },
      });

      const stepNames = plugin.steps.map(s => s.name);
      expect(stepNames).toContain('begin-oauth2-authorization');
      expect(stepNames).toContain('complete-oauth2-authorization');
      expect(stepNames).toContain('refresh-oauth2-token');
      expect(stepNames).toContain('get-user-profile');
      expect(stepNames).toContain('disconnect-oauth');
    });

    it('should have OAuth 1.0a steps', () => {
      const plugin = createGenericOAuthPlugin({
        config: {
          providers: {
            twitter: createTwitterProvider({
              clientId: 'test-consumer-key',
              clientSecret: 'test-consumer-secret',
            }),
          },
        },
      });

      const stepNames = plugin.steps.map(s => s.name);
      expect(stepNames).toContain('begin-oauth1-authorization');
    });

    it('should have correct step protocols', () => {
      const plugin = createGenericOAuthPlugin({ config: { providers: {} } });
      
      plugin.steps.forEach(step => {
        expect(step.protocol).toMatch(/^generic-oauth\./);
        expect(step.protocol).toMatch(/\.v1$/);
      });
    });
  });
});