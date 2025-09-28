import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReAuthEngine } from '../../engine';
import { 
  createTestReAuthEngine, 
  createMinimalTestEngine,
  waitForEngineInitialization,
  cleanupTestEngine,
} from './utils/test-engine-factory';
import { getMockDatabase } from './utils/mock-database';
import { TestDataFactory, TestAssertions } from './utils/test-data-generators';

describe('ReAuthEngine - Integration Tests', () => {
  let engine: ReAuthEngine;

  beforeEach(async () => {
    TestDataFactory.resetCounter();
    engine = createTestReAuthEngine();
    await waitForEngineInitialization(engine);
  });

  afterEach(async () => {
    await cleanupTestEngine(engine);
  });

  describe('Engine Initialization & Plugin Registration', () => {
    it('should initialize engine with all default plugins', () => {
      expect(engine).toBeDefined();
      expect(engine.getContainer).toBeDefined();
      expect(engine.getSessionService).toBeDefined();
    });

    it('should register all expected plugins', () => {
      const expectedPlugins = [
        'anonymous',
        'api-key', 
        'email-password',
        'username-password',
        'phone-password',
        'email-or-username',
        'jwt',
        'session',
      ];

      for (const pluginName of expectedPlugins) {
        const plugin = engine.getPlugin(pluginName);
        expect(plugin).toBeDefined();
        expect(plugin!.name).toBe(pluginName);
      }
    });

    it('should throw PluginNotFound for non-existent plugin', () => {
      const plugin = engine.getPlugin('non-existent-plugin');
      expect(plugin).toBeUndefined();
    });

    it('should initialize with minimal plugin set', () => {
      const minimalEngine = createMinimalTestEngine(['email-password', 'session']);
      
      expect(() => minimalEngine.getPlugin('email-password')).not.toThrow();
      expect(() => minimalEngine.getPlugin('session')).not.toThrow();
      
      expect(minimalEngine.getPlugin('email-password')).toBeDefined();
      expect(minimalEngine.getPlugin('session')).toBeDefined();
      expect(minimalEngine.getPlugin('anonymous')).toBeUndefined();
    });

    it('should provide access to container and services', () => {
      const container = engine.getContainer();
      expect(container).toBeDefined();
      expect(container.cradle.dbClient).toBeDefined();
      expect(container.cradle.sessionService).toBeDefined();

      const sessionService = engine.getSessionService();
      expect(sessionService).toBeDefined();
      expect(sessionService.createSession).toBeDefined();
      expect(sessionService.verifySession).toBeDefined();
    });
  });

  describe('Plugin Step Execution', () => {
    it.skip('should execute plugin steps through engine interface', async () => {
      // TODO: Mock external API calls for password breach check
      // Test email-password registration
      const registrationData = TestDataFactory.emailPasswordData();
      
      const result = await engine.executeStep('email-password', 'register', registrationData);
      
      TestAssertions.assertSuccess(result);
      expect(result.data).toBeDefined();
    });

    it('should validate input using plugin validation schema', async () => {
      // Test with invalid input (missing required fields)
      const invalidData = { email: 'not-an-email' };
      
      await expect(
        engine.executeStep('email-password', 'register', invalidData)
      ).rejects.toThrow(/validation/i);
    });

    it('should throw error for non-existent step', async () => {
      await expect(
        engine.executeStep('email-password', 'non-existent-step', {})
      ).rejects.toThrow(/step not found/i);
    });

    it('should execute anonymous plugin steps', async () => {
      const guestData = TestDataFactory.anonymousData();
      
      const result = await engine.executeStep('anonymous', 'create-guest', guestData);
      
      TestAssertions.assertSuccess(result);
      
      // Anonymous plugin may return different data structure
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should execute API key plugin steps', async () => {
      // First create a subject
      const subjectData = TestDataFactory.subjectData();
      const mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
      await mockDb.create('subjects', subjectData);
      
      // Create a session for the subject
      const token = await engine.createSessionFor('subject', subjectData.id);
      
      const apiKeyData = {
        ...TestDataFactory.apiKeyData(),
        token, // Include the session token
      };
      
      const result = await engine.executeStep('api-key', 'create-api-key', apiKeyData);
      
      TestAssertions.assertSuccess(result);
      TestAssertions.assertHasData(result, ['api_key', 'metadata']);
    });
  });

  describe('Session Management Integration', () => {
    it('should create session through engine', async () => {
      const sessionData = TestDataFactory.sessionData();
      
      const token = await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      expect(token).toBeDefined();
      expect(typeof token === 'string' || (typeof token === 'object' && token.accessToken)).toBe(true);
    });

    it('should verify created session', async () => {
      // Create a subject in the database first
      const mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
      const subjectData = TestDataFactory.subjectData();
      await mockDb.create('subjects', subjectData);
      
      const sessionData = TestDataFactory.sessionData({
        subjectId: subjectData.id
      });
      
      const token = await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      const session = await engine.checkSession(token);
      
      TestAssertions.assertValidSession(session);
    });

    it('should destroy session through session service', async () => {
      const sessionData = TestDataFactory.sessionData();
      
      const token = await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      // Destroy session through session service
      await engine.getSessionService().destroySession(token);
      
      const session = await engine.checkSession(token);
      TestAssertions.assertInvalidSession(session);
    });

    it('should destroy all sessions for a subject', async () => {
      const sessionData = TestDataFactory.sessionData();
      
      // Create multiple sessions for the same subject
      const token1 = await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      const token2 = await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      // Destroy all sessions for the subject
      await engine.getSessionService().destroyAllSessions(
        sessionData.subjectType,
        sessionData.subjectId
      );
      
      const session1 = await engine.checkSession(token1);
      const session2 = await engine.checkSession(token2);
      
      TestAssertions.assertInvalidSession(session1);
      TestAssertions.assertInvalidSession(session2);
    });

    it('should handle invalid session tokens', async () => {
      const invalidToken = 'invalid-token-123';
      
      const session = await engine.checkSession(invalidToken);
      
      TestAssertions.assertInvalidSession(session);
    });
  });

  describe('Hook System Integration', () => {
    it('should execute auth hooks on step execution', async () => {
      const hookCalls: string[] = [];
      
      // Register before hook
      engine.registerAuthHook({
        type: 'before',
        universal: true,
        fn: async (data) => {
          hookCalls.push('before');
          return data;
        },
      });
      
      // Register after hook
      engine.registerAuthHook({
        type: 'after',
        universal: true,
        fn: async (data) => {
          hookCalls.push('after');
          return data;
        },
      });
      
      const testData = TestDataFactory.anonymousData();
      await engine.executeStep('anonymous', 'create-guest', testData);
      
      expect(hookCalls).toContain('before');
      expect(hookCalls).toContain('after');
    });

    it('should execute session hooks on session operations', async () => {
      const sessionHookCalls: string[] = [];
      
      engine.registerSessionHook({
        type: 'before',
        session: true,
        fn: async (data) => {
          sessionHookCalls.push('session-before');
          return data;
        },
      });
      
      engine.registerSessionHook({
        type: 'after',
        session: true,
        fn: async (data) => {
          sessionHookCalls.push('session-after');
          return data;
        },
      });
      
      const sessionData = TestDataFactory.sessionData();
      await engine.createSessionFor(
        sessionData.subjectType,
        sessionData.subjectId,
        sessionData.ttlSeconds
      );
      
      expect(sessionHookCalls).toContain('session-before');
      expect(sessionHookCalls).toContain('session-after');
    });

    it('should execute error hooks on step failures', async () => {
      const errorHookCalls: string[] = [];
      
      engine.registerAuthHook({
        type: 'onError',
        pluginName: 'anonymous',
        fn: async (data, container, error) => {
          errorHookCalls.push('error-hook');
        },
      });
      
      // Attempt invalid step execution that will definitely fail
      try {
        await engine.executeStep('anonymous', 'create-guest', { invalid: 'data without required fields' });
      } catch (error) {
        // Expected to throw due to validation or other issues
      }
      
      // Should have called error hook
      expect(errorHookCalls).toContain('error-hook');
    });

    it('should execute plugin-specific hooks only for target plugin', async () => {
      const pluginSpecificCalls: string[] = [];
      
      engine.registerAuthHook({
        type: 'before',
        pluginName: 'anonymous',
        fn: async (data) => {
          pluginSpecificCalls.push('anonymous-hook');
          return data;
        },
      });
      
      // Execute anonymous plugin step
      const anonymousData = TestDataFactory.anonymousData();
      await engine.executeStep('anonymous', 'create-guest', anonymousData);
      
      expect(pluginSpecificCalls).toContain('anonymous-hook');
      
      // Reset calls
      pluginSpecificCalls.length = 0;
      
      // Execute different plugin step (should not trigger hook)
      const emailData = TestDataFactory.emailPasswordData();
      try {
        await engine.executeStep('email-password', 'register', emailData);
      } catch {
        // May fail due to validation, but hook shouldn't be called
      }
      
      expect(pluginSpecificCalls).not.toContain('anonymous-hook');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle plugin initialization errors gracefully', () => {
      // This test verifies that the engine handles plugin initialization failures
      // In a real scenario, a plugin might fail to initialize due to missing dependencies
      expect(() => {
        const invalidEngine = createMinimalTestEngine(['non-existent-plugin']);
      }).toThrow();
    });

    it('should validate plugin configuration', () => {
      // Test that plugins receive and validate their configuration
      const engine = createTestReAuthEngine();
      const plugin = engine.getPlugin('email-password');
      
      expect(plugin.config).toBeDefined();
      expect(plugin.config.testUsers).toBeDefined();
      expect(plugin.config.testUsers.enabled).toBe(true);
    });

    it('should handle concurrent step executions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const data = TestDataFactory.anonymousData({ 
          fingerprint: `concurrent_test_${i}` 
        });
        return engine.executeStep('anonymous', 'create-guest', data);
      });
      
      const results = await Promise.all(promises);
      
      // All executions should succeed
      results.forEach(result => {
        TestAssertions.assertSuccess(result);
      });
      
      // Should have received responses
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        null,
        undefined,
        'not-an-object',
        { circular: {} },
        { buffer: Buffer.from('test') },
      ];
      
      // Add circular reference for testing
      malformedInputs[3].circular.ref = malformedInputs[3];
      
      for (const input of malformedInputs) {
        await expect(
          engine.executeStep('anonymous', 'create-guest', input as any)
        ).rejects.toThrow();
      }
    });

    it('should handle database connection failures', async () => {
      // Mock database failure by creating an engine with a failing database
      const failingDbClient = {
        async version() {
          throw new Error('Database connection failed');
        },
        orm() {
          throw new Error('Database connection failed');
        },
      };
      
      // Creating the engine itself doesn't throw, but using it should
      const engine = createTestReAuthEngine({ dbClient: failingDbClient });
      
      // Using the engine should fail
      await expect(
        engine.executeStep('anonymous', 'create-guest', TestDataFactory.anonymousData())
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Cleanup Scheduler Integration', () => {
    it('should register cleanup tasks from plugins', () => {
      const scheduler = engine.getCleanupScheduler();
      const tasks = scheduler.getRegisteredTasks();
      
      // Should have cleanup tasks from various plugins
      expect(tasks.length).toBeGreaterThan(0);
      
      const taskNames = tasks.map(t => t.name);
      expect(taskNames).toContain('expired-codes'); // from email-password plugin
      expect(taskNames).toContain('expired-sessions'); // from anonymous plugin
    });

    it('should start and stop cleanup scheduler', async () => {
      const scheduler = engine.getCleanupScheduler();
      
      expect(scheduler.isRunning()).toBe(false);
      
      await engine.startCleanupScheduler();
      expect(scheduler.isRunning()).toBe(true);
      
      await engine.stopCleanupScheduler();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should handle cleanup scheduler with disabled state', () => {
      // Engine created with cleanup scheduler disabled
      expect(engine.getCleanupScheduler().isRunning()).toBe(false);
    });
  });
});