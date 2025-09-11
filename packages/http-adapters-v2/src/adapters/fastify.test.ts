import { describe, it, expect, vi } from 'vitest';
import { FastifyAdapterV2, createFastifyAdapter } from './fastify.js';
import type { ReAuthEngineV2 } from '../types.js';

// Mock Fastify types
const mockFastifyInstance = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  register: vi.fn(),
  addHook: vi.fn(),
};

const mockFastifyRequest = {
  method: 'POST',
  url: '/auth/test-plugin/test-step',
  params: { plugin: 'test-plugin', step: 'test-step' },
  body: { username: 'test', password: 'pass' },
  headers: { 'content-type': 'application/json' },
  cookies: {},
  ip: '127.0.0.1',
  query: {},
};

const mockFastifyReply = {
  status: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  header: vi.fn().mockReturnThis(),
  code: vi.fn().mockReturnThis(),
};

// Mock V2 engine (same as Express test)
const mockEngine: ReAuthEngineV2 = {
  getAllPlugins: () => [
    {
      name: 'test-plugin',
      steps: [
        {
          name: 'test-step',
          description: 'Test authentication step',
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

describe('FastifyAdapterV2', () => {
  it('should create adapter instance with correct config', () => {
    const adapter = new FastifyAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('fastify');
  });

  it('should extract request data correctly', () => {
    const adapter = new FastifyAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const httpRequest = adapter.extractRequest(mockFastifyRequest as any);
    
    expect(httpRequest).toEqual({
      method: 'POST',
      url: '/auth/test-plugin/test-step',
      path: '/auth/test-plugin/test-step',
      query: {},
      params: { plugin: 'test-plugin', step: 'test-step' },
      body: { username: 'test', password: 'pass' },
      headers: { 'content-type': 'application/json' },
      cookies: {},
      ip: '127.0.0.1',
      userAgent: '',
    });
  });

  it('should send response correctly', () => {
    const adapter = new FastifyAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const response = {
      success: true,
      data: { message: 'Success' },
      meta: { timestamp: '2023-01-01T00:00:00.000Z' },
    };

    adapter.sendResponse(mockFastifyReply as any, response);
    
    expect(mockFastifyReply.status).toHaveBeenCalledWith(200);
    expect(mockFastifyReply.send).toHaveBeenCalledWith(response);
  });

  it('should create plugin function', () => {
    const adapter = new FastifyAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const plugin = adapter.createPlugin();
    expect(typeof plugin).toBe('function');
  });
});

describe('createFastifyAdapter', () => {
  it('should create Fastify adapter with factory function', () => {
    const adapter = createFastifyAdapter({
      engine: mockEngine,
      basePath: '/api/auth',
      cors: {
        origin: 'https://example.com',
        credentials: true,
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100,
      },
    });

    expect(adapter).toBeInstanceOf(FastifyAdapterV2);
    expect(adapter.name).toBe('fastify');
  });

  it('should work with minimal configuration', () => {
    const adapter = createFastifyAdapter({
      engine: mockEngine,
    });

    expect(adapter).toBeInstanceOf(FastifyAdapterV2);
  });
});