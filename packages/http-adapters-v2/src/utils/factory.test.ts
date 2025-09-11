import { describe, it, expect } from 'vitest';
import {
  createReAuthHttpAdapter,
  getPluginNames,
  groupEndpointsByPlugin,
  validateConfig,
} from './factory.js';
import type { ReAuthEngineV2 } from '../types.js';

// Mock V2 engine
const mockEngine: ReAuthEngineV2 = {
  getAllPlugins: () => [
    {
      name: 'test-plugin-1',
      steps: [
        {
          name: 'login',
          description: 'User login step',
          run: async () => ({ success: true, message: 'Success', status: 'success' }),
          protocol: {
            http: { method: 'POST', auth: false },
          },
        },
        {
          name: 'verify',
          description: 'Verify credentials',
          run: async () => ({ success: true, message: 'Success', status: 'success' }),
          protocol: {
            http: { method: 'POST', auth: true },
          },
        },
      ],
    },
    {
      name: 'test-plugin-2',
      steps: [
        {
          name: 'register',
          description: 'User registration',
          run: async () => ({ success: true, message: 'Success', status: 'success' }),
          protocol: {
            http: { method: 'POST', auth: false },
          },
        },
      ],
    },
  ],
  getPlugin: (name: string) => mockEngine.getAllPlugins().find(p => p.name === name),
  executeStep: async () => ({
    success: true,
    message: 'Step executed successfully',
    status: 'success',
    token: 'test-session-token',
  }),
  createSessionFor: async () => 'test-session-token',
  checkSession: async () => ({
    subject: { id: 'test-user', type: 'user' },
    token: 'test-token',
    valid: true,
  }),
  getSessionService: () => ({
    destroySession: async () => {},
  }),
  getIntrospectionData: () => ({
    entity: { type: 'object', properties: {}, required: [] },
    plugins: [],
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  }),
};

describe('Factory Utilities', () => {
  describe('createReAuthHttpAdapter', () => {
    it('should create adapter with default configuration', () => {
      const adapter = createReAuthHttpAdapter({
        engine: mockEngine,
      });

      expect(adapter).toBeDefined();
      expect(adapter.getEndpoints()).toHaveLength(3); // 2 from plugin-1, 1 from plugin-2
    });

    it('should create adapter with custom base path', () => {
      const adapter = createReAuthHttpAdapter({
        engine: mockEngine,
        basePath: '/custom/auth',
      });

      const endpoints = adapter.getEndpoints();
      expect(endpoints[0].path).toBe('/custom/auth/auth/test-plugin-1/login');
    });
  });

  describe('getPluginNames', () => {
    it('should return list of plugin names', () => {
      const adapter = createReAuthHttpAdapter({ engine: mockEngine });
      const endpoints = adapter.getEndpoints();
      const names = getPluginNames(endpoints);
      expect(names).toEqual(['test-plugin-1', 'test-plugin-2']);
    });

    it('should return empty array for empty endpoints', () => {
      const names = getPluginNames([]);
      expect(names).toEqual([]);
    });
  });

  describe('groupEndpointsByPlugin', () => {
    it('should group endpoints by plugin name', () => {
      const adapter = createReAuthHttpAdapter({ engine: mockEngine });
      const endpoints = adapter.getEndpoints();
      const grouped = groupEndpointsByPlugin(endpoints);
      
      expect(grouped).toHaveProperty('test-plugin-1');
      expect(grouped).toHaveProperty('test-plugin-2');
      expect(grouped['test-plugin-1']).toHaveLength(2);
      expect(grouped['test-plugin-2']).toHaveLength(1);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config = {
        engine: mockEngine,
        basePath: '/api/auth',
      };
      
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing engine', () => {
      const config = {
        basePath: '/api/auth',
      };
      
      const result = validateConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('engine is required');
    });

    it('should return error for invalid base path', () => {
      const config = {
        engine: mockEngine,
        basePath: 'invalid-path', // Should start with /
      };
      
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('basePath must start with /');
    });
  });
});