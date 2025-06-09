import { asValue, AwilixContainer } from 'awilix';
import {
  AuthPlugin,
  AuthInput,
  AuthOutput,
  ReAuthCradle,
  AuthStep,
  RootStepHooks,
} from '../../types';
import { type } from 'arktype';
import { extractEntityId, performBanCheck } from './ban-interceptor';
import banSteps from './ban-steps';
import { checkDependsOn, createAuthPlugin } from '../utils';
import { hashPassword, haveIbeenPawned } from '../../lib';

interface AdminConfig {
  /**
   * Custom function to check if a user is banned
   * @param entityId The entity ID to check
   * @param container DI container for accessing services
   * @returns Promise<BanInfo | null> - null if not banned, BanInfo if banned
   */
  checkBanStatus?: (
    entityId: string,
    container: AwilixContainer<ReAuthCradle>,
  ) => Promise<BanInfo | null>;

  /**
   * Custom function to ban a user
   * @param entityId The entity ID to ban
   * @param reason The reason for banning
   * @param bannedBy The entity ID of who banned the user
   * @param container DI container for accessing services
   */
  banUser?: (
    entityId: string,
    reason: string,
    bannedBy: string,
    container: AwilixContainer<ReAuthCradle>,
  ) => Promise<void>;

  /**
   * Custom function to unban a user
   * @param entityId The entity ID to unban
   * @param unbannedBy The entity ID of who unbanned the user
   * @param container DI container for accessing services
   */
  unbanUser?: (
    entityId: string,
    unbannedBy: string,
    container: AwilixContainer<ReAuthCradle>,
  ) => Promise<void>;

  adminEntity: AdminEntityService;

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

interface BanInfo {
  banned: boolean;
  reason?: string;
  banned_at?: Date;
  banned_by?: string;
}

const createAdminSchema = type({
  email: 'string.email',
  password: 'string.regex|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/',
});

const plugin: AuthPlugin<AdminConfig> = {
  name: 'adminPlugin',
  steps: [
    ...banSteps,
    {
      name: 'create-admin',
      description: 'create a new admin',
      inputs: ['email', 'password'],
      async run(input, pluginProperties) {
        const { container, config } = pluginProperties!;
        const { email, password } = input;

        let entity = await container.cradle.entityService.findEntity(
          email,
          'email',
        );

        let admin: AdminEntity;

        if (entity) {
          const serializedEntity = container.cradle.serializeEntity(entity);

          const exist = await container.cradle.adminEntityService.findEntity(
            entity.id,
            'entity_id',
          );

          if (exist) {
            return {
              success: false,
              message: 'Admin already exist',
              status: 'ip',
            };
          }

          admin = await container.cradle.adminEntityService.createEntity({
            entity_id: entity.id,
          });

          await container.cradle.entityService.updateEntity(entity.id, 'id', {
            role: 'admin',
          });

          return {
            success: true,
            message: 'Register successful',
            entity: serializedEntity,
            admin,
            status: 'su',
          };
        }

        const savePassword = await haveIbeenPawned(password);

        if (!savePassword) {
          return {
            success: false,
            message: 'Password has been pawned',
            status: 'ip',
          };
        }

        entity = await container.cradle.entityService.createEntity({
          email,
          password_hash: await hashPassword(password),
          email_verified: false,
          role: 'admin',
        });

        admin = await container.cradle.adminEntityService.createEntity({
          entity_id: entity.id,
        });

        const serializedEntity = container.cradle.serializeEntity(entity);

        return {
          success: true,
          message: 'Register successful',
          entity: serializedEntity,
          admin: admin,
          status: 'su',
        };
      },
      protocol: {
        http: {
          method: 'POST',
          ip: 400,
          su: 200,
          ic: 400,
        },
      },
      validationSchema: createAdminSchema,
      outputs: type({
        success: 'boolean',
        message: 'string',
        status: 'string',
        entity: 'object',
        admin: 'object',
      }),
    },
  ],
  config: {},
  dependsOn: ['email-password'],
  async initialize(container: AwilixContainer<ReAuthCradle>) {
    if (!this.config.adminEntity) {
      throw new Error('adminEntity service is missing');
    }

    const dpn = checkDependsOn(
      container.cradle.reAuthEngine.getAllPlugins(),
      this.dependsOn!,
    );

    if (!dpn.status)
      throw new Error(
        `${this.name} depends on the following plugins ${dpn.pluginName.join(' ')}`,
      );

    // Register the ban check service in the container
    container.register({
      banCheckService: {
        resolve: () => ({
          checkBanStatus: async (entityId: string): Promise<BanInfo | null> => {
            const config = this.config as AdminConfig;
            if (config.checkBanStatus) {
              return config.checkBanStatus(entityId, container);
            }

            const entity = await container.cradle.entityService.findEntity(
              entityId,
              'id',
            );

            if (entity && entity.banned) {
              return {
                banned: true,
                reason: entity.ban_reason!,
                banned_at: entity.banned_at!,
                banned_by: entity.banned_by!,
              };
            }
            return null;
          },
        }),
      },
    });
    container.register({
      adminEntityService: asValue(this.config.adminEntity),
    });
    container.cradle.reAuthEngine.registerSessionHook(
      'before',
      async (data, container) => {
        const input = data as AuthInput;
        const entityId = await extractEntityId(input, container);
        if (entityId) {
          await performBanCheck(entityId, container);
        }
        return input;
      },
    );

    container.cradle.reAuthEngine.registerSessionHook(
      'after',
      async (data, container) => {
        const { token, ...rest } = data as AuthOutput;
        const entityId = await extractEntityId(rest, container);

        if (!entityId) {
          throw new Error(
            'something is wrong with the session generation process, this is not suppose to happen',
          );
        }

        // check if the entity is on admin table
        const isAdmin = await container.cradle.adminEntityService.findEntity(
          entityId,
          'entity_id',
        );

        if (isAdmin) {
          return {
            ...data,
            entity: {
              ...data.entity,
              is_admin: true,
              roles: isAdmin.roles,
              permissions: isAdmin.permissions,
            },
          } as AuthOutput;
        }

        return data;
      },
    );

    //Info: this hook runs at execution level
    container.cradle.reAuthEngine.registerAuthHook({
      pluginName: this.name,
      type: 'before',
      fn: async (data, container) => {
        const input = data as AuthInput;
        const entityId = await extractEntityId(input, container);

        if (!entityId) {
          throw new Error('you are not authorize for this transaction');
        }

        const isAdmin = await container.cradle.adminEntityService.findEntity(
          entityId,
          'entity_id',
        );

        if (!isAdmin) {
          throw new Error('you are not authorize for this transaction');
        }

        return {
          ...data,
          entity: {
            ...data.entity,
            is_admin: true,
            roles: isAdmin.roles,
            permissions: isAdmin.permissions,
          },
        } as AuthInput;
      },
      session: false,
    });

    container.cradle.reAuthEngine.registerAuthHook({
      pluginName: this.name,
      type: 'after',
      fn: async (data, container) => {
        const input = data as AuthInput;
        const entityId = await extractEntityId(input, container);

        if (!entityId) {
          return data;
        }

        const isAdmin = await container.cradle.adminEntityService.findEntity(
          entityId,
          'entity_id',
        );

        if (!isAdmin) {
          return data;
        }

        return {
          ...data,
          entity: {
            ...data.entity,
            is_admin: true,
            roles: isAdmin.roles,
            permissions: isAdmin.permissions,
          },
        } as AuthInput;
      },
      session: false,
      universal: true,
    });

    this.container = container;
  },

  getSensitiveFields() {
    return ['banned_by'];
  },

  migrationConfig: {
    pluginName: 'admin',
    extendTables: [
      {
        tableName: 'entities',
        columns: {
          banned: {
            type: 'boolean',
            defaultValue: false,
            nullable: false,
          },
          ban_reason: {
            type: 'text',
            nullable: true,
          },
          banned_at: {
            type: 'timestamp',
            nullable: true,
          },
          banned_by: {
            type: 'uuid',
            nullable: true,
            references: {
              table: 'admins',
              column: 'id',
              onDelete: 'SET NULL',
            },
          },
        },
        indexes: [
          {
            columns: ['banned'],
            name: 'idx_entities_banned',
          },
          {
            columns: ['banned_by'],
            name: 'idx_entities_banned_by',
          },
        ],
      },
    ],
    tables: [
      {
        tableName: 'admins',
        columns: {
          id: {
            type: 'uuid',
            primary: true,
            nullable: false,
            unique: true,
            defaultValue: 'uuid',
          },
          entity_id: {
            type: 'uuid',
            nullable: false,
            unique: true,
            index: true,
          },
          permissions: {
            type: 'string',
            nullable: false,
          },
          roles: {
            type: 'string',
            nullable: false,
          },
        },
      },
    ],
  },
};

export default function adminPlugin(
  config: AdminConfig,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<AdminConfig>>;
  }[],
): AuthPlugin<AdminConfig> {
  return createAuthPlugin(config, plugin, overrideStep, {});
}

// Extend the Entity type to include ban fields
declare module '../../types' {
  interface EntityExtension {
    banned?: boolean | null;
    ban_reason?: string | null;
    banned_at?: Date | null;
    banned_by?: string | null;
    /**
     * this is a computed value
     */
    is_admin?: boolean;
    /**
     * this is a computed value
     */
    permissions?: string[] | null;
    /**
     * this is a computed value
     */
    roles?: string[] | null;
  }

  interface ReAuthCradleExtension {
    banCheckService: {
      checkBanStatus: (entityId: string) => Promise<BanInfo | null>;
    };
    adminEntityService: AdminEntityService;
  }
}

export interface AdminEntity {
  id: string;
  entity_id: string;
  permissions?: string[] | null;
  roles?: string[] | null;
}

export type AdminEntityService = {
  findEntity(id: string, field: string): Promise<AdminEntity | null>;
  createEntity(entity: Partial<AdminEntity>): Promise<AdminEntity>;
  updateEntity(
    id: string,
    field: string,
    entity: Partial<AdminEntity>,
  ): Promise<AdminEntity>;
  deleteEntity(id: string, field: string): Promise<void>;
};

export type { BanInfo, AdminConfig };
