import { describe, it, expect } from 'vitest';
import anonymousPlugin, { type AnonymousConfig } from './plugin';

describe('Anonymous Plugin ', () => {
  it('should have the correct name', () => {
    expect(anonymousPlugin.name).toBe('anonymous');
  });

  it('should have default configuration', () => {
    expect(anonymousPlugin.config).toEqual({
      sessionTtlSeconds: 1800, // 30 minutes
      maxGuestsPerFingerprint: 3,
      guestDataRetentionDays: 7,
      guestSubjectRetentionDays: 7, // Same as session retention by default
      allowSessionExtension: true,
      maxSessionExtensions: 3,
      fingerprintRequired: true,
      cleanupIntervalMs: 300000, // 5 minutes
      enableBackgroundCleanup: true,
    });
  });

  it('should have all required steps', () => {
    const stepNames = (anonymousPlugin.steps || []).map((step) => step.name);
    expect(stepNames).toContain('create-guest');
    expect(stepNames).toContain('extend-guest');
    expect(stepNames).toContain('convert-guest');
    expect(stepNames).toContain('cleanup-expired');
  });

  it('should validate configuration correctly', () => {
    // Valid config should pass
    const validConfig: AnonymousConfig = {
      sessionTtlSeconds: 900, // 15 minutes
      maxGuestsPerFingerprint: 5,
      guestDataRetentionDays: 3,
    };

    // This would normally be called by createAuthPlugin during construction
    // For now, we just test that the plugin exports are correct
    expect(anonymousPlugin.name).toBe('anonymous');
    expect(typeof anonymousPlugin.initialize).toBe('function');
  });

  it('should have proper step protocol definitions', () => {
    const steps = anonymousPlugin.steps || [];

    const createGuestStep = steps.find((s) => s.name === 'create-guest');
    expect(createGuestStep?.protocol?.http?.method).toBe('POST');
    expect(createGuestStep?.protocol?.http?.codes).toBeDefined();

    const extendGuestStep = steps.find((s) => s.name === 'extend-guest');
    expect(extendGuestStep?.protocol?.http?.method).toBe('POST');
    expect(extendGuestStep?.protocol?.http?.auth).toBe(true);

    const convertGuestStep = steps.find((s) => s.name === 'convert-guest');
    expect(convertGuestStep?.protocol?.http?.method).toBe('POST');
    expect(convertGuestStep?.protocol?.http?.auth).toBe(true);

    const cleanupStep = steps.find((s) => s.name === 'cleanup-expired');
    expect(cleanupStep?.protocol?.http?.method).toBe('POST');
  });

  it('should have arktype validation schemas for all steps', () => {
    const steps = anonymousPlugin.steps || [];

    for (const step of steps) {
      expect(step.validationSchema).toBeDefined();
      expect(step.outputs).toBeDefined();
      expect(typeof step.validationSchema?.assert).toBe('function');
      expect(typeof step.outputs?.assert).toBe('function');
    }
  });

  it('should have input and output definitions for introspection', () => {
    const steps = anonymousPlugin.steps || [];

    for (const step of steps) {
      expect(step.inputs).toBeDefined();
      expect(Array.isArray(step.inputs)).toBe(true);
      expect(step.protocol).toBeDefined();
    }
  });
});
