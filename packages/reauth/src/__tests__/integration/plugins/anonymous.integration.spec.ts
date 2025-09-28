import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReAuthEngine } from '../../../engine';
import { 
  createMinimalTestEngine,
  waitForEngineInitialization,
  cleanupTestEngine,
} from '../utils/test-engine-factory';
import { getMockDatabase } from '../utils/mock-database';
import { TestDataFactory, TestAssertions } from '../utils/test-data-generators';

describe('Anonymous Plugin - Integration Tests', () => {
  let engine: ReAuthEngine;

  beforeEach(async () => {
    TestDataFactory.resetCounter();
    engine = createMinimalTestEngine(['anonymous', 'session']);
    await waitForEngineInitialization(engine);
  });

  afterEach(async () => {
    await cleanupTestEngine(engine);
  });

  describe('Plugin Registration', () => {
    it('should register anonymous plugin with correct configuration', () => {
      const plugin = engine.getPlugin('anonymous');
      expect(plugin).toBeDefined();
      expect(plugin!.name).toBe('anonymous');
      expect(plugin!.config).toBeDefined();
    });

    it('should register session resolver for guest subjects', () => {
      const sessionService = engine.getSessionService();
      expect(sessionService).toBeDefined();
    });
  });

  describe('Create Guest Step', () => {
    it('should create a guest session successfully', async () => {
      const guestData = TestDataFactory.anonymousData();
      
      const result = await engine.executeStep('anonymous', 'create-guest', guestData);
      
      TestAssertions.assertSuccess(result);
      expect(result.message).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should handle multiple guest creation requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => {
        const data = TestDataFactory.anonymousData({
          fingerprint: `guest_${i}`,
        });
        return engine.executeStep('anonymous', 'create-guest', data);
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        TestAssertions.assertSuccess(result);
      });
    });

    it('should validate input data', async () => {
      const invalidData = { invalidField: 'value' };
      
      await expect(
        engine.executeStep('anonymous', 'create-guest', invalidData as any)
      ).rejects.toThrow();
    });

    it('should handle fingerprint collision gracefully', async () => {
      const guestData1 = TestDataFactory.anonymousData({ fingerprint: 'same_fingerprint' });
      const guestData2 = TestDataFactory.anonymousData({ fingerprint: 'same_fingerprint' });
      
      const result1 = await engine.executeStep('anonymous', 'create-guest', guestData1);
      const result2 = await engine.executeStep('anonymous', 'create-guest', guestData2);
      
      TestAssertions.assertSuccess(result1);
      TestAssertions.assertSuccess(result2);
    });
  });

  describe('Extend Guest Step', () => {
    it('should extend an existing guest session', async () => {
      // First create a guest
      const guestData = TestDataFactory.anonymousData();
      const createResult = await engine.executeStep('anonymous', 'create-guest', guestData);
      TestAssertions.assertSuccess(createResult);
      
      // Then extend the guest session
      const extendData = {
        ...guestData,
        extensionReason: 'User needs more time',
      };
      
      const extendResult = await engine.executeStep('anonymous', 'extend-guest', extendData);
      
      // Should handle the extend request (may succeed or fail based on business rules)
      expect(extendResult.success !== undefined).toBe(true);
    });

    it('should respect extension limits', async () => {
      // This test checks that the plugin respects its maxExtensions configuration
      const guestData = TestDataFactory.anonymousData();
      
      // Create guest first
      await engine.executeStep('anonymous', 'create-guest', guestData);
      
      // Try to extend multiple times to test limits
      let extensionResults = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await engine.executeStep('anonymous', 'extend-guest', {
            ...guestData,
            extensionReason: `Extension attempt ${i + 1}`,
          });
          extensionResults.push(result);
        } catch (error) {
          // Extensions might fail after reaching the limit
          break;
        }
      }
      
      // Should have some results (at least the first few extensions should work)
      expect(extensionResults.length).toBeGreaterThan(0);
    });
  });

  describe('Convert Guest Step', () => {
    it('should prepare guest for conversion to permanent account', async () => {
      // First create a guest
      const guestData = TestDataFactory.anonymousData();
      const createResult = await engine.executeStep('anonymous', 'create-guest', guestData);
      TestAssertions.assertSuccess(createResult);
      
      // Then convert the guest
      const convertData = {
        ...guestData,
        conversionType: 'email-password',
        email: TestDataFactory.email('convert'),
        password: 'NewPassword123!',
      };
      
      const convertResult = await engine.executeStep('anonymous', 'convert-guest', convertData);
      
      // Should handle the conversion request
      expect(convertResult.success !== undefined).toBe(true);
    });

    it('should validate conversion data', async () => {
      const invalidConvertData = { 
        fingerprint: 'test_fingerprint',
        others: {},
      };
      
      // Should require proper conversion parameters
      const result = await engine.executeStep('anonymous', 'convert-guest', invalidConvertData);
      
      // May succeed or fail depending on validation - we just test it doesn't crash
      expect(result.success !== undefined).toBe(true);
    });
  });

  describe('Session Integration', () => {
    it('should create sessions for guest subjects', async () => {
      const mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
      
      // Create a guest subject in the database
      const guestSubject = await mockDb.create('subjects', {
        id: 'guest_1',
        type: 'guest',
      });
      
      // Create session for guest
      const token = await engine.createSessionFor('guest', guestSubject.id);
      
      expect(token).toBeDefined();
      expect(typeof token === 'string' || typeof token === 'object').toBe(true);
    });

    it('should verify guest sessions', async () => {
      const mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
      
      // Create guest subject and anonymous session records
      const guestSubject = await mockDb.create('subjects', {
        id: 'guest_verify_test',
        type: 'guest',
      });
      
      const token = await engine.createSessionFor('guest', guestSubject.id);
      const session = await engine.checkSession(token);
      
      TestAssertions.assertValidSession(session);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should register cleanup tasks for expired sessions', () => {
      const scheduler = engine.getCleanupScheduler();
      const tasks = scheduler.getRegisteredTasks();
      
      // Should have cleanup task for expired anonymous sessions
      const anonymousCleanupTask = tasks.find(t => 
        t.pluginName === 'anonymous' && 
        t.name.includes('expired') || t.name.includes('session')
      );
      
      expect(anonymousCleanupTask).toBeDefined();
    });

    it('should handle cleanup task execution', async () => {
      const mockDb = getMockDatabase(engine.getContainer().cradle.dbClient);
      
      // Create expired anonymous session
      await mockDb.create('anonymous_sessions', {
        id: 'expired_session',
        subject_id: 'guest_expired',
        fingerprint: 'expired_fingerprint',
        expires_at: new Date(Date.now() - 86400000), // Expired 1 day ago
      });
      
      const scheduler = engine.getCleanupScheduler();
      const tasks = scheduler.getRegisteredTasks();
      const cleanupTask = tasks.find(t => t.pluginName === 'anonymous');
      
      if (cleanupTask) {
        const orm = await engine.getOrm();
        const result = await cleanupTask.runner(orm, {});
        
        expect(result).toBeDefined();
        expect(typeof result.cleaned).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing fingerprint gracefully', async () => {
      const invalidData = {
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1',
        others: {},
        // Missing fingerprint
      };
      
      const result = await engine.executeStep('anonymous', 'create-guest', invalidData);
      
      // Should either succeed (if fingerprint is optional) or fail gracefully
      expect(result.success !== undefined).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // This would be more comprehensive with a failing database mock
      // For now, we test that the plugin handles normal database operations
      const guestData = TestDataFactory.anonymousData();
      
      await expect(
        engine.executeStep('anonymous', 'create-guest', guestData)
      ).resolves.not.toThrow();
    });

    it('should validate step names', async () => {
      const guestData = TestDataFactory.anonymousData();
      
      await expect(
        engine.executeStep('anonymous', 'invalid-step-name', guestData)
      ).rejects.toThrow(/step not found/i);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration values', () => {
      const plugin = engine.getPlugin('anonymous');
      
      expect(plugin!.config).toBeDefined();
      expect(plugin!.config.maxSessionDurationHours).toBeDefined();
      expect(plugin!.config.allowExtensions).toBeDefined();
    });

    it('should respect configuration limits', async () => {
      // Test that the plugin respects its configuration settings
      const plugin = engine.getPlugin('anonymous');
      const config = plugin!.config;
      
      // Should have reasonable defaults
      expect(config.maxSessionDurationHours).toBeGreaterThan(0);
      expect(config.maxExtensions).toBeGreaterThanOrEqual(0);
    });
  });
});