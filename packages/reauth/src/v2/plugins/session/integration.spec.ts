import { describe, it, expect } from 'vitest';
import sessionPluginV2, {
  type SessionConfigV2,
  sessionSchemaV2,
} from './plugin.v2';

describe('Session Plugin V2 Integration', () => {
  it('should have the correct plugin name', () => {
    expect(sessionPluginV2.name).toBe('session');
  });

  it('should have all session management steps', () => {
    const plugin = sessionPluginV2;
    expect(plugin.steps).toBeDefined();
    expect(plugin.steps?.length).toBe(5);

    const stepNames = plugin.steps?.map((s) => s.name) || [];
    expect(stepNames).toContain('list-sessions');
    expect(stepNames).toContain('cleanup-expired');
    expect(stepNames).toContain('logout');
    expect(stepNames).toContain('logout-all');
    expect(stepNames).toContain('get-session');
  });

  it('should have correct default configuration', () => {
    const plugin = sessionPluginV2;
    expect(plugin.config).toBeDefined();
    expect(plugin.config?.deviceTrackingEnabled).toBe(true);
    expect(plugin.config?.cleanupEnabled).toBe(true);
    expect(plugin.config?.cleanupIntervalMinutes).toBe(30);
    expect(plugin.config?.sessionRetentionDays).toBe(7);
    expect(plugin.config?.trustDeviceByDefault).toBe(false);
    expect(plugin.config?.enableGeoLocation).toBe(false); // Privacy-conscious default
  });

  it('should have an initialize function', () => {
    const plugin = sessionPluginV2;
    expect(plugin.initialize).toBeDefined();
    expect(typeof plugin.initialize).toBe('function');
  });

  it('should export session schema', () => {
    // Test that the schema export exists
    expect(sessionSchemaV2).toBeDefined();
    expect(sessionSchemaV2.tables).toBeDefined();
    expect(sessionSchemaV2.tables?.session_devices).toBeDefined();
    expect(sessionSchemaV2.tables?.session_metadata).toBeDefined();
  });

  it('should validate configuration correctly', () => {
    // The plugin is already created with default config, we just test the structure
    expect(sessionPluginV2.config).toBeDefined();
    expect(typeof sessionPluginV2.config?.maxConcurrentSessions).toBe('number');
    expect(typeof sessionPluginV2.config?.deviceTrackingEnabled).toBe(
      'boolean',
    );
    expect(typeof sessionPluginV2.config?.cleanupIntervalMinutes).toBe(
      'number',
    );
    expect(typeof sessionPluginV2.config?.sessionRetentionDays).toBe('number');
  });

  it('should have steps with correct validation schemas', () => {
    const plugin = sessionPluginV2;
    const listSessionsStep = plugin.steps?.find(
      (s) => s.name === 'list-sessions',
    );
    const cleanupStep = plugin.steps?.find((s) => s.name === 'cleanup-expired');
    const logoutStep = plugin.steps?.find((s) => s.name === 'logout');
    const logoutAllStep = plugin.steps?.find((s) => s.name === 'logout-all');
    const getSessionStep = plugin.steps?.find((s) => s.name === 'get-session');

    expect(listSessionsStep).toBeDefined();
    expect(listSessionsStep?.validationSchema).toBeDefined();
    expect(listSessionsStep?.run).toBeDefined();
    expect(typeof listSessionsStep?.run).toBe('function');

    expect(cleanupStep).toBeDefined();
    expect(cleanupStep?.validationSchema).toBeDefined();
    expect(cleanupStep?.run).toBeDefined();
    expect(typeof cleanupStep?.run).toBe('function');

    // Test new session management steps
    expect(logoutStep).toBeDefined();
    expect(logoutStep?.validationSchema).toBeDefined();
    expect(logoutStep?.run).toBeDefined();
    expect(typeof logoutStep?.run).toBe('function');
    expect(logoutStep?.protocol?.http?.method).toBe('POST');

    expect(logoutAllStep).toBeDefined();
    expect(logoutAllStep?.validationSchema).toBeDefined();
    expect(logoutAllStep?.run).toBeDefined();
    expect(typeof logoutAllStep?.run).toBe('function');
    expect(logoutAllStep?.protocol?.http?.method).toBe('POST');

    expect(getSessionStep).toBeDefined();
    expect(getSessionStep?.validationSchema).toBeDefined();
    expect(getSessionStep?.run).toBeDefined();
    expect(typeof getSessionStep?.run).toBe('function');
    expect(getSessionStep?.protocol?.http?.method).toBe('GET');
  });
});
