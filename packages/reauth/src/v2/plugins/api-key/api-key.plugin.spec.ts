import { describe, it, expect } from 'vitest';
import apiKeyPluginV2 from './plugin.v2';
import { generateApiKey, hashApiKey, isValidApiKeyFormat, validateScopes } from './utils';

describe('API Key Plugin V2', () => {
  it('should have the correct plugin name', () => {
    expect(apiKeyPluginV2.name).toBe('api-key');
  });

  it('should have all required steps', () => {
    expect(apiKeyPluginV2.steps).toHaveLength(5);
    
    const stepNames = apiKeyPluginV2.steps?.map(s => s.name) || [];
    expect(stepNames).toContain('authenticate-api-key');
    expect(stepNames).toContain('create-api-key');
    expect(stepNames).toContain('list-api-keys');
    expect(stepNames).toContain('revoke-api-key');
    expect(stepNames).toContain('update-api-key');
  });

  it('should generate valid API keys', () => {
    const apiKey1 = generateApiKey();
    const apiKey2 = generateApiKey({ keyPrefix: 'test_' });
    const apiKey3 = generateApiKey({ keyLength: 64 });
    
    expect(apiKey1).toMatch(/^ak_[A-Za-z0-9_-]+$/);
    expect(apiKey2).toMatch(/^test_[A-Za-z0-9_-]+$/);
    expect(apiKey3.length).toBeGreaterThan(64);
    
    // Should be unique
    expect(apiKey1).not.toBe(apiKey2);
  });

  it('should validate API key format', () => {
    expect(isValidApiKeyFormat('ak_1234567890abcdef1234567890')).toBe(true);
    expect(isValidApiKeyFormat('test_1234567890abcdef1234567890', 'test_')).toBe(true);
    expect(isValidApiKeyFormat('invalid')).toBe(false);
    expect(isValidApiKeyFormat('ak_short')).toBe(false);
    expect(isValidApiKeyFormat('wrong_prefix')).toBe(false);
  });

  it('should hash and verify API keys', async () => {
    const apiKey = generateApiKey();
    const hash = await hashApiKey(apiKey);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(apiKey);
    expect(hash.length).toBeGreaterThan(50); // Hashed passwords are long
  });

  it('should validate scopes correctly', () => {
    const allowedScopes = ['read', 'write', 'admin'];
    
    expect(validateScopes(['read'], allowedScopes)).toEqual([]);
    expect(validateScopes(['read', 'write'], allowedScopes)).toEqual([]);
    expect(validateScopes(['invalid'], allowedScopes)).toHaveLength(1);
    expect(validateScopes(['read', 'invalid'], allowedScopes)).toHaveLength(1);
    expect(validateScopes(undefined, allowedScopes)).toEqual([]);
    expect(validateScopes(['anything'], undefined)).toEqual([]);
  });

  it('should export sensitive fields correctly', () => {
    const sensitiveFields = apiKeyPluginV2.getSensitiveFields?.();
    expect(sensitiveFields).toContain('key_hash');
  });

  it('should have proper default configuration', () => {
    const config = apiKeyPluginV2.config;
    expect(config?.keyLength).toBe(32);
    expect(config?.keyPrefix).toBe('ak_');
    expect(config?.defaultTtlDays).toBe(365);
    expect(config?.maxKeysPerUser).toBe(10);
    expect(config?.enableUsageTracking).toBe(false);
  });

  it('should have proper step metadata', () => {
    const authenticateStep = apiKeyPluginV2.steps?.find(s => s.name === 'authenticate-api-key');
    
    expect(authenticateStep?.description).toContain('API key');
    expect(authenticateStep?.inputs).toContain('api_key');
    expect(authenticateStep?.protocol?.http?.method).toBe('POST');
    expect(authenticateStep?.outputs).toBeDefined();
    expect(authenticateStep?.validationSchema).toBeDefined();
  });
});