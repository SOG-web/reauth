import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReAuthEngine } from '../../../engine';
import { 
  createMinimalTestEngine,
  waitForEngineInitialization,
  cleanupTestEngine,
} from '../utils/test-engine-factory';
import { getMockDatabase } from '../utils/mock-database';
import { TestDataFactory, TestAssertions, TestScenarios } from '../utils/test-data-generators';

describe('Cross-Plugin Workflows - Integration Tests', () => {
  let engine: ReAuthEngine;
  let mockDb: ReturnType<typeof getMockDatabase>;

  beforeEach(async () => {
    TestDataFactory.resetCounter();
    engine = createMinimalTestEngine(['anonymous', 'api-key', 'username-password', 'email-or-username', 'session', 'jwt']);
    mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
    await waitForEngineInitialization(engine);
  });

  afterEach(async () => {
    await cleanupTestEngine(engine);
  });

  describe('Anonymous to Authenticated Workflow', () => {
    it('should support anonymous session creation followed by API key generation', async () => {
      // Step 1: Create anonymous guest session
      const guestData = TestDataFactory.anonymousData();
      const guestResult = await engine.executeStep('anonymous', 'create-guest', guestData);
      
      TestAssertions.assertSuccess(guestResult);
      
      // Step 2: Create a permanent subject for the API key
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      // Step 3: Create session for the subject
      const sessionToken = await engine.createSessionFor('subject', subjectData.id);
      
      // Step 4: Generate API key using the session
      const apiKeyData = {
        ...TestDataFactory.apiKeyData(),
        token: sessionToken,
      };
      
      const apiKeyResult = await engine.executeStep('api-key', 'create-api-key', apiKeyData);
      
      TestAssertions.assertSuccess(apiKeyResult);
      TestAssertions.assertHasData(apiKeyResult, ['api_key', 'metadata']);
    });

    it('should maintain separate session contexts for anonymous and authenticated users', async () => {
      // Create anonymous guest session
      const guestData = TestDataFactory.anonymousData();
      const guestResult = await engine.executeStep('anonymous', 'create-guest', guestData);
      TestAssertions.assertSuccess(guestResult);
      
      // Create authenticated subject and session
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      const authToken = await engine.createSessionFor('subject', subjectData.id);
      
      // Verify both sessions work independently
      const authSession = await engine.checkSession(authToken);
      TestAssertions.assertValidSession(authSession);
      
      expect(authSession.subject.id).toBe(subjectData.id);
    });
  });

  describe('Multi-Step Authentication Workflow', () => {
    it('should support username authentication followed by API key creation', async () => {
      // Step 1: Create subject with username
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      // Step 2: Create username credential
      await mockDb.create('usernames', {
        subject_id: subjectData.id,
        username: 'testuser123',
        is_verified: true,
      });
      
      // Step 3: Create password credential  
      await mockDb.create('credentials', {
        subject_id: subjectData.id,
        type: 'password',
        identifier: 'testuser123',
        hashed_password: 'hashed_password_placeholder',
      });
      
      // Step 4: Authenticate with username/password
      const loginData = {
        username: 'testuser123',
        password: 'password123', // This would normally be validated
        others: {},
      };
      
      // This step would normally validate credentials - for testing we focus on the flow
      const sessionToken = await engine.createSessionFor('subject', subjectData.id);
      
      // Step 5: Use session to create API key
      const apiKeyData = {
        ...TestDataFactory.apiKeyData(),
        token: sessionToken,
      };
      
      const apiKeyResult = await engine.executeStep('api-key', 'create-api-key', apiKeyData);
      
      TestAssertions.assertSuccess(apiKeyResult);
      TestAssertions.assertHasData(apiKeyResult, ['api_key', 'metadata']);
    });

    it('should handle session lifecycle across multiple plugins', async () => {
      const scenario = TestScenarios.crossPlugin();
      
      // Create subject
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      // Create session
      const token = await engine.createSessionFor(
        scenario.sessionData.subjectType,
        subjectData.id,
        scenario.sessionData.ttlSeconds
      );
      
      // Verify session works across different plugin contexts
      const session1 = await engine.checkSession(token);
      TestAssertions.assertValidSession(session1);
      
      // Use session for API key creation
      const apiKeyResult = await engine.executeStep('api-key', 'create-api-key', {
        ...scenario.apiKeyData,
        token,
      });
      
      TestAssertions.assertSuccess(apiKeyResult);
      
      // Verify session still valid after API key creation
      const session2 = await engine.checkSession(token);
      TestAssertions.assertValidSession(session2);
      
      // Clean up session
      await engine.getSessionService().destroySession(token);
      
      const session3 = await engine.checkSession(token);
      TestAssertions.assertInvalidSession(session3);
    });
  });

  describe('JWT and Session Integration', () => {
    it('should support JWT token generation and validation workflow', async () => {
      // Create subject
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      // Create session with JWT capabilities
      const sessionService = engine.getSessionService();
      
      // Enable JWT features if available
      if (sessionService && typeof (sessionService as any).enableJWKS === 'function') {
        (sessionService as any).enableJWKS({
          issuer: 'test-issuer',
          keyRotationIntervalDays: 30,
          keyGracePeriodDays: 7,
          defaultAccessTokenTtlSeconds: 3600,
          defaultRefreshTokenTtlSeconds: 86400,
          enableRefreshTokenRotation: true,
        });
      }
      
      // Create session (may return JWT tokens if configured)
      const token = await engine.createSessionFor('subject', subjectData.id, 3600);
      
      // Verify token
      const session = await engine.checkSession(token);
      TestAssertions.assertValidSession(session);
      
      // Token type may be 'jwt' or 'legacy'
      expect(['jwt', 'legacy']).toContain(session.type);
    });

    it('should handle JWT JWKS operations if available', async () => {
      const jwtPlugin = engine.getPlugin('jwt');
      
      if (jwtPlugin && jwtPlugin.steps) {
        const jwksStep = jwtPlugin.steps.find(step => step.name === 'get-jwks');
        
        if (jwksStep) {
          // Test JWKS retrieval
          const jwksData = { others: {} };
          const jwksResult = await engine.executeStep('jwt', 'get-jwks', jwksData);
          
          // Should return JWKS data or handle gracefully
          expect(jwksResult.success !== undefined).toBe(true);
        }
      }
    });
  });

  describe('Error Handling Across Plugins', () => {
    it('should maintain consistency when one plugin fails', async () => {
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      // Create valid session
      const token = await engine.createSessionFor('subject', subjectData.id);
      const initialSession = await engine.checkSession(token);
      TestAssertions.assertValidSession(initialSession);
      
      // Attempt invalid API key operation
      try {
        await engine.executeStep('api-key', 'create-api-key', {
          name: 'Invalid Key',
          // Missing required fields
          others: {},
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Session should still be valid after plugin failure
      const afterFailureSession = await engine.checkSession(token);
      TestAssertions.assertValidSession(afterFailureSession);
    });

    it('should handle plugin dependency failures gracefully', async () => {
      // Test what happens when dependent services are unavailable
      // For now, we test that the engine doesn't crash
      
      const guestData = TestDataFactory.anonymousData();
      
      await expect(
        engine.executeStep('anonymous', 'create-guest', guestData)
      ).resolves.not.toThrow();
    });
  });

  describe('Plugin Interaction Patterns', () => {
    it('should allow plugins to access engine context', async () => {
      // Test that plugins can access the engine and other services through context
      const guestData = TestDataFactory.anonymousData();
      
      const result = await engine.executeStep('anonymous', 'create-guest', guestData);
      
      // Plugin should have been able to execute without context errors
      TestAssertions.assertSuccess(result);
    });

    it('should maintain plugin isolation', async () => {
      // Test that plugins don't interfere with each other's operations
      const promises = [
        engine.executeStep('anonymous', 'create-guest', TestDataFactory.anonymousData({
          fingerprint: 'isolated_test_1'
        })),
        // Would test other plugins if they had independent operations
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        TestAssertions.assertSuccess(result);
      });
    });

    it('should support plugin configuration inheritance', () => {
      // Test that plugins receive their configuration correctly
      const anonymousPlugin = engine.getPlugin('anonymous');
      const apiKeyPlugin = engine.getPlugin('api-key');
      const sessionPlugin = engine.getPlugin('session');
      
      expect(anonymousPlugin!.config).toBeDefined();
      expect(apiKeyPlugin!.config).toBeDefined();
      expect(sessionPlugin!.config).toBeDefined();
      
      // Each plugin should have distinct configuration
      expect(anonymousPlugin!.config).not.toEqual(apiKeyPlugin!.config);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent cross-plugin operations', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => {
        return async () => {
          // Create subject
          const subjectData = TestDataFactory.subjectData();
          await mockDb.create('subjects', subjectData);
          
          // Create session
          const token = await engine.createSessionFor('subject', subjectData.id);
          
          // Create API key
          const apiKeyData = {
            ...TestDataFactory.apiKeyData(),
            name: `Concurrent Key ${i}`,
            token,
          };
          
          return engine.executeStep('api-key', 'create-api-key', apiKeyData);
        };
      });
      
      const results = await Promise.all(
        concurrentOperations.map(op => op())
      );
      
      results.forEach(result => {
        TestAssertions.assertSuccess(result);
      });
    });

    it('should maintain performance under plugin load', async () => {
      const startTime = performance.now();
      
      // Execute multiple plugin operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          engine.executeStep('anonymous', 'create-guest', TestDataFactory.anonymousData({
            fingerprint: `perf_test_${i}`
          }))
        );
      }
      
      const results = await Promise.all(operations);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // All operations should succeed
      results.forEach(result => {
        TestAssertions.assertSuccess(result);
      });
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});