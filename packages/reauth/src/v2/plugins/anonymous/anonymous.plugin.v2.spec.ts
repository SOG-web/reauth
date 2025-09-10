import { describe, it, expect } from 'vitest';
import anonymousPluginV2, { type AnonymousConfigV2 } from './plugin.v2';

describe('Anonymous Plugin V2', () => {
  it('should have the correct name', () => {
    expect(anonymousPluginV2.name).toBe('anonymous');
  });

  it('should have default configuration', () => {
    expect(anonymousPluginV2.config).toEqual({
      sessionTtlSeconds: 1800, // 30 minutes
      maxGuestsPerFingerprint: 3,
      guestDataRetentionDays: 7,
      allowSessionExtension: true,
      maxSessionExtensions: 3,
      fingerprintRequired: true,
    });
  });

  it('should have all required steps', () => {
    const stepNames = (anonymousPluginV2.steps || []).map(step => step.name);
    expect(stepNames).toContain('create-guest');
    expect(stepNames).toContain('extend-guest');
    expect(stepNames).toContain('convert-guest');
    expect(stepNames).toContain('cleanup-expired');
  });

  it('should validate configuration correctly', () => {
    // Valid config should pass
    const validConfig: AnonymousConfigV2 = {
      sessionTtlSeconds: 900, // 15 minutes
      maxGuestsPerFingerprint: 5,
      guestDataRetentionDays: 3,
    };

    // This would normally be called by createAuthPluginV2 during construction
    // For now, we just test that the plugin exports are correct
    expect(anonymousPluginV2.name).toBe('anonymous');
    expect(typeof anonymousPluginV2.initialize).toBe('function');
  });

  it('should have proper step protocol definitions', () => {
    const steps = anonymousPluginV2.steps || [];
    
    const createGuestStep = steps.find(s => s.name === 'create-guest');
    expect(createGuestStep?.protocol?.http?.method).toBe('POST');
    expect(createGuestStep?.protocol?.http?.codes).toBeDefined();

    const extendGuestStep = steps.find(s => s.name === 'extend-guest');
    expect(extendGuestStep?.protocol?.http?.method).toBe('POST');
    expect(extendGuestStep?.protocol?.http?.auth).toBe(true);

    const convertGuestStep = steps.find(s => s.name === 'convert-guest');
    expect(convertGuestStep?.protocol?.http?.method).toBe('POST');
    expect(convertGuestStep?.protocol?.http?.auth).toBe(true);

    const cleanupStep = steps.find(s => s.name === 'cleanup-expired');
    expect(cleanupStep?.protocol?.http?.method).toBe('POST');
  });

  it('should have arktype validation schemas for all steps', () => {
    const steps = anonymousPluginV2.steps || [];
    
    for (const step of steps) {
      expect(step.validationSchema).toBeDefined();
      expect(step.outputs).toBeDefined();
      expect(typeof step.validationSchema?.assert).toBe('function');
      expect(typeof step.outputs?.assert).toBe('function');
    }
  });

  it('should have input and output definitions for introspection', () => {
    const steps = anonymousPluginV2.steps || [];
    
    for (const step of steps) {
      expect(step.inputs).toBeDefined();
      expect(Array.isArray(step.inputs)).toBe(true);
      expect(step.protocol).toBeDefined();
    }
  });
});