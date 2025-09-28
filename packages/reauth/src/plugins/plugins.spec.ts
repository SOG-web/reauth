/**
 *  Plugins Validation Test
 *
 * This test validates that the  phone and username plugins
 * are correctly implemented and can be imported.
 */

import { describe, it, expect } from 'vitest';

describe(' Plugins Implementation', () => {
  it('should export phone plugin from  index', async () => {
    const { basePhonePasswordPlugin } = await import('../index.js');

    expect(basePhonePasswordPlugin).toBeDefined();
    expect(basePhonePasswordPlugin.name).toBe('phone-password');
    expect(basePhonePasswordPlugin.steps).toBeDefined();
    expect(Array.isArray(basePhonePasswordPlugin.steps)).toBe(true);

    // Check that all required steps are present
    const stepNames =
      basePhonePasswordPlugin.steps?.map((step) => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
  });

  it('should export username plugin from  index', async () => {
    const { baseUsernamePasswordPlugin } = await import('../index.js');

    expect(baseUsernamePasswordPlugin).toBeDefined();
    expect(baseUsernamePasswordPlugin.name).toBe('username-password');
    expect(baseUsernamePasswordPlugin.steps).toBeDefined();
    expect(Array.isArray(baseUsernamePasswordPlugin.steps)).toBe(true);

    // Check that core steps are present (no verification for username)
    const stepNames =
      baseUsernamePasswordPlugin.steps?.map((step) => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
    expect(stepNames).toContain('change-password');
  });

  it('should export email-or-username plugin from  index', async () => {
    const { baseEmailOrUsernamePlugin } = await import('../index.js');

    expect(baseEmailOrUsernamePlugin).toBeDefined();
    expect(baseEmailOrUsernamePlugin.name).toBe('email-or-username');
    expect(baseEmailOrUsernamePlugin.steps).toBeDefined();
    expect(Array.isArray(baseEmailOrUsernamePlugin.steps)).toBe(true);

    // Check that core steps are present
    const stepNames =
      baseEmailOrUsernamePlugin.steps?.map((step) => step.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
    expect(stepNames).toContain('change-password');
  });

  it('should export schemas from  index', async () => {
    const { phonePasswordSchema, usernamePasswordSchema } = await import(
      '../index.js'
    );

    expect(phonePasswordSchema).toBeDefined();
    expect(phonePasswordSchema.tables).toBeDefined();
    expect(phonePasswordSchema.tables?.phone_identities).toBeDefined();

    expect(usernamePasswordSchema).toBeDefined();
    expect(usernamePasswordSchema.tables).toBeDefined();
    expect(usernamePasswordSchema.tables?.username_identities).toBeDefined();
  });
});
