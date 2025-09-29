import { ReAuthEngine } from '../../../engine';
import { createMockDatabase, getMockDatabase } from './mock-database';
import type { FumaClient } from '../../../types';

// Import all plugins
import emailPasswordPlugin from '../../../plugins/email-password/plugin';
import usernamePlugin from '../../../plugins/username/plugin';
import phonePlugin from '../../../plugins/phone/plugin';
import passwordlessPlugin from '../../../plugins/passwordless/plugin';
import anonymousPlugin from '../../../plugins/anonymous/plugin';
import apiKeyPlugin from '../../../plugins/api-key/plugin';
import jwtPlugin from '../../../plugins/jwt/plugin';
import sessionPlugin from '../../../plugins/session/plugin';
import organizationPlugin from '../../../plugins/organization/plugin';

/**
 * Configuration for test engine
 */
export interface TestEngineConfig {
  enableCleanupScheduler?: boolean;
  enableJWKS?: boolean;
  tokenFactory?: () => string;
  mockSendCode?: (subject: any, code: string | number, contact: string, type: string) => Promise<void>;
  mockSendMagicLink?: (email: string, token: string, subject: any) => Promise<void>;
}

/**
 * Create a test ReAuthEngine with all plugins configured for testing
 */
export function createTestReAuthEngine(config: TestEngineConfig = {}): {
  engine: ReAuthEngine;
  dbClient: FumaClient;
} {
  const dbClient = createMockDatabase();

  // Mock sendCode function for email/password verification
  const mockSendCode = config.mockSendCode || (async () => {});
  const mockSendMagicLink = config.mockSendMagicLink || (async () => {});

  // Configure plugins with test-friendly settings
  const plugins = [
    // Email-password with test settings
    emailPasswordPlugin({
      verifyEmail: false, // Disable email verification for tests
      loginOnRegister: true,
      sessionTtlSeconds: 3600,
      sendCode: mockSendCode,
    }),

    // Username plugin
    usernamePlugin({}),

    // Phone plugin with mock sendCode
    phonePlugin({
      sendCode: mockSendCode,
    }),

    // Passwordless plugin
    passwordlessPlugin({
      magicLinks: true, // Enable magic links for testing
      useEmailPlugin: false, // Don't require email-password plugin
      sendMagicLink: mockSendMagicLink,
      getEmail: async (subject: any) => 'test@example.com', // Mock getEmail function
    }),

    // Anonymous plugin
    anonymousPlugin({}),

    // API key plugin
    apiKeyPlugin({}),

    // JWT plugin
    jwtPlugin({
      issuer: 'test-issuer',
    }),

    // Session plugin
    sessionPlugin({}),

    // Organization plugin
    organizationPlugin({
      getEmail: async (subject: any) => 'test@example.com',
    }),
  ];

  const engine = new ReAuthEngine({
    dbClient,
    plugins,
    tokenFactory: config.tokenFactory,
    enableCleanupScheduler: config.enableCleanupScheduler ?? false, // Disable cleanup for tests
  });

  // Enable JWKS if requested
  if (config.enableJWKS) {
    engine.getSessionService().enableJWKS({
      issuer: 'test-issuer',
      keyRotationIntervalDays: 30,
      keyGracePeriodDays: 7,
      defaultAccessTokenTtlSeconds: 3600,
      defaultRefreshTokenTtlSeconds: 86400,
      enableRefreshTokenRotation: true,
    });
  }

  return { engine, dbClient };
}

/**
 * Reset the test engine and database to clean state
 */
export function resetTestEngine(engine: ReAuthEngine, dbClient: FumaClient): void {
  getMockDatabase(dbClient).clearAllTables();
  // Note: Engine doesn't have a reset method, but we can recreate if needed
}

/**
 * Helper to create test subjects in the database
 */
export async function createTestSubject(
  dbClient: FumaClient,
  subjectData: { id?: string; role?: string; [key: string]: any }
): Promise<any> {
  const orm = dbClient.orm('mock-1.0.0');
  return orm.create('subjects', {
    id: subjectData.id || `test-subject-${Date.now()}`,
    role: subjectData.role || 'user',
    ...subjectData,
  });
}

/**
 * Helper to create test identities
 */
export async function createTestIdentity(
  dbClient: FumaClient,
  identityData: {
    subject_id: string;
    provider: string;
    identifier: string;
    verified?: boolean;
  }
): Promise<any> {
  const orm = dbClient.orm('mock-1.0.0');
  return orm.create('identities', {
    subject_id: identityData.subject_id,
    provider: identityData.provider,
    identifier: identityData.identifier,
    verified: identityData.verified ?? true,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

/**
 * Helper to create test credentials
 */
export async function createTestCredential(
  dbClient: FumaClient,
  credentialData: {
    subject_id: string;
    password_hash?: string;
    api_key?: string;
  }
): Promise<any> {
  const orm = dbClient.orm('mock-1.0.0');
  return orm.create('credentials', {
    subject_id: credentialData.subject_id,
    password_hash: credentialData.password_hash,
    api_key: credentialData.api_key,
    created_at: new Date(),
    updated_at: new Date(),
  });
}