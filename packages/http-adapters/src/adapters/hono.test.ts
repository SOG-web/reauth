import { describe, it, expect, vi } from 'vitest';
import { HonoAdapterV2, createHonoAdapter } from './hono.js';
import type { ReAuthEngineV2 } from '../types.js';

// Mock Hono types
const mockHonoApp = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  route: vi.fn(),
  use: vi.fn(), // Add the missing use method
};

const mockHonoContext = {
  req: {
    method: 'POST',
    url: 'http://localhost/auth/test-plugin/test-step',
    param: vi.fn().mockReturnValue({ plugin: 'test-plugin', step: 'test-step' }), // Return object directly
    query: vi.fn().mockReturnValue({}),
    json: vi.fn().mockResolvedValue({ username: 'test', password: 'pass' }),
    header: vi.fn((name: string) => {
      const headers: Record<string, string | undefined> = {
        'content-type': 'application/json',
        'x-forwarded-for': undefined,
        'x-real-ip': undefined,
        'user-agent': undefined,
      };
      return headers[name];
    }),
    raw: {
      headers: new Map([['content-type', 'application/json']]), // Add raw headers
    },
  },
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  header: vi.fn().mockReturnThis(),
  env: {},
};

// Mock V2 engine (same as other tests)
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

describe('HonoAdapterV2', () => {
  it('should create adapter instance with correct config', () => {
    const adapter = new HonoAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('hono');
  });

  it('should extract request data correctly', async () => {
    const adapter = new HonoAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const httpRequest = await adapter.extractRequest(mockHonoContext as any);
    
    expect(httpRequest).toEqual({
      method: 'POST',
      url: 'http://localhost/auth/test-plugin/test-step',
      path: '/auth/test-plugin/test-step',
      query: {},
      params: { plugin: 'test-plugin', step: 'test-step' },
      body: {},
      headers: { 'content-type': 'application/json' },
      cookies: {},
      ip: undefined,
      userAgent: undefined,
    });
  });

  it('should send response correctly', () => {
    const adapter = new HonoAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    const response = {
      success: true,
      data: { message: 'Success' },
      meta: { timestamp: '2023-01-01T00:00:00.000Z' },
    };

    adapter.sendResponse(mockHonoContext as any, response);
    
    expect(mockHonoContext.status).toHaveBeenCalledWith(200);
    expect(mockHonoContext.json).toHaveBeenCalledWith(response);
  });

  it('should create Hono app', () => {
    const adapter = new HonoAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    // Mock Hono constructor
    vi.doMock('hono', () => ({
      Hono: vi.fn().mockImplementation(() => mockHonoApp),
    }));

    const app = adapter.createApp();
    expect(app).toBeDefined();
  });

  it('should register routes correctly', () => {
    const adapter = new HonoAdapterV2({
      engine: mockEngine,
      basePath: '/api/auth',
    });

    adapter.registerRoutes(mockHonoApp as any, '/api/auth');

    // Verify routes were registered
    expect(mockHonoApp.post).toHaveBeenCalled();
    expect(mockHonoApp.get).toHaveBeenCalled();
  });
});

describe('createHonoAdapter', () => {
  it('should create Hono adapter with factory function', () => {
    const adapter = createHonoAdapter({
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

    expect(adapter).toBeInstanceOf(HonoAdapterV2);
    expect(adapter.name).toBe('hono');
  });

  it('should work with minimal configuration', () => {
    const adapter = createHonoAdapter({
      engine: mockEngine,
    });

    expect(adapter).toBeInstanceOf(HonoAdapterV2);
  });
});