import { describe, it, expect } from 'vitest';
import { ReAuthHttpAdapterV2 } from '../src/base-adapter.js';
import type { ReAuthEngineV2 } from '../src/types.js';

// Mock V2 engine for testing
const mockEngine: ReAuthEngineV2 = {
  getAllPlugins: () => [
    {
      name: 'test-plugin',
      steps: [
        {
          name: 'test-step',
          description: 'Test step',
          run: async () => ({ success: true, message: 'Test passed', status: 'success' }),
          protocol: {
            http: {
              method: 'POST',
              auth: false,
            },
          },
        },
      ],
    },
  ],
  getPlugin: (name: string) => {
    const plugins = mockEngine.getAllPlugins();
    return plugins.find(p => p.name === name);
  },
  executeStep: async () => ({
    success: true,
    message: 'Step executed',
    status: 'success',
  }),
  createSessionFor: async () => 'mock-session-token',
  checkSession: async () => ({
    subject: { id: 'test-user' },
    token: 'mock-token',
    valid: true,
  }),
  getSessionService: () => ({
    destroySession: async () => {},
  }),
  getIntrospectionData: () => ({
    entity: { type: 'object', properties: {}, required: [] },
    plugins: [
      {
        name: 'test-plugin',
        description: 'Test plugin',
        steps: [
          {
            name: 'test-step',
            description: 'Test step',
            inputs: {},
            outputs: {},
            protocol: {},
            requiresAuth: false,
          },
        ],
      },
    ],
    generatedAt: new Date().toISOString(),
    version: '2.0.0',
  }),
};

describe('ReAuth HTTP Adapter V2', () => {
  it('should create adapter with config', () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    expect(adapter).toBeDefined();
    expect(adapter.getEndpoints()).toHaveLength(1);
    expect(adapter.getEndpoints()[0].pluginName).toBe('test-plugin');
    expect(adapter.getEndpoints()[0].stepName).toBe('test-step');
  });

  it('should get health check data', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const result = await adapter.healthCheck();
    
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('healthy');
    expect(result.data?.plugins).toBe(1);
    expect(result.data?.endpoints).toBe(1);
  });

  it('should list plugins', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const result = await adapter.listPlugins();
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].name).toBe('test-plugin');
  });

  it('should get plugin details', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const result = await adapter.getPlugin('test-plugin');
    
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('test-plugin');
    expect(result.data?.steps).toHaveLength(1);
  });

  it('should get introspection data', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const result = await adapter.getIntrospection();
    
    expect(result.success).toBe(true);
    expect(result.data?.plugins).toHaveLength(1);
    expect(result.data?.version).toBe('2.0.0');
  });

  it('should get current user from valid session', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      body: {},
      headers: {
        authorization: 'Bearer valid-token',
      },
    };

    const user = await adapter.getCurrentUser(mockRequest);
    
    expect(user).toBeDefined();
    expect(user?.subject.id).toBe('test-user');
    expect(user?.valid).toBe(true);
    expect(user?.token).toBe('mock-token');
  });

  it('should return null for invalid session', async () => {
    const mockEngineInvalid: ReAuthEngineV2 = {
      ...mockEngine,
      checkSession: async () => ({
        subject: null,
        token: null,
        valid: false,
      }),
    };

    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngineInvalid,
    });

    const mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      body: {},
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };

    const user = await adapter.getCurrentUser(mockRequest);
    expect(user).toBe(null);
  });

  it('should return null for no session token', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      body: {},
      headers: {},
    };

    const user = await adapter.getCurrentUser(mockRequest);
    expect(user).toBe(null);
  });

  it('should require authentication and return user', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      body: {},
      headers: {
        authorization: 'Bearer valid-token',
      },
    };

    const user = await adapter.requireAuthentication(mockRequest);
    
    expect(user).toBeDefined();
    expect(user.subject.id).toBe('test-user');
    expect(user.valid).toBe(true);
  });

  it('should throw error when authentication required but no token', async () => {
    const adapter = new ReAuthHttpAdapterV2({
      engine: mockEngine,
    });

    const mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      body: {},
      headers: {},
    };

    await expect(adapter.requireAuthentication(mockRequest)).rejects.toThrow('Authentication required');
  });
});