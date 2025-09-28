/**
 * Email-or-username plugin test
 *
 * This test validates that the email-or-username plugin
 * is correctly implemented and can be imported.
 */

import { describe, it, expect } from 'vitest';
import { baseEmailOrUsernamePlugin } from './plugin';
import { emailPasswordSchema } from '../email-password/schema';
import { usernamePasswordSchema } from '../username/schema';

describe('Email-or-username Plugin Implementation', () => {
  it('should export the plugin correctly', async () => {
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

  it('should use schemas from underlying plugins', async () => {
    // This plugin doesn't have its own schema - it delegates to underlying plugins

    // Verify that underlying plugin schemas are available
    expect(emailPasswordSchema).toBeDefined();
    expect(emailPasswordSchema.tables?.email_identities).toBeDefined();

    expect(usernamePasswordSchema).toBeDefined();
    expect(usernamePasswordSchema.tables?.username_identities).toBeDefined();
  });

  it('should export utility functions', async () => {
    const { detectInputType, isValidEmail, findTestUser } = await import(
      './utils'
    );

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
    const config = baseEmailOrUsernamePlugin.config;
    expect(config).toBeDefined();
    expect(config?.detectionStrategy).toBe('auto');
    expect(config?.allowBothTypes).toBe(false);
    expect(config?.sessionTtlSeconds).toBe(3600);
    expect(config?.loginOnRegister).toBe(true);
  });
});
