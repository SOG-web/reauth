/**
 * V2 Plugins Validation Test
 * 
 * This test validates that the V2 phone and username plugins
 * are correctly implemented and can be imported.
 */

import { describe, it, expect } from 'vitest';

describe('V2 Plugins Implementation', () => {
  it('should export phone plugin from V2 index', async () => {
    const { basePhonePasswordPluginV2 } = await import('../index.js');
    
    expect(basePhonePasswordPluginV2).toBeDefined();
    expect(basePhonePasswordPluginV2.name).toBe('phone-password');
    expect(basePhonePasswordPluginV2.steps).toBeDefined();
    expect(Array.isArray(basePhonePasswordPluginV2.steps)).toBe(true);
    
    // Check that all required steps are present
    const stepNames = basePhonePasswordPluginV2.steps?.map(step => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
  });

  it('should export username plugin from V2 index', async () => {
    const { baseUsernamePasswordPluginV2 } = await import('../index.js');
    
    expect(baseUsernamePasswordPluginV2).toBeDefined();
    expect(baseUsernamePasswordPluginV2.name).toBe('username-password');
    expect(baseUsernamePasswordPluginV2.steps).toBeDefined();
    expect(Array.isArray(baseUsernamePasswordPluginV2.steps)).toBe(true);
    
    // Check that core steps are present (no verification for username)
    const stepNames = baseUsernamePasswordPluginV2.steps?.map(step => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
    expect(stepNames).toContain('change-password');
  });

  it('should export schemas from V2 index', async () => {
    const { phonePasswordSchemaV2, usernamePasswordSchemaV2 } = await import('../index.js');
    
    expect(phonePasswordSchemaV2).toBeDefined();
    expect(phonePasswordSchemaV2.tables).toBeDefined();
    expect(phonePasswordSchemaV2.tables?.phone_identities).toBeDefined();
    
    expect(usernamePasswordSchemaV2).toBeDefined();
    expect(usernamePasswordSchemaV2.tables).toBeDefined();
    expect(usernamePasswordSchemaV2.tables?.username_identities).toBeDefined();
  });
});