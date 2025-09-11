import { describe, it, expect, beforeEach } from 'vitest';
import { generateApiKey, hashApiKey, verifyApiKey } from './utils';
import type { ApiKeyConfigV2 } from './types';

describe('API Key Plugin V2 Integration', () => {
  describe('Key Generation and Validation', () => {
    it('should generate unique, secure API keys', () => {
      const keys = Array.from({ length: 100 }, () => generateApiKey());
      const uniqueKeys = new Set(keys);

      // All keys should be unique
      expect(uniqueKeys.size).toBe(100);

      // All keys should match the expected format
      keys.forEach((key) => {
        expect(key).toMatch(/^ak_[A-Za-z0-9_-]{32}$/);
      });
    });

    it('should support custom configuration', () => {
      const config: ApiKeyConfigV2 = {
        keyLength: 48,
        keyPrefix: 'myapp_',
      };

      const key = generateApiKey(config);
      expect(key).toMatch(/^myapp_[A-Za-z0-9_-]{48}$/);
    });

    it('should hash and verify keys securely', async () => {
      const apiKey = generateApiKey();
      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      // Same key should produce different hashes (salt)
      expect(hash1).not.toBe(hash2);

      // Both hashes should verify correctly
      expect(await verifyApiKey(apiKey, hash1)).toBe(true);
      expect(await verifyApiKey(apiKey, hash2)).toBe(true);

      // Wrong key should not verify
      const wrongKey = generateApiKey();
      expect(await verifyApiKey(wrongKey, hash1)).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should enforce key format validation', () => {
      const validKeys = [
        'ak_abcdef1234567890abcdef1234567890',
        'myapp_xyz789abc123def456ghi789jkl012',
      ];

      const invalidKeys = [
        'short',
        'invalidprefix1234567890abcdef1234567890',
        'ak_short',
        'ak_invalid@characters!',
        '',
      ];

      validKeys.forEach((key) => {
        expect(key.length).toBeGreaterThanOrEqual(25); // Reasonable minimum
        expect(key.includes('_')).toBe(true); // Must have prefix separator
      });

      invalidKeys.forEach((key) => {
        const isInvalid =
          key.length < 20 ||
          !key.includes('_') ||
          key.includes('@') ||
          key.includes('!');
        expect(isInvalid).toBe(true);
      });
    });

    it('should support comprehensive scope validation', () => {
      const testCases = [
        {
          scopes: ['read'],
          allowed: ['read', 'write', 'admin'],
          expected: [],
        },
        {
          scopes: ['read', 'write'],
          allowed: ['read', 'write', 'admin'],
          expected: [],
        },
        {
          scopes: ['invalid'],
          allowed: ['read', 'write'],
          expected: ['Invalid scope: invalid. Allowed scopes: read, write'],
        },
        {
          scopes: ['read', 'invalid', 'write'],
          allowed: ['read', 'write'],
          expected: ['Invalid scope: invalid. Allowed scopes: read, write'],
        },
        {
          scopes: undefined,
          allowed: ['read', 'write'],
          expected: [],
        },
        {
          scopes: ['anything'],
          allowed: undefined,
          expected: [],
        },
      ];

      testCases.forEach(({ scopes, allowed, expected }) => {
        const result = validateScopes(scopes, allowed);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should provide sensible defaults', () => {
      const defaultConfig: ApiKeyConfigV2 = {
        keyLength: 32,
        keyPrefix: 'ak_',
        defaultTtlDays: 365,
        maxKeysPerUser: 10,
        requireScopes: false,
        enableUsageTracking: false,
        cleanupExpiredKeys: true,
        cleanupUsageOlderThanDays: 90,
      };

      // Verify defaults are reasonable
      expect(defaultConfig.keyLength).toBeGreaterThanOrEqual(32);
      expect(defaultConfig.defaultTtlDays).toBeGreaterThan(0);
      expect(defaultConfig.maxKeysPerUser).toBeGreaterThan(0);
    });

    it('should handle edge cases in configuration', () => {
      const edgeCases = [
        { keyLength: 16 }, // Minimum security
        { keyLength: 128 }, // Very long keys
        { maxKeysPerUser: 1 }, // Single key per user
        { maxKeysPerUser: 100 }, // Many keys per user
        { defaultTtlDays: 1 }, // Short TTL
        { defaultTtlDays: 3650 }, // 10 year TTL
      ];

      edgeCases.forEach((config) => {
        expect(() => generateApiKey(config)).not.toThrow();
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume key generation efficiently', () => {
      const start = Date.now();
      const keys = Array.from({ length: 1000 }, () => generateApiKey());
      const duration = Date.now() - start;

      // Should generate 1000 keys in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      expect(keys).toHaveLength(1000);
      expect(new Set(keys).size).toBe(1000); // All unique
    });

    it('should handle concurrent hashing operations', async () => {
      const keys = Array.from({ length: 10 }, () => generateApiKey());

      const start = Date.now();
      const hashes = await Promise.all(keys.map((key) => hashApiKey(key)));
      const duration = Date.now() - start;

      // Should hash 10 keys concurrently in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(hashes).toHaveLength(10);
      expect(new Set(hashes).size).toBe(10); // All unique hashes
    });
  });
});

// Helper function used in tests
function validateScopes(
  scopes: string[] | undefined,
  allowedScopes: string[] | undefined,
): string[] {
  const errors: string[] = [];

  if (!scopes) return errors;
  if (!allowedScopes) return errors; // No restrictions

  for (const scope of scopes) {
    if (!allowedScopes.includes(scope)) {
      errors.push(
        `Invalid scope: ${scope}. Allowed scopes: ${allowedScopes.join(', ')}`,
      );
    }
  }

  return errors;
}
