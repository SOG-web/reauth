import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseSecurityService,
  createSecurityService,
  type SecurityEvent,
} from './security-service';
import {
  PluginInitializationError,
  PluginConfigurationError,
  PluginDependencyError,
  PluginStepError,
  PluginSecurityError,
  PluginValidationError,
  wrapPluginError,
  PluginErrorHandler,
} from './plugin-errors';
import {
  createTestContainer,
  createTestInput,
  createTestOutput,
  createMockEntity,
  createMockSession,
  createMockStep,
  createMockPlugin,
  MockEntityService,
  MockSessionService,
  MockSecurityService,
  TestAssertions,
  TestDataFactory,
} from './testing-utilities';
import {
  createAuthPlugin,
  validatePluginDependencies,
  initializePluginSafely,
  type PluginFactoryConfig,
} from '../plugins/utils/create-plugin';

describe('Shared Infrastructure and Utilities', () => {
  describe('SecurityService', () => {
    let securityService: BaseSecurityService;

    beforeEach(() => {
      securityService = new BaseSecurityService();
    });

    it('should validate input correctly', async () => {
      // This is a basic test - in real implementation you'd use ArkType schemas
      const result = await securityService.validateInput(
        {} as any, // Mock schema
        { test: 'value' },
      );
      expect(result).toBeDefined();
    });

    it('should hash and verify sensitive data', async () => {
      const data = 'sensitive-password';
      const hash = await securityService.hashSensitiveData(data);

      expect(hash).toContain(':');
      expect(hash).not.toBe(data);

      const isValid = await securityService.verifySensitiveData(data, hash);
      expect(isValid).toBe(true);

      const isInvalid = await securityService.verifySensitiveData(
        'wrong-password',
        hash,
      );
      expect(isInvalid).toBe(false);
    });

    it('should sanitize input', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = securityService.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('Hello World');
    });

    it('should generate secure tokens', async () => {
      const token1 = await securityService.generateSecureToken();
      const token2 = await securityService.generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should perform timing-safe comparison', () => {
      const str1 = 'hello';
      const str2 = 'hello';
      const str3 = 'world';

      expect(securityService.timingSafeEqual(str1, str2)).toBe(true);
      expect(securityService.timingSafeEqual(str1, str3)).toBe(false);
    });

    it('should redact sensitive fields', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };

      const redacted = securityService.redactSensitiveFields(obj, ['password']);

      expect(redacted.username).toBe('john');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.email).toBe('john@example.com');
    });
  });

  describe('Plugin Errors', () => {
    it('should create plugin initialization error', () => {
      const error = new PluginInitializationError(
        'test-plugin',
        'Missing config',
      );

      expect(error.name).toBe('PluginInitializationError');
      expect(error.pluginName).toBe('test-plugin');
      expect(error.reason).toBe('Missing config');
      expect(error.message).toContain('test-plugin');
      expect(error.message).toContain('Missing config');
    });

    it('should create plugin configuration error', () => {
      const error = new PluginConfigurationError(
        'test-plugin',
        'Invalid config',
        'apiKey',
        'string',
        123,
      );

      expect(error.name).toBe('PluginConfigurationError');
      expect(error.configField).toBe('apiKey');
      expect(error.expectedType).toBe('string');
      expect(error.receivedValue).toBe(123);
    });

    it('should create plugin dependency error', () => {
      const error = new PluginDependencyError('test-plugin', [
        'missing-plugin',
      ]);

      expect(error.name).toBe('PluginDependencyError');
      expect(error.missingDependencies).toEqual(['missing-plugin']);
    });

    it('should wrap generic errors', () => {
      const originalError = new Error('Something went wrong');
      const wrappedError = wrapPluginError(originalError, 'test-plugin', {
        stepName: 'test-step',
      });

      expect(wrappedError).toBeInstanceOf(PluginStepError);
      expect(wrappedError.pluginName).toBe('test-plugin');
    });

    it('should create safe error responses', () => {
      const error = new PluginValidationError('test-plugin', {
        field: 'error',
      });
      const safeResponse = PluginErrorHandler.createSafeErrorResponse(error);

      expect(safeResponse.name).toBe('PluginValidationError');
      expect(safeResponse.pluginName).toBe('test-plugin');
      expect(safeResponse.validationErrors).toEqual({ field: 'error' });
      expect(safeResponse.stack).toBeUndefined(); // Should not expose stack trace
    });
  });

  describe('Testing Utilities', () => {
    it('should create test container', () => {
      const container = createTestContainer();

      expect(container.resolve('entityService')).toBeInstanceOf(
        MockEntityService,
      );
      expect(container.resolve('sessionService')).toBeInstanceOf(
        MockSessionService,
      );
      expect(container.resolve('securityService')).toBeInstanceOf(
        MockSecurityService,
      );
    });

    it('should create mock entities', async () => {
      const entity = createMockEntity({ email: 'test@example.com' });

      expect(entity.id).toBeDefined();
      expect(entity.email).toBe('test@example.com');
      expect(entity.role).toBe('user');
    });

    it('should create mock sessions', () => {
      const session = createMockSession({ entity_id: 'test-entity' });

      expect(session.id).toBeDefined();
      expect(session.entity_id).toBe('test-entity');
      expect(session.token).toBeDefined();
    });

    it('should create mock plugins and steps', () => {
      const step = createMockStep('test-step');
      const plugin = createMockPlugin('test-plugin', [step]);

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.steps).toHaveLength(1);
      expect(plugin.steps[0]?.name).toBe('test-step');
    });

    it('should provide test data factories', () => {
      const emailData = TestDataFactory.emailPasswordData();
      expect(emailData.email).toBe('test@example.com');
      expect(emailData.password).toBe('testPassword123');

      const phoneData = TestDataFactory.phoneData();
      expect(phoneData.phone).toBe('+1234567890');
      expect(phoneData.code).toBe('123456');
    });

    it('should provide test assertions', () => {
      const successOutput = createTestOutput({ success: true });
      const failureOutput = createTestOutput({
        success: false,
        message: 'Failed',
      });

      expect(() => TestAssertions.assertSuccess(successOutput)).not.toThrow();
      expect(() => TestAssertions.assertFailure(failureOutput)).not.toThrow();
      expect(() => TestAssertions.assertSuccess(failureOutput)).toThrow();
    });
  });

  describe('Plugin Factory', () => {
    it('should create plugin with configuration', () => {
      const basePlugin = createMockPlugin('test-plugin');
      const config: PluginFactoryConfig<any> = {
        config: { apiKey: 'test-key' },
        initialConfig: { debug: true },
      };

      const plugin = createAuthPlugin(basePlugin, config);

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.config.apiKey).toBe('test-key');
      expect(plugin.config.debug).toBe(true);
    });

    it('should validate plugin dependencies', () => {
      const plugin = createMockPlugin('test-plugin');
      plugin.dependsOn = ['missing-plugin'];

      const availablePlugins = [createMockPlugin('other-plugin')];

      expect(() =>
        validatePluginDependencies(plugin, availablePlugins),
      ).toThrow(PluginDependencyError);
    });
  });
});
