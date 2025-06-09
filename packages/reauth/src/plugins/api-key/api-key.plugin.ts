import { type } from 'arktype';
import { AuthPlugin, AuthStep, Entity, RootStepHooks } from '../../types';
import { createAuthPlugin } from '../utils/create-plugin';
import { generateSessionToken } from '../../lib/osolo';

// ArkType schemas for validation
const apiKeySchema = type('string>=32');
const keyNameSchema = type('string>=1');
const permissionsSchema = type('string[]');
const expiresInSchema = type('number.integer>0');

const authenticateSchema = type({
  apiKey: apiKeySchema,
});

const createApiKeySchema = type({
  name: keyNameSchema,
  permissions: permissionsSchema,
  'expiresIn?': expiresInSchema,
});

const listApiKeysSchema = type({});

const revokeApiKeySchema = type({
  name: keyNameSchema,
});

const plugin: AuthPlugin<ApiKeyConfig> = {
  name: 'apiKeyPlugin',
  getSensitiveFields: () => ['api_keys'],
  steps: [
    {
      name: 'authenticate',
      description: 'Authenticate using API key',
      validationSchema: authenticateSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "entity?": 'object',
        "keyData?": 'object',
      }),
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { apiKey } = input;

        // Find entity by API key
        const entities = await container.cradle.entityService.findEntity(
          apiKey,
          'api_key',
        );

        if (!entities) {
          return { success: false, message: 'Invalid API key', status: 'invalid' };
        }

        // Check if API key is active
        if (entities.api_keys) {
          const keyData = entities.api_keys.find((key: any) => key.key === apiKey);
          if (!keyData || !keyData.active) {
            return { success: false, message: 'API key is inactive', status: 'inactive' };
          }

          // Check expiration if set
          if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return { success: false, message: 'API key has expired', status: 'expired' };
          }

          // Update last used timestamp
          keyData.last_used_at = new Date();
          keyData.usage_count = (keyData.usage_count || 0) + 1;

          await container.cradle.entityService.updateEntity(
            entities.id,
            'id',
            entities,
          );
        }

        const serializedEntity = container.cradle.serializeEntity(entities);

        return {
          success: true,
          message: 'API key authentication successful',
          entity: serializedEntity,
          status: 'success',
        };
      },
      hooks: {},
      inputs: ['apiKey'],
      protocol: {
        http: {
          method: 'POST',
          invalid: 401,
          inactive: 401,
          expired: 401,
          success: 200,
        },
      },
    },
    {
      name: 'create-api-key',
      description: 'Create a new API key for authenticated user',
      validationSchema: createApiKeySchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "apiKey?": 'string',
        "keyData?": 'object',
      }),
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { entity, name, permissions, expiresIn } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        const currentEntity = await container.cradle.entityService.findEntity(
          entity.id,
          'id',
        );

        if (!currentEntity) {
          return { success: false, message: 'User not found', status: 'not_found' };
        }

        // Generate new API key
        const apiKey = config.generateApiKey ? 
          config.generateApiKey() : 
          `ak_${generateSessionToken()}`;

        const keyData = {
          key: apiKey,
          name,
          permissions: permissions || [],
          active: true,
          created_at: new Date(),
          last_used_at: null,
          usage_count: 0,
          expires_at: expiresIn ? new Date(Date.now() + expiresIn) : null,
        };

        // Add to entity's API keys
        const apiKeys = currentEntity.api_keys || [];
        
        // Check max keys limit
        if (config.maxKeysPerUser && apiKeys.length >= config.maxKeysPerUser) {
          return {
            success: false,
            message: `Maximum ${config.maxKeysPerUser} API keys allowed per user`,
            status: 'limit_exceeded',
          };
        }

        apiKeys.push(keyData);

        await container.cradle.entityService.updateEntity(
          currentEntity.id,
          'id',
          {
            ...currentEntity,
            api_keys: apiKeys,
          },
        );

        return {
          success: true,
          message: 'API key created successfully',
          apiKey,
          keyData: {
            name: keyData.name,
            permissions: keyData.permissions,
            created_at: keyData.created_at,
            expires_at: keyData.expires_at,
          },
          status: 'created',
        };
      },
      hooks: {},
      inputs: ['entity', 'name', 'permissions', 'expiresIn'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unauthorized: 401,
          not_found: 404,
          limit_exceeded: 400,
          created: 201,
        },
      },
    },
    {
      name: 'list-api-keys',
      description: 'List all API keys for authenticated user',
      validationSchema: listApiKeysSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        "apiKeys?": 'object[]',
      }),
      run: async function (input, pluginProperties) {
        const { container } = pluginProperties!;
        const { entity } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        const currentEntity = await container.cradle.entityService.findEntity(
          entity.id,
          'id',
        );

        if (!currentEntity) {
          return { success: false, message: 'User not found', status: 'not_found' };
        }

        const apiKeys = (currentEntity.api_keys || []).map((key: any) => ({
          name: key.name,
          permissions: key.permissions,
          active: key.active,
          created_at: key.created_at,
          last_used_at: key.last_used_at,
          usage_count: key.usage_count,
          expires_at: key.expires_at,
          // Don't return the actual key for security
        }));

        return {
          success: true,
          message: 'API keys retrieved successfully',
          apiKeys,
          status: 'success',
        };
      },
      hooks: {},
      inputs: ['entity'],
      protocol: {
        http: {
          method: 'GET',
          auth: true,
          unauthorized: 401,
          not_found: 404,
          success: 200,
        },
      },
    },
    {
      name: 'revoke-api-key',
      description: 'Revoke an API key',
      validationSchema: revokeApiKeySchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
      }),
      run: async function (input, pluginProperties) {
        const { container } = pluginProperties!;
        const { entity, name } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        const currentEntity = await container.cradle.entityService.findEntity(
          entity.id,
          'id',
        );

        if (!currentEntity) {
          return { success: false, message: 'User not found', status: 'not_found' };
        }

        const apiKeys = currentEntity.api_keys || [];
        const keyIndex = apiKeys.findIndex((key: any) => key.name === name);

        if (keyIndex === -1) {
          return { success: false, message: 'API key not found', status: 'key_not_found' };
        }

        // Remove the key
        apiKeys.splice(keyIndex, 1);

        await container.cradle.entityService.updateEntity(
          currentEntity.id,
          'id',
          {
            ...currentEntity,
            api_keys: apiKeys,
          },
        );

        return {
          success: true,
          message: 'API key revoked successfully',
          status: 'revoked',
        };
      },
      hooks: {},
      inputs: ['entity', 'name'],
      protocol: {
        http: {
          method: 'DELETE',
          auth: true,
          unauthorized: 401,
          not_found: 404,
          key_not_found: 404,
          revoked: 200,
        },
      },
    },
  ],
  initialize: async function (container) {
    // TODO: API Key plugin is not yet complete. Missing features:
    // - Comprehensive testing and validation
    // - Rate limiting implementation testing
    // - Security vulnerability assessment
    // - API key rotation functionality
    // - Key compromise detection and handling
    // - Integration testing with other plugins
    // - Documentation completion and review
    // - Performance optimization for high-volume usage
    // - Audit logging for security compliance
    // - Key usage analytics and monitoring
    // - Backup and recovery procedures
    // - Multi-environment configuration support
    throw new Error('API Key plugin is not yet ready for production use. This is a work in progress.');

    // This code will be enabled when the plugin is ready:
    /*
    this.container = container;
    */
  },
  migrationConfig: {
    pluginName: 'api-key',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          api_keys: {
            type: 'json',
            nullable: true,
          },
        },
      },
    ],
  },
  config: {},
};

const apiKeyAuth = (
  config: ApiKeyConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<ApiKeyConfig>>;
  }[],
): AuthPlugin<ApiKeyConfig> => {
  return createAuthPlugin(config, plugin, overrideStep, {
    maxKeysPerUser: 10,
    generateApiKey: () => `ak_${generateSessionToken()}`,
  });
};

export default apiKeyAuth;

declare module '../../types' {
  interface EntityExtension {
    api_keys?: Array<{
      key: string;
      name: string;
      permissions: string[];
      active: boolean;
      created_at: Date;
      last_used_at: Date | null;
      usage_count: number;
      expires_at: Date | null;
    }> | null;
  }
}

interface ApiKeyConfig {
  /**
   * Maximum number of API keys per user (default: 10)
   */
  maxKeysPerUser?: number;
  
  /**
   * Custom API key generator function
   * @returns Generated API key string
   */
  generateApiKey?: () => string;

  /**
   * Root hooks
   * @example
   * rootHooks: {
   *  before: async (input, pluginProperties) => {
   *    // do something before the plugin runs
   *  }
   */
  rootHooks?: RootStepHooks;
} 