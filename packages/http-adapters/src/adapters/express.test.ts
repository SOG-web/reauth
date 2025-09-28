import { describe, it, expect, vi } from 'vitest';
import { ExpressAdapterV2, createExpressAdapter } from './express.js';
import type { ReAuthEngineV2 } from '../types.js';

// Mock Express types
const mockRequest = {
  method: 'POST',
  url: '/auth/test-plugin/test-step',
  path: '/auth/test-plugin/test-step', 
  query: {},
  params: { plugin: 'test-plugin', step: 'test-step' },
  body: { username: 'test', password: 'pass' },
  headers: { 'content-type': 'application/json' },
  cookies: {},
  ip: '127.0.0.1',
  get: vi.fn().mockReturnValue('Mozilla/5.0'),
};

const mockResponse = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  header: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
};

const mockNext = vi.fn();

// Mock V2 engine
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
  }),
};

describe('ExpressAdapterV2', () => {
  it('should create adapter instance with correct config', () => {
    const adapter = new ExpressAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('express');
  });

  it('should extract request data correctly', () => {
    const adapter = new ExpressAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const httpRequest = adapter.extractRequest(mockRequest as any);
    
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
      userAgent: 'Mozilla/5.0',
    });
  });

  it('should send response correctly', () => {
    const adapter = new ExpressAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const response = {
      success: true,
      data: { message: 'Success' },
      meta: { timestamp: '2023-01-01T00:00:00.000Z' },
    };

    adapter.sendResponse(mockResponse as any, response);
    
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(response);
  });

  it('should create middleware function', () => {
    const adapter = new ExpressAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const middleware = adapter.createMiddleware();
    expect(typeof middleware).toBe('function');
    
    middleware(mockRequest as any, mockResponse as any, mockNext);
    expect((mockRequest as any).reauth).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should create router with correct routes', () => {
    const adapter = new ExpressAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    // Mock Express router
    const mockRouter = {
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    // Mock express to return our mock router
    vi.doMock('express', () => ({
      default: {
        Router: () => mockRouter,
      },
      Router: () => mockRouter,
    }));

    const router = adapter.createRouter();
    expect(router).toBeDefined();
  });
});

describe('createExpressAdapter', () => {
  it('should create Express adapter with factory function', () => {
    const adapter = createExpressAdapter({
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

    expect(adapter).toBeInstanceOf(ExpressAdapterV2);
    expect(adapter.name).toBe('express');
  });

  it('should work with minimal configuration', () => {
    const adapter = createExpressAdapter({
      engine: mockEngine,
    });

    expect(adapter).toBeInstanceOf(ExpressAdapterV2);
  });
});