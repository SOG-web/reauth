import { describe, it, expect, beforeAll } from 'vitest';
import { createReAuthHttpAdapter } from './utils/factory.js';
import type { ReAuthEngineV2 } from './types.js';

// Simplified mock V2 engine for integration testing
const createMockEngineV2 = (): ReAuthEngineV2 => ({
  getAllPlugins: () => [
    {
      name: 'email-password',
      steps: [
        {
          name: 'login',
          description: 'Authenticate with email and password',
          run: async (input: any) => {
            if (
              input.email === 'test@example.com' &&
              input.password === 'password123'
            ) {
              return {
                success: true,
                message: 'Login successful',
                status: 'authenticated',
                token: 'mock-session-token',
                subject: { id: 'user-123', email: 'test@example.com' },
              };
            }
            return {
              success: false,
              message: 'Invalid credentials',
              status: 'failed',
            };
          },
          protocol: {
            http: { method: 'POST', auth: false },
          },
        },
      ],
    },
    {
      name: 'api-key',
      steps: [
        {
          name: 'validate',
          description: 'Validate API key',
          run: async (input: any) => {
            if (input.apiKey === 'valid-api-key') {
              return {
                success: true,
                message: 'API key valid',
                status: 'authenticated',
                subject: { id: 'api-client-456', type: 'api' },
              };
            }
            return {
              success: false,
              message: 'Invalid API key',
              status: 'failed',
            };
          },
          protocol: {
            http: { method: 'POST', auth: false },
          },
        },
      ],
    },
  ],
  getPlugin: function (name: string) {
    return this.getAllPlugins().find((p) => p.name === name);
  },
  executeStep: async function (
    pluginName: string,
    stepName: string,
    input: any,
  ) {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    const step = plugin.steps?.find((s) => s.name === stepName);
    if (!step) {
      throw new Error(`Step not found: ${stepName}`);
    }

    return await step.run(input, {});
  },
  createSessionFor: async (
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ) => {
    return `session-${subjectType}-${subjectId}-${Date.now()}`;
  },
  checkSession: async (token: string) => {
    if (token.startsWith('session-')) {
      return {
        subject: { id: 'test-user', type: 'user' },
        token,
        valid: true,
      };
    }
    return {
      subject: null,
      token,
      valid: false,
    };
  },
  getSessionService: () => ({
    destroySession: async (token: string) => {
      // Mock session destruction
      return;
    },
  }),
  getIntrospectionData: function () {
    return {
      entity: { type: 'object', properties: {}, required: [] },
      plugins: [],
      generatedAt: new Date().toISOString(),
      version: '2.0.0',
    };
  },
});

describe('V2 HTTP Adapter Integration Tests', () => {
  let adapter: ReturnType<typeof createReAuthHttpAdapter>;
  let mockEngine: ReAuthEngineV2;

  beforeAll(() => {
    mockEngine = createMockEngineV2();
    adapter = createReAuthHttpAdapter({
      engine: mockEngine,
      basePath: '/api/v2/auth',
    });
  });

  describe('Adapter Initialization', () => {
    it('should create adapter with V2 engine', () => {
      expect(adapter).toBeDefined();
      expect(typeof adapter.executeAuthStep).toBe('function');
      expect(typeof adapter.getEndpoints).toBe('function');
    });

    it('should discover V2 plugin endpoints', () => {
      const endpoints = adapter.getEndpoints();

      expect(endpoints).toHaveLength(2);

      const emailPasswordEndpoints = endpoints.filter(
        (e) => e.pluginName === 'email-password',
      );
      expect(emailPasswordEndpoints).toHaveLength(1);
      expect(emailPasswordEndpoints[0].stepName).toBe('login');

      const apiKeyEndpoints = endpoints.filter(
        (e) => e.pluginName === 'api-key',
      );
      expect(apiKeyEndpoints).toHaveLength(1);
      expect(apiKeyEndpoints[0].stepName).toBe('validate');
    });

    it('should generate correct endpoint paths', () => {
      const endpoints = adapter.getEndpoints();

      expect(endpoints[0].path).toBe('/api/v2/auth/auth/email-password/login');
      expect(endpoints[1].path).toBe('/api/v2/auth/auth/api-key/validate');
    });
  });

  describe('Authentication Step Execution', () => {
    it('should execute successful email-password login', async () => {
      const request = {
        params: { plugin: 'email-password', step: 'login' },
        body: { email: 'test@example.com', password: 'password123' },
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        url: '/api/v2/auth/auth/email-password/login',
      };

      const response = await adapter.executeAuthStep(request as any);

      expect(response.success).toBe(true);
      expect(response.data?.success).toBe(true);
      expect(response.data?.message).toBe('Login successful');
      expect(response.data?.sessionToken).toBe('mock-session-token');
    });

    it('should handle failed authentication', async () => {
      const request = {
        params: { plugin: 'email-password', step: 'login' },
        body: { email: 'test@example.com', password: 'wrong-password' },
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        url: '/api/v2/auth/auth/email-password/login',
      };

      const response = await adapter.executeAuthStep(request as any);

      expect(response.success).toBe(true); // HTTP success, but auth failed
      expect(response.data?.success).toBe(false);
      expect(response.data?.message).toBe('Invalid credentials');
    });

    it('should handle non-existent plugin/step', async () => {
      const request = {
        params: { plugin: 'non-existent', step: 'invalid' },
        body: {},
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        url: '/api/v2/auth/auth/non-existent/invalid',
      };

      await expect(adapter.executeAuthStep(request as any)).rejects.toThrow(
        'Endpoint not found: non-existent/invalid',
      );
    });
  });
});
