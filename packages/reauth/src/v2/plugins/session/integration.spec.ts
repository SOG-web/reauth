import { describe, it, expect, beforeEach } from 'vitest';
import { ReAuthEngineV2 } from '../../engine.v2';
import { FumaSessionServiceV2 } from '../../session-service.v2';
import sessionPluginV2 from './plugin.v2';
import { createTestDBClient } from '../../../utils/testing-utilities';

describe('Session Plugin V2 Integration', () => {
  let engine: ReAuthEngineV2;
  let dbClient: any;

  beforeEach(async () => {
    // Create a test database client
    dbClient = createTestDBClient([
      // Include session plugin schema
      { tables: { session_devices: {}, session_metadata: {} } }
    ]);

    // Create engine with session plugin
    engine = new ReAuthEngineV2({
      dbClient,
      plugins: [sessionPluginV2()],
    });
  });

  it('should have the correct plugin name', () => {
    expect(sessionPluginV2().name).toBe('session');
  });

  it('should have enhanced session features enabled', () => {
    const sessionService = engine.getSessionService() as FumaSessionServiceV2;
    expect(sessionService).toBeDefined();
    // The enhanced mode should be enabled when plugin is initialized
    expect((sessionService as any).enhancedMode).toBe(true);
  });

  it('should have list-sessions and cleanup-expired steps', () => {
    const plugin = sessionPluginV2();
    expect(plugin.steps).toBeDefined();
    expect(plugin.steps?.length).toBe(2);
    
    const stepNames = plugin.steps?.map(s => s.name) || [];
    expect(stepNames).toContain('list-sessions');
    expect(stepNames).toContain('cleanup-expired');
  });

  it('should execute list-sessions step successfully', async () => {
    // First create a session
    const token = await engine.createSessionFor('subject', 'test-user-123');
    expect(token).toBeDefined();

    // Execute list-sessions step
    const result = await engine.executeStep('session', 'list-sessions', {
      token,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('su');
    expect(result.sessions).toBeDefined();
    expect(Array.isArray(result.sessions)).toBe(true);
  });

  it('should integrate with engine session creation', async () => {
    // Create a session through the engine
    const token = await engine.createSessionFor('subject', 'test-user-456', 3600);
    expect(token).toBeDefined();

    // Verify the session works
    const verification = await engine.checkSession(token);
    expect(verification.valid).toBe(true);
    expect(verification.subject).toBeDefined();
  });

  it('should register enhanced session resolvers', () => {
    // The plugin should register enhanced_subject resolver
    const sessionResolvers = (engine as any).sessionResolvers;
    expect(sessionResolvers).toBeDefined();
    
    const resolver = sessionResolvers.get('enhanced_subject');
    expect(resolver).toBeDefined();
    expect(typeof resolver.getById).toBe('function');
  });

  it('should register cleanup tasks', () => {
    const cleanupScheduler = engine.getCleanupScheduler();
    expect(cleanupScheduler).toBeDefined();
    
    // The plugin should register a cleanup task
    const tasks = (cleanupScheduler as any).tasks;
    expect(tasks).toBeDefined();
    expect(tasks.size).toBeGreaterThan(0);
    
    // Find the session cleanup task
    let sessionCleanupTask = null;
    for (const [name, task] of tasks) {
      if (name.includes('session') || task.pluginName === 'session') {
        sessionCleanupTask = task;
        break;
      }
    }
    expect(sessionCleanupTask).toBeDefined();
  });

  it('should have correct default configuration', () => {
    const plugin = sessionPluginV2();
    expect(plugin.config).toBeDefined();
    expect(plugin.config?.deviceTrackingEnabled).toBe(true);
    expect(plugin.config?.cleanupEnabled).toBe(true);
    expect(plugin.config?.cleanupIntervalMinutes).toBe(30);
    expect(plugin.config?.sessionRetentionDays).toBe(7);
  });
});