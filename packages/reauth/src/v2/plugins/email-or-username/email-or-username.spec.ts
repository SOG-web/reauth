/**
 * Email-or-username plugin test
 * 
 * This test validates that the email-or-username plugin
 * is correctly implemented and can be imported.
 */

import { describe, it, expect } from 'vitest';

describe('Email-or-username Plugin Implementation', () => {
  it('should export the plugin correctly', async () => {
    const { baseEmailOrUsernamePluginV2 } = await import('./plugin.v2');
    
    expect(baseEmailOrUsernamePluginV2).toBeDefined();
    expect(baseEmailOrUsernamePluginV2.name).toBe('email-or-username');
    expect(baseEmailOrUsernamePluginV2.steps).toBeDefined();
    expect(Array.isArray(baseEmailOrUsernamePluginV2.steps)).toBe(true);
    
    // Check that core steps are present
    const stepNames = baseEmailOrUsernamePluginV2.steps?.map(step => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
    expect(stepNames).toContain('change-password');
  });

  it('should use schemas from underlying plugins', async () => {
    // This plugin doesn't have its own schema - it delegates to underlying plugins
    const { emailPasswordSchemaV2 } = await import('../email-password/schema.v2');
    const { usernamePasswordSchemaV2 } = await import('../username/schema.v2');
    
    // Verify that underlying plugin schemas are available
    expect(emailPasswordSchemaV2).toBeDefined();
    expect(emailPasswordSchemaV2.tables?.email_identities).toBeDefined();
    
    expect(usernamePasswordSchemaV2).toBeDefined();
    expect(usernamePasswordSchemaV2.tables?.username_identities).toBeDefined();
  });

  it('should export utility functions', async () => {
    const { detectInputType, isValidEmail, findTestUser } = await import('./utils');
    
    expect(detectInputType).toBeDefined();
    expect(typeof detectInputType).toBe('function');
    
    // Test email detection
    expect(detectInputType('user@example.com')).toBe('email');
    expect(detectInputType('username123')).toBe('username');
    
    expect(isValidEmail).toBeDefined();
    expect(typeof isValidEmail).toBe('function');
    
    // Test email validation
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    
    expect(findTestUser).toBeDefined();
    expect(typeof findTestUser).toBe('function');
  });

  it('should have correct default configuration', async () => {
    const { baseEmailOrUsernamePluginV2 } = await import('./plugin.v2');
    
    const config = baseEmailOrUsernamePluginV2.config;
    expect(config).toBeDefined();
    expect(config?.detectionStrategy).toBe('auto');
    expect(config?.allowBothTypes).toBe(false);
    expect(config?.sessionTtlSeconds).toBe(3600);
    expect(config?.loginOnRegister).toBe(true);
  });
});