import { describe, it, expect } from 'vitest';
import mcpPluginV2 from './plugin.v2';
import { hashServerKey, verifyServerKey, generateSessionToken, isSessionExpired } from './utils';

describe('MCP Plugin V2', () => {
  describe('Plugin Structure', () => {
    it('should have the correct name', () => {
      expect(mcpPluginV2.name).toBe('mcp');
    });

    it('should have all required steps', () => {
      const stepNames = mcpPluginV2.steps?.map(s => s.name) || [];
      expect(stepNames).toContain('authenticate-mcp-server');
      expect(stepNames).toContain('create-mcp-session');
      expect(stepNames).toContain('authorize-resource');
      expect(stepNames).toContain('list-resources');
      expect(stepNames).toContain('revoke-mcp-session');
      expect(stepNames).toContain('audit-mcp-access');
    });

    it('should have default configuration', () => {
      expect(mcpPluginV2.config).toBeDefined();
      expect(mcpPluginV2.config?.sessionTtlMinutes).toBe(60);
      expect(mcpPluginV2.config?.auditingEnabled).toBe(true);
      expect(mcpPluginV2.config?.requireTLS).toBe(true);
    });

    it('should have root hooks for cleanup and auditing', () => {
      expect(mcpPluginV2.rootHooks).toBeDefined();
      expect(mcpPluginV2.rootHooks?.before).toBeDefined();
      expect(mcpPluginV2.rootHooks?.after).toBeDefined();
      expect(mcpPluginV2.rootHooks?.onError).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should hash and verify server keys correctly', () => {
      const serverKey = 'test-server-key-123';
      const hash = hashServerKey(serverKey);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex string
      expect(verifyServerKey(serverKey, hash)).toBe(true);
      expect(verifyServerKey('wrong-key', hash)).toBe(false);
    });

    it('should generate unique session tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes as hex
    });

    it('should correctly check session expiration', () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      const futureDate = new Date(Date.now() + 1000); // 1 second from now
      
      expect(isSessionExpired(pastDate)).toBe(true);
      expect(isSessionExpired(futureDate)).toBe(false);
    });
  });

  describe('Step Configuration', () => {
    it('should have proper validation schemas for all steps', () => {
      const steps = mcpPluginV2.steps || [];
      
      for (const step of steps) {
        expect(step.validationSchema).toBeDefined();
        expect(step.outputs).toBeDefined();
        expect(step.protocol).toBeDefined();
        expect(step.inputs).toBeDefined();
        expect(Array.isArray(step.inputs)).toBe(true);
      }
    });

    it('should have HTTP protocol configuration for all steps', () => {
      const steps = mcpPluginV2.steps || [];
      
      for (const step of steps) {
        expect(step.protocol?.http).toBeDefined();
        expect(step.protocol?.http?.method).toBeDefined();
        expect(step.protocol?.http?.codes).toBeDefined();
      }
    });
  });

  describe('Schema and Configuration', () => {
    it('should have a complete plugin structure', () => {
      // Test basic plugin structure
      expect(mcpPluginV2.name).toBe('mcp');
      expect(mcpPluginV2.steps).toBeDefined();
      expect(mcpPluginV2.config).toBeDefined();
      expect(mcpPluginV2.rootHooks).toBeDefined();
      
      // Test that all steps are properly configured
      const steps = mcpPluginV2.steps || [];
      expect(steps.length).toBe(6);
      
      // Test that configuration has expected defaults
      expect(mcpPluginV2.config?.sessionTtlMinutes).toBe(60);
      expect(mcpPluginV2.config?.auditingEnabled).toBe(true);
      expect(mcpPluginV2.config?.requireTLS).toBe(true);
    });
  });
});