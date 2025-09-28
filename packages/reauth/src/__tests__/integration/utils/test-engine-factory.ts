import { ReAuthEngine } from '../../../engine';
import { createMockDatabase } from './mock-database';
import anonymousPlugin from '../../../plugins/anonymous/plugin';
import apiKeyPlugin from '../../../plugins/api-key/plugin';
import emailPasswordPlugin from '../../../plugins/email-password/plugin';
import usernamePlugin from '../../../plugins/username/plugin';
import phonePlugin from '../../../plugins/phone/plugin';
import passwordlessPlugin from '../../../plugins/passwordless/plugin';
import emailOrUsernamePlugin from '../../../plugins/email-or-username/plugin';
import jwtPlugin from '../../../plugins/jwt/plugin';
import sessionPlugin from '../../../plugins/session/plugin';
import organizationPlugin from '../../../plugins/organization/plugin';
import type { AuthPlugin, FumaClient } from '../../../types';

export interface TestEngineOptions {
  plugins?: AuthPlugin[];
  dbClient?: FumaClient;
  enableCleanupScheduler?: boolean;
  additionalConfig?: any;
}

/**
 * Creates a test ReAuthEngine instance with all plugins registered
 * and configured for testing environments
 */
export function createTestReAuthEngine(options: TestEngineOptions = {}): ReAuthEngine {
  const {
    plugins,
    dbClient,
    enableCleanupScheduler = false,
    additionalConfig = {},
  } = options;

  // Create mock database client if not provided
  const testDbClient = dbClient || createMockDatabase();

  // Default plugin configuration for testing
  const defaultPlugins = [
    anonymousPlugin({
      maxSessionDurationHours: 24,
      cleanupIntervalMinutes: 60,
      allowExtensions: true,
      maxExtensions: 3,
      defaultFingerprint: 'test-fingerprint',
    }),
    apiKeyPlugin({
      keyLength: 32,
      defaultExpirationDays: 365,
      cleanupIntervalMinutes: 60,
      allowUserGeneration: true,
      rateLimit: {
        windowMs: 60000,
        max: 100,
      },
    }),
    emailPasswordPlugin({
      testUsers: {
        enabled: true,
        environment: 'test',
        users: [
          {
            email: 'test@example.com',
            password: 'testPassword123',
            profile: { name: 'Test User', verified: true },
          },
          {
            email: 'unverified@example.com',
            password: 'testPassword123',
            profile: { name: 'Unverified User', verified: false },
          },
        ],
        checkEnvironment: (env: string) => env === 'test' || process.env.NODE_ENV === 'test',
      },
      codeLength: 6,
      codeType: 'numeric',
      verificationCodeTtlMinutes: 15,
      resetCodeTtlMinutes: 15,
      cleanupIntervalMinutes: 60,
      allowUnverifiedLogin: false,
      minPasswordLength: 8,
      checkPasswordBreach: false, // Disable external API calls in tests
    }),
    usernamePlugin({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      allowedCharacters: /^[a-zA-Z0-9_-]+$/,
      caseSensitive: false,
      reservedUsernames: ['admin', 'root', 'test'],
    }),
    phonePlugin({
      testMode: {
        enabled: true,
        testCode: '123456',
        testNumbers: ['+1234567890', '+0987654321'],
      },
      codeLength: 6,
      codeTtlMinutes: 15,
      maxAttempts: 3,
      cooldownMinutes: 1,
      cleanupIntervalMinutes: 60,
    }),
    emailOrUsernamePlugin({
      allowEmail: true,
      allowUsername: true,
      preferredLoginMethod: 'email',
    }),
    jwtPlugin({
      issuer: 'test-reauth-issuer',
      keyRotationIntervalDays: 30,
      keyGracePeriodDays: 7,
      defaultAccessTokenTtlSeconds: 3600, // 1 hour
      defaultRefreshTokenTtlSeconds: 86400 * 7, // 7 days
      enableRefreshTokenRotation: true,
      cleanupIntervalMinutes: 60,
    }),
    sessionPlugin({
      cleanupIntervalMinutes: 60,
      defaultTtlSeconds: 86400, // 24 hours
      extendOnActivity: true,
      allowConcurrentSessions: true,
    }),
  ];

  return new ReAuthEngine({
    dbClient: testDbClient,
    plugins: plugins || defaultPlugins,
    enableCleanupScheduler,
    ...additionalConfig,
  });
}

/**
 * Creates a minimal test engine with only specific plugins
 */
export function createMinimalTestEngine(pluginNames: string[]): ReAuthEngine {
  const allPlugins = {
    'anonymous': anonymousPlugin({ maxSessionDurationHours: 24 }),
    'api-key': apiKeyPlugin({ keyLength: 32 }),
    'email-password': emailPasswordPlugin({ 
      testUsers: { enabled: true, environment: 'test', users: [], checkEnvironment: () => true },
      checkPasswordBreach: false,
    }),
    'username': usernamePlugin({ minUsernameLength: 3 }),
    'phone': phonePlugin({ testMode: { enabled: true, testCode: '123456' } }),
    'email-or-username': emailOrUsernamePlugin({ allowEmail: true, allowUsername: true }),
    'jwt': jwtPlugin({ 
      issuer: 'test-issuer',
      keyRotationIntervalDays: 30,
      keyGracePeriodDays: 7,
      defaultAccessTokenTtlSeconds: 3600,
      defaultRefreshTokenTtlSeconds: 86400,
      enableRefreshTokenRotation: true,
    }),
    'session': sessionPlugin({ defaultTtlSeconds: 86400 }),
  };

  const selectedPlugins = pluginNames.map(name => {
    const plugin = allPlugins[name as keyof typeof allPlugins];
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    return plugin;
  });

  return createTestReAuthEngine({ 
    plugins: selectedPlugins,
    enableCleanupScheduler: false,
  });
}

/**
 * Wait for engine initialization to complete
 */
export async function waitForEngineInitialization(engine: ReAuthEngine): Promise<void> {
  // Engine initialization is synchronous in the constructor, 
  // but we might need to wait for async plugin initialization
  return new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Clean up engine resources after tests
 */
export async function cleanupTestEngine(engine?: ReAuthEngine): Promise<void> {
  if (!engine) return;
  
  try {
    if (engine.getCleanupScheduler && engine.getCleanupScheduler().isRunning()) {
      await engine.stopCleanupScheduler();
    }
  } catch (error) {
    // Ignore cleanup errors in tests
    console.warn('Error during test engine cleanup:', error);
  }
}