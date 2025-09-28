import type { HttpAdapterConfig, PluginEndpoint } from '../types.js';
import { ReAuthHttpAdapter } from '../base-adapter.js';
import { ReAuthEngine } from '@re-auth/reauth/.';

/**
 * Factory function to create HTTP adapter with default configuration
 */
export function createReAuthHttpAdapter(
  config: Partial<HttpAdapterConfig> & { engine: ReAuthEngine },
): ReAuthHttpAdapter {
  const defaultConfig: HttpAdapterConfig = {
    basePath: '/api/v2',
    cors: {
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests, please try again later.',
    },
    security: {
      helmet: true,
      sanitizeInput: true,
      sanitizeOutput: false,
    },
    validation: {
      validateInput: true,
      maxPayloadSize: 1024 * 1024, // 1MB
      sanitizeFields: ['email', 'username', 'name', 'description'],
    },
    ...config,
  };

  return new ReAuthHttpAdapter(defaultConfig);
}

/**
 * Auto-discover endpoints from engine and generate OpenAPI-like spec
 */
export function generateApiSpec(adapter: ReAuthHttpAdapter): {
  openapi: string;
  info: object;
  paths: Record<string, any>;
  components: object;
} {
  const endpoints = adapter.getEndpoints();
  const paths: Record<string, any> = {};

  // Add authentication endpoints
  for (const endpoint of endpoints) {
    const path = endpoint.path;
    const method = endpoint.method.toLowerCase();

    if (!paths[path]) {
      paths[path] = {};
    }

    paths[path][method] = {
      summary: `Execute ${endpoint.stepName} step for ${endpoint.pluginName} plugin`,
      description: endpoint.description || `Execute authentication step`,
      tags: [endpoint.pluginName],
      parameters: [
        {
          name: 'plugin',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Plugin name',
        },
        {
          name: 'step',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Step name',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: endpoint.inputSchema || { type: 'object' },
          },
        },
      },
      responses: {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: endpoint.outputSchema || { type: 'object' },
                  meta: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        401: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      security: endpoint.requiresAuth ? [{ bearerAuth: [] }] : [],
    };
  }

  // Add session management endpoints
  paths['/session'] = {
    get: {
      summary: 'Check session validity',
      description: 'Verify if the current session is valid',
      tags: ['Session Management'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Session check result',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SessionResponse' },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create new session',
      description: 'Create a new session for a subject',
      tags: ['Session Management'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                subjectType: { type: 'string' },
                subjectId: { type: 'string' },
                ttlSeconds: { type: 'number' },
              },
              required: ['subjectType', 'subjectId'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Session created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SessionResponse' },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Destroy session',
      description: 'Destroy the current session',
      tags: ['Session Management'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Session destroyed successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
            },
          },
        },
      },
    },
  };

  // Add plugin introspection endpoints
  paths['/plugins'] = {
    get: {
      summary: 'List all plugins',
      description: 'Get a list of all available authentication plugins',
      tags: ['Plugin Introspection'],
      responses: {
        200: {
          description: 'List of plugins',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PluginListResponse' },
            },
          },
        },
      },
    },
  };

  paths['/plugins/{plugin}'] = {
    get: {
      summary: 'Get plugin details',
      description: 'Get detailed information about a specific plugin',
      tags: ['Plugin Introspection'],
      parameters: [
        {
          name: 'plugin',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Plugin name',
        },
      ],
      responses: {
        200: {
          description: 'Plugin details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PluginDetailsResponse' },
            },
          },
        },
        404: {
          description: 'Plugin not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
  };

  // Add health check endpoint
  paths['/health'] = {
    get: {
      summary: 'Health check',
      description: 'Get the health status of the authentication service',
      tags: ['Health'],
      responses: {
        200: {
          description: 'Health status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthResponse' },
            },
          },
        },
      },
    },
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'ReAuth V2 HTTP API',
      description: 'HTTP API for ReAuth V2 Authentication Engine',
      version: '2.0.0',
      contact: {
        name: 'ReAuth',
        url: 'https://github.com/SOG-web/reauth',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        SessionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                subject: { type: 'object' },
                token: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        PluginListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        method: { type: 'string' },
                        path: { type: 'string' },
                        requiresAuth: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        PluginDetailsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      method: { type: 'string' },
                      path: { type: 'string' },
                      requiresAuth: { type: 'boolean' },
                      inputs: { type: 'array', items: { type: 'string' } },
                      inputSchema: { type: 'object' },
                      outputSchema: { type: 'object' },
                    },
                  },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                version: { type: 'string' },
                plugins: { type: 'number' },
                endpoints: { type: 'number' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Utility to extract plugin names from endpoints
 */
export function getPluginNames(endpoints: PluginEndpoint[]): string[] {
  const names = new Set<string>();
  for (const endpoint of endpoints) {
    names.add(endpoint.pluginName);
  }
  return Array.from(names).sort();
}

/**
 * Utility to group endpoints by plugin
 */
export function groupEndpointsByPlugin(
  endpoints: PluginEndpoint[],
): Record<string, PluginEndpoint[]> {
  const groups: Record<string, PluginEndpoint[]> = {};
  for (const endpoint of endpoints) {
    if (!groups[endpoint.pluginName]) {
      groups[endpoint.pluginName] = [];
    }
    groups[endpoint.pluginName]!.push(endpoint);
  }
  return groups;
}

/**
 * Utility to validate adapter configuration
 */
export function validateConfig(config: HttpAdapterConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.engine) {
    errors.push('engine is required');
  }

  if (config.basePath && !config.basePath.startsWith('/')) {
    errors.push('basePath must start with /');
  }

  if (config.rateLimit?.max && config.rateLimit.max <= 0) {
    errors.push('rateLimit.max must be greater than 0');
  }

  if (config.rateLimit?.windowMs && config.rateLimit.windowMs <= 0) {
    errors.push('rateLimit.windowMs must be greater than 0');
  }

  if (
    config.validation?.maxPayloadSize &&
    config.validation.maxPayloadSize <= 0
  ) {
    errors.push('validation.maxPayloadSize must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
