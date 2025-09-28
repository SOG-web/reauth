/**
 * Comprehensive Email-or-Username Plugin Usage Examples
 *
 * This test demonstrates how the plugin would be used in practice.
 */

import { describe, it, expect } from 'vitest';
import { baseEmailOrUsernamePlugin } from './plugin';
import { emailPasswordSchema } from '../email-password/schema';
import { usernamePasswordSchema } from '../username/schema';

describe('Email-or-Username Plugin Usage Examples', () => {
  it('should demonstrate configuration options', async () => {
    // Example configuration combining both plugins
    const config = {
      detectionStrategy: 'auto',
      sessionTtlSeconds: 3600,
      loginOnRegister: true,
      emailConfig: {
        verifyEmail: false,
        sessionTtlSeconds: 3600,
      },
      usernameConfig: {
        sessionTtlSeconds: 3600,
      },
      testUsers: {
        enabled: true,
        users: [
          {
            email: 'test@example.com',
            password: 'password123',
            profile: { name: 'Test Email User' },
          },
          {
            username: 'testuser',
            password: 'password123',
            profile: { name: 'Test Username User' },
          },
        ],
        environment: 'development',
      },
    };

    expect(config.detectionStrategy).toBe('auto');
    expect(config.testUsers?.users).toHaveLength(2);
  });

  it('should demonstrate step validation schemas', async () => {
    const loginStep = baseEmailOrUsernamePlugin.steps?.find(
      (s) => s.name === 'login',
    );
    const registerStep = baseEmailOrUsernamePlugin.steps?.find(
      (s) => s.name === 'register',
    );
    const changePasswordStep = baseEmailOrUsernamePlugin.steps?.find(
      (s) => s.name === 'change-password',
    );

    expect(loginStep).toBeDefined();
    expect(loginStep?.inputs).toContain('emailOrUsername');
    expect(loginStep?.inputs).toContain('password');
    expect(loginStep?.protocol?.http?.method).toBe('POST');

    expect(registerStep).toBeDefined();
    expect(registerStep?.inputs).toContain('emailOrUsername');
    expect(registerStep?.inputs).toContain('password');

    expect(changePasswordStep).toBeDefined();
    expect(changePasswordStep?.inputs).toContain('currentPassword');
    expect(changePasswordStep?.inputs).toContain('newPassword');
    expect(changePasswordStep?.protocol?.http?.auth).toBe(true);
  });

  it('should demonstrate input validation examples', async () => {
    const { detectInputType, isValidEmail } = await import('./utils');

    // Email examples
    const emails = [
      'user@example.com',
      'test.user@domain.co.uk',
      'admin@company.org',
      'support+help@service.io',
    ];

    emails.forEach((email) => {
      expect(detectInputType(email)).toBe('email');
      expect(isValidEmail(email)).toBe(true);
    });

    // Username examples
    const usernames = [
      'username123',
      'user_name',
      'testuser',
      'admin-user',
      'simple',
    ];

    usernames.forEach((username) => {
      expect(detectInputType(username)).toBe('username');
      expect(isValidEmail(username)).toBe(false);
    });

    // Edge cases
    expect(detectInputType('user@domain')).toBe('username'); // Invalid email treated as username
    expect(detectInputType('@example.com')).toBe('username'); // Invalid email treated as username
  });

  it('should demonstrate plugin composition benefits', async () => {
    // Plugin provides unified interface
    expect(baseEmailOrUsernamePlugin.name).toBe('email-or-username');

    // Steps handle both input types
    const stepNames = baseEmailOrUsernamePlugin.steps?.map((s) => s.name) || [];
    expect(stepNames).toContain('login');
    expect(stepNames).toContain('register');
    expect(stepNames).toContain('change-password');

    // Uses schemas from underlying plugins (no conflicts)
    expect(emailPasswordSchema.tables?.email_identities).toBeDefined();
    expect(usernamePasswordSchema.tables?.username_identities).toBeDefined();

    // Configuration supports both underlying plugins
    const config = baseEmailOrUsernamePlugin.config;
    expect(config?.emailConfig).toBeDefined();
    expect(config?.usernameConfig).toBeDefined();
    expect(config?.detectionStrategy).toBe('auto');
  });
});
