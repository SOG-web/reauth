import { type } from 'arktype';
import { AuthPlugin, AuthStep, Entity } from '../../types';
import { createStandardSchemaRule } from '../../utils';
import { createAuthPlugin } from '../utils/create-plugin';
import { generateSessionToken } from '../../lib/osolo';

const plugin: AuthPlugin<AnonymousConfig> = {
  name: 'anonymous',
  getSensitiveFields: () => [
    'anonymous_id',
    'linked_to_entity_id',
  ],
  steps: [
    {
      name: 'create-anonymous',
      description: 'Create an anonymous user session',
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        
        // Generate anonymous ID
        const anonymousId = config.generateAnonymousId ? 
          config.generateAnonymousId() : 
          `anon_${generateSessionToken()}`;

        // Create anonymous entity
        const entity = await container.cradle.entityService.createEntity({
          anonymous_id: anonymousId,
          role: 'anonymous',
          is_anonymous: true,
          linked_to_entity_id: null,
          anonymous_data: config.defaultData || {},
        });

        // Create session
        const token = await container.cradle.reAuthEngine.createSession(
          entity,
          this.name,
        );

        if (!token.success) {
          return {
            success: false,
            message: token.message!,
            error: token.error!,
            status: 'session_error',
          };
        }

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Anonymous user created successfully',
          token: token.token,
          entity: serializedEntity,
          anonymousId,
          status: 'created',
        };
      },
      hooks: {},
      inputs: [],
      protocol: {
        http: {
          method: 'POST',
          session_error: 500,
          created: 201,
        },
      },
    },
    {
      name: 'link-account',
      description: 'Link anonymous user to a registered account',
      validationSchema: {
        targetEntityId: createStandardSchemaRule(
          type('string>=1'),
          'Target entity ID is required',
        ),
      },
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { entity, targetEntityId } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        // Verify this is an anonymous user
        if (!entity.is_anonymous) {
          return {
            success: false,
            message: 'This action is only available for anonymous users',
            status: 'not_anonymous',
          };
        }

        // Check if already linked
        if (entity.linked_to_entity_id) {
          return {
            success: false,
            message: 'Anonymous user is already linked to an account',
            status: 'already_linked',
          };
        }

        // Find target entity
        const targetEntity = await container.cradle.entityService.findEntity(
          targetEntityId,
          'id',
        );

        if (!targetEntity) {
          return { success: false, message: 'Target user not found', status: 'target_not_found' };
        }

        // Prevent linking to another anonymous user
        if (targetEntity.is_anonymous) {
          return {
            success: false,
            message: 'Cannot link to another anonymous user',
            status: 'invalid_target',
          };
        }

        // Call onLinkAccount hook if provided
        if (config.onLinkAccount) {
          try {
            await config.onLinkAccount({
              anonymousUser: entity,
              newUser: targetEntity,
              container,
            });
          } catch (error) {
            return {
              success: false,
              message: 'Account linking failed during processing',
              error,
              status: 'link_error',
            };
          }
        }

        // Update anonymous entity to mark as linked
        await container.cradle.entityService.updateEntity(
          entity.id,
          'id',
          {
            ...entity,
            linked_to_entity_id: targetEntityId,
            linked_at: new Date(),
          },
        );

        // Optionally transfer data to target entity
        if (config.transferDataOnLink && entity.anonymous_data) {
          const updatedTargetData = config.transferDataOnLink(
            entity.anonymous_data,
            targetEntity,
          );
          
          await container.cradle.entityService.updateEntity(
            targetEntity.id,
            'id',
            updatedTargetData,
          );
        }

        return {
          success: true,
          message: 'Account linked successfully',
          linkedEntityId: targetEntityId,
          status: 'linked',
        };
      },
      hooks: {},
      inputs: ['entity', 'targetEntityId'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unauthorized: 401,
          not_anonymous: 400,
          already_linked: 400,
          target_not_found: 404,
          invalid_target: 400,
          link_error: 500,
          linked: 200,
        },
      },
    },
    {
      name: 'convert-to-user',
      description: 'Convert anonymous user to registered user',
      validationSchema: {
        email: createStandardSchemaRule(
          type('string.email'),
          'Valid email address is required',
        ),
      },
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { entity, email, password, username } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        // Verify this is an anonymous user
        if (!entity.is_anonymous) {
          return {
            success: false,
            message: 'This action is only available for anonymous users',
            status: 'not_anonymous',
          };
        }

        // Check if already linked
        if (entity.linked_to_entity_id) {
          return {
            success: false,
            message: 'Anonymous user is already linked to an account',
            status: 'already_linked',
          };
        }

        // Check if email/username already exists
        const existingByEmail = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        if (existingByEmail) {
          return {
            success: false,
            message: 'An account with this email already exists',
            status: 'email_exists',
          };
        }

        if (username) {
          const existingByUsername = await container.cradle.entityService.findEntity(
            username,
            'username',
          );

          if (existingByUsername) {
            return {
              success: false,
              message: 'An account with this username already exists',
              status: 'username_exists',
            };
          }
        }

        // Call onConvertToUser hook if provided
        if (config.onConvertToUser) {
          try {
            await config.onConvertToUser({
              anonymousUser: entity,
              email,
              username,
              password,
              container,
            });
          } catch (error) {
            return {
              success: false,
              message: 'Account conversion failed during processing',
              error,
              status: 'conversion_error',
            };
          }
        }

        // Convert anonymous user to regular user
        const convertedEntity = {
          ...entity,
          email,
          username,
          password_hash: password, // Note: This should be hashed by the calling code
          role: 'user',
          is_anonymous: false,
          converted_at: new Date(),
          anonymous_id: undefined, // Remove anonymous ID
        };

        await container.cradle.entityService.updateEntity(
          entity.id,
          'id',
          convertedEntity,
        );

        const serializedEntity = container.cradle.serializeEntity(convertedEntity);

        return {
          success: true,
          message: 'Anonymous user converted to registered user successfully',
          entity: serializedEntity,
          status: 'converted',
        };
      },
      hooks: {},
      inputs: ['entity', 'email', 'password?', 'username?'],
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unauthorized: 401,
          not_anonymous: 400,
          already_linked: 400,
          email_exists: 409,
          username_exists: 409,
          conversion_error: 500,
          converted: 200,
        },
      },
    },
    {
      name: 'get-anonymous-data',
      description: 'Get anonymous user data',
      run: async function (input, pluginProperties) {
        const { container } = pluginProperties!;
        const { entity } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        if (!entity.is_anonymous) {
          return {
            success: false,
            message: 'This action is only available for anonymous users',
            status: 'not_anonymous',
          };
        }

        return {
          success: true,
          message: 'Anonymous data retrieved successfully',
          data: entity.anonymous_data || {},
          isLinked: !!entity.linked_to_entity_id,
          linkedEntityId: entity.linked_to_entity_id,
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
          not_anonymous: 400,
          success: 200,
        },
      },
    },
    {
      name: 'update-anonymous-data',
      description: 'Update anonymous user data',
      run: async function (input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { entity, data } = input;

        if (!entity) {
          return { success: false, message: 'Authentication required', status: 'unauthorized' };
        }

        if (!entity.is_anonymous) {
          return {
            success: false,
            message: 'This action is only available for anonymous users',
            status: 'not_anonymous',
          };
        }

        // Validate data if validator provided
        if (config.validateAnonymousData) {
          const isValid = config.validateAnonymousData(data);
          if (!isValid) {
            return {
              success: false,
              message: 'Invalid anonymous data',
              status: 'invalid_data',
            };
          }
        }

        // Update entity with new data
        const updatedEntity = {
          ...entity,
          anonymous_data: { ...(entity.anonymous_data || {}), ...data },
        };

        await container.cradle.entityService.updateEntity(
          entity.id,
          'id',
          updatedEntity,
        );

        return {
          success: true,
          message: 'Anonymous data updated successfully',
          data: updatedEntity.anonymous_data,
          status: 'updated',
        };
      },
      hooks: {},
      inputs: ['entity', 'data'],
      protocol: {
        http: {
          method: 'PATCH',
          auth: true,
          unauthorized: 401,
          not_anonymous: 400,
          invalid_data: 400,
          updated: 200,
        },
      },
    },
  ],
  initialize: async function (container) {
    // TODO: Anonymous plugin is not yet complete. Missing features:
    // - Comprehensive testing and validation
    // - Security assessment for anonymous data handling
    // - Data retention and cleanup policies
    // - Account linking security validation
    // - Anonymous session management testing
    // - Performance optimization for large datasets
    // - Integration testing with other plugins
    // - Documentation completion and review
    // - GDPR compliance verification
    // - Anonymous user analytics and monitoring
    // - Data migration and backup procedures
    // - Multi-environment configuration support
    throw new Error('Anonymous plugin is not yet ready for production use. This is a work in progress.');

    // This code will be enabled when the plugin is ready:
    /*
    this.container = container;
    */
  },
  migrationConfig: {
    pluginName: 'anonymous',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          anonymous_id: {
            type: 'string',
            nullable: true,
            unique: true,
            index: true,
          },
          is_anonymous: {
            type: 'boolean',
            nullable: true,
            defaultValue: false,
            index: true,
          },
          linked_to_entity_id: {
            type: 'uuid',
            nullable: true,
            references: {
              table: 'entities',
              column: 'id',
              onDelete: 'SET NULL',
            },
          },
          linked_at: {
            type: 'timestamp',
            nullable: true,
          },
          converted_at: {
            type: 'timestamp',
            nullable: true,
          },
          anonymous_data: {
            type: 'json',
            nullable: true,
          },
        },
      },
    ],
  },
  config: {},
};

const anonymousAuth = (
  config: AnonymousConfig = {},
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<AnonymousConfig>>;
  }[],
): AuthPlugin<AnonymousConfig> => {
  return createAuthPlugin(config, plugin, overrideStep, {
    generateAnonymousId: () => `anon_${generateSessionToken()}`,
    defaultData: {},
  });
};

export default anonymousAuth;

declare module '../../types' {
  interface EntityExtension {
    anonymous_id?: string;
    is_anonymous?: boolean;
    linked_to_entity_id?: string | null;
    linked_at?: Date;
    converted_at?: Date;
    anonymous_data?: Record<string, any>;
  }
}

interface AnonymousConfig {
  /**
   * Custom anonymous ID generator function
   * @returns Generated anonymous ID string
   */
  generateAnonymousId?: () => string;
  
  /**
   * Default data to assign to new anonymous users
   */
  defaultData?: Record<string, any>;
  
  /**
   * Callback function when linking anonymous account to registered account
   * Use this to transfer cart items, preferences, etc.
   */
  onLinkAccount?: (params: {
    anonymousUser: Entity;
    newUser: Entity;
    container: any;
  }) => Promise<void>;
  
  /**
   * Callback function when converting anonymous user to registered user
   */
  onConvertToUser?: (params: {
    anonymousUser: Entity;
    email: string;
    username?: string;
    password?: string;
    container: any;
  }) => Promise<void>;
  
  /**
   * Data transfer function when linking accounts
   * Return the updated target entity data
   */
  transferDataOnLink?: (
    anonymousData: Record<string, any>,
    targetEntity: Entity,
  ) => Entity;
  
  /**
   * Validation function for anonymous data
   */
  validateAnonymousData?: (data: Record<string, any>) => boolean;
} 