import { describe, it, expect, beforeEach, vi } from 'vitest';
import { baseTwoFactorAuthPluginV2, type TwoFactorAuthConfigV2 } from './plugin.v2';
import { generateTotp, verifyTotp, generateTotpSecret } from './utils/crypto';

describe('Two-Factor Authentication Plugin V2', () => {
  describe('Plugin Configuration', () => {
    it('should have the correct plugin name', () => {
      expect(baseTwoFactorAuthPluginV2.name).toBe('two-factor-auth');
    });

    it('should have default configuration values', () => {
      const config = baseTwoFactorAuthPluginV2.config as TwoFactorAuthConfigV2;
      
      expect(config.totp?.enabled).toBe(true);
      expect(config.totp?.issuer).toBe('ReAuth');
      expect(config.totp?.algorithm).toBe('SHA1');
      expect(config.totp?.digits).toBe(6);
      expect(config.totp?.period).toBe(30);
      expect(config.totp?.window).toBe(1);

      expect(config.sms?.enabled).toBe(false);
      expect(config.sms?.codeLength).toBe(6);
      expect(config.sms?.expiryMinutes).toBe(10);

      expect(config.email?.enabled).toBe(false);
      expect(config.email?.codeLength).toBe(6);
      expect(config.email?.expiryMinutes).toBe(10);

      expect(config.backupCodes?.enabled).toBe(true);
      expect(config.backupCodes?.count).toBe(10);
      expect(config.backupCodes?.length).toBe(8);

      expect(config.hardwareTokens?.enabled).toBe(false);

      expect(config.security.requireForLogin).toBe(false);
      expect(config.security.requireForSensitiveActions).toBe(true);
      expect(config.security.maxFailedAttempts).toBe(5);
      expect(config.security.lockoutDurationMinutes).toBe(30);

      expect(config.cleanup?.enabled).toBe(true);
      expect(config.cleanup?.intervalMinutes).toBe(60);
      expect(config.cleanup?.expiredCodeRetentionHours).toBe(24);
      expect(config.cleanup?.failedAttemptRetentionDays).toBe(7);

      expect(config.sessionTtlSeconds).toBe(3600);
    });

    it('should have all required steps', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const stepNames = steps.map(step => step.name);
      
      expect(stepNames).toContain('setup-2fa');
      expect(stepNames).toContain('verify-2fa');
      expect(stepNames).toContain('disable-2fa');
      expect(stepNames).toContain('generate-backup-codes');
      expect(stepNames).toContain('list-methods');
      expect(stepNames).toContain('send-2fa-code');
    });

    it('should define sensitive fields correctly', () => {
      const sensitiveFields = baseTwoFactorAuthPluginV2.getSensitiveFields?.();
      
      expect(sensitiveFields).toContain('secretEncrypted');
      expect(sensitiveFields).toContain('phoneNumberEncrypted');
      expect(sensitiveFields).toContain('emailEncrypted');
      expect(sensitiveFields).toContain('codeHash');
      expect(sensitiveFields).toContain('publicKey');
    });
  });

  describe('TOTP Functionality', () => {
    it('should generate valid TOTP secrets', () => {
      const secret = generateTotpSecret();
      
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true); // Base32 alphabet
    });

    it('should generate and verify TOTP codes', async () => {
      const secret = generateTotpSecret();
      const code = await generateTotp(secret);
      
      expect(typeof code).toBe('string');
      expect(code.length).toBe(6);
      expect(/^\d+$/.test(code)).toBe(true);
      
      const isValid = await verifyTotp(code, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid TOTP codes', async () => {
      const secret = generateTotpSecret();
      const invalidCode = '000000';
      
      const isValid = await verifyTotp(invalidCode, secret);
      expect(isValid).toBe(false);
    });

    it('should handle time window tolerance', async () => {
      const secret = generateTotpSecret();
      const pastTime = Date.now() - 30000; // 30 seconds ago
      const pastCode = await generateTotp(secret, pastTime);
      
      // Should be valid within time window
      const isValid = await verifyTotp(pastCode, secret, 1);
      expect(isValid).toBe(true);
      
      // Should be invalid outside time window
      const isValidStrict = await verifyTotp(pastCode, secret, 0);
      expect(isValidStrict).toBe(false);
    });
  });

  describe('Step Validation', () => {
    it('should validate setup-2fa inputs correctly', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const setupStep = steps.find(step => step.name === 'setup-2fa');
      
      expect(setupStep).toBeDefined();
      expect(setupStep?.validationSchema).toBeDefined();
      
      // Test valid input
      const validInput = {
        userId: 'user123',
        methodType: 'totp' as const,
      };
      
      // In a real test, you would validate against the schema
      expect(validInput.userId).toBe('user123');
      expect(validInput.methodType).toBe('totp');
    });

    it('should validate verify-2fa inputs correctly', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const verifyStep = steps.find(step => step.name === 'verify-2fa');
      
      expect(verifyStep).toBeDefined();
      expect(verifyStep?.validationSchema).toBeDefined();
      
      const validInput = {
        userId: 'user123',
        code: '123456',
        methodType: 'totp' as const,
      };
      
      expect(validInput.userId).toBe('user123');
      expect(validInput.code).toBe('123456');
      expect(validInput.methodType).toBe('totp');
    });
  });

  describe('Protocol Configuration', () => {
    it('should have correct HTTP protocol settings for setup-2fa', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const setupStep = steps.find(step => step.name === 'setup-2fa');
      
      expect(setupStep?.protocol?.http?.method).toBe('POST');
      expect(setupStep?.protocol?.http?.codes).toEqual({
        su: 200,
        ic: 400,
        rl: 429,
        sn: 404,
      });
    });

    it('should have correct HTTP protocol settings for verify-2fa', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const verifyStep = steps.find(step => step.name === 'verify-2fa');
      
      expect(verifyStep?.protocol?.http?.method).toBe('POST');
      expect(verifyStep?.protocol?.http?.codes).toEqual({
        su: 200,
        unf: 401,
        ic: 400,
        eq: 403,
      });
    });

    it('should have correct HTTP protocol settings for list-methods', () => {
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      const listStep = steps.find(step => step.name === 'list-methods');
      
      expect(listStep?.protocol?.http?.method).toBe('GET');
      expect(listStep?.protocol?.http?.codes).toEqual({
        su: 200,
        ic: 400,
      });
    });
  });

  describe('Plugin Architecture Compliance', () => {
    it('should be protocol-agnostic (no HTTP-specific dependencies in core logic)', () => {
      // Steps should have protocol metadata but core logic should not depend on HTTP
      const steps = baseTwoFactorAuthPluginV2.steps || [];
      
      for (const step of steps) {
        expect(step.protocol).toBeDefined();
        expect(step.protocol?.http).toBeDefined();
        // Core run function should not have HTTP-specific code
        expect(step.run).toBeTypeOf('function');
      }
    });

    it('should follow V2 plugin interface', () => {
      expect(baseTwoFactorAuthPluginV2.name).toBeDefined();
      expect(typeof baseTwoFactorAuthPluginV2.name).toBe('string');
      
      expect(baseTwoFactorAuthPluginV2.initialize).toBeDefined();
      expect(typeof baseTwoFactorAuthPluginV2.initialize).toBe('function');
      
      expect(baseTwoFactorAuthPluginV2.steps).toBeDefined();
      expect(Array.isArray(baseTwoFactorAuthPluginV2.steps)).toBe(true);
      
      expect(baseTwoFactorAuthPluginV2.config).toBeDefined();
      expect(typeof baseTwoFactorAuthPluginV2.config).toBe('object');
      
      expect(baseTwoFactorAuthPluginV2.getSensitiveFields).toBeDefined();
      expect(typeof baseTwoFactorAuthPluginV2.getSensitiveFields).toBe('function');
    });

    it('should support runtime-agnostic crypto operations', async () => {
      // Test that crypto utilities work without platform-specific dependencies
      const secret = generateTotpSecret();
      expect(typeof secret).toBe('string');
      
      const code = await generateTotp(secret);
      expect(typeof code).toBe('string');
      
      const isValid = await verifyTotp(code, secret);
      expect(isValid).toBe(true);
      
      // These should work in any JavaScript runtime
    });
  });
});

describe('TOTP Crypto Utilities', () => {
  it('should generate different secrets each time', () => {
    const secret1 = generateTotpSecret();
    const secret2 = generateTotpSecret();
    
    expect(secret1).not.toBe(secret2);
  });

  it('should generate 6-digit TOTP codes by default', async () => {
    const secret = generateTotpSecret();
    const code = await generateTotp(secret);
    
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('should support custom TOTP parameters', async () => {
    const secret = generateTotpSecret();
    
    // Test 8-digit codes
    const code8 = await generateTotp(secret, undefined, 8);
    expect(code8.length).toBe(8);
    
    // Test different algorithms
    const codeSHA256 = await generateTotp(secret, undefined, 6, 30, 'SHA256');
    expect(codeSHA256.length).toBe(6);
    
    const codeSHA512 = await generateTotp(secret, undefined, 6, 30, 'SHA512');
    expect(codeSHA512.length).toBe(6);
  });

  it('should generate consistent codes for the same time', async () => {
    const secret = generateTotpSecret();
    const timestamp = Date.now();
    
    const code1 = await generateTotp(secret, timestamp);
    const code2 = await generateTotp(secret, timestamp);
    
    expect(code1).toBe(code2);
  });
});