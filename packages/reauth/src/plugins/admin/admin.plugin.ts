import { AwilixContainer } from 'awilix';
import { AuthPlugin, AuthInput, AuthOutput, ReAuthCradle } from '../../types';
import { createStandardSchemaRule } from '../../utils';
import { type } from 'arktype';
import { ReAuthEngine } from '../../auth-engine';
import { extractEntityId, performBanCheck } from './ban-interceptor';

const userIdSchema = type('string');
const reasonSchema = type('string');

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
}

interface BanInfo {
  banned: boolean;
  reason?: string;
  banned_at?: Date;
  banned_by?: string;
}

const plugin: AuthPlugin<AdminConfig> = {
  name: 'admin',
  steps: [
    {
      name: 'ban-user',
      description: 'Ban a user from the system',
      validationSchema: {
        entityId: createStandardSchemaRule(
          userIdSchema,
          'Please provide a valid user ID',
        ),
        reason: createStandardSchemaRule(
          reasonSchema,
          'Please provide a reason for banning',
        ),
        bannedBy: createStandardSchemaRule(
          userIdSchema,
          'Please provide the ID of who is banning',
        ),
      },
      hooks: {},
      inputs: ['entityId', 'reason', 'bannedBy'],
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { entityId, reason, bannedBy } = input;
        const { container, config } = pluginProperties!;

        try {
          if (config.banUser) {
            await config.banUser(entityId, reason, bannedBy, container);
          } else {
            await container.cradle.entityService.updateEntity(entityId, 'id', {
              banned: true,
              ban_reason: reason,
              banned_at: new Date(),
              banned_by: bannedBy,
            });
          }

          return {
            success: true,
            message: 'User has been banned successfully',
            status: 'su',
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to ban user',
            status: 'error',
          };
        }
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          su: 200,
          error: 500,
        },
      },
    },
    {
      name: 'unban-user',
      description: 'Unban a user from the system',
      validationSchema: {
        entityId: createStandardSchemaRule(
          userIdSchema,
          'Please provide a valid user ID',
        ),
        unbannedBy: createStandardSchemaRule(
          userIdSchema,
          'Please provide the ID of who is unbanning',
        ),
      },
      hooks: {},
      inputs: ['entityId', 'unbannedBy'],
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { entityId, unbannedBy } = input;
        const { container, config } = pluginProperties!;

        try {
          if (config.unbanUser) {
            await config.unbanUser(entityId, unbannedBy, container);
          } else {
            await container.cradle.entityService.updateEntity(entityId, 'id', {
              banned: false,
              ban_reason: undefined,
              banned_at: undefined,
              banned_by: undefined,
              updated_at: new Date(),
            });
          }

          return {
            success: true,
            message: 'User has been unbanned successfully',
            status: 'unbanned',
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to unban user',
            status: 'error',
          };
        }
      },
      protocol: {
        http: {
          method: 'POST',
          auth: true,
          unbanned: 200,
          error: 500,
        },
      },
    },
    {
      name: 'check-ban-status',
      description: 'Check if a user is banned',
      validationSchema: {
        entityId: createStandardSchemaRule(
          userIdSchema,
          'Please provide a valid user ID',
        ),
      },
      hooks: {},
      inputs: ['entityId'],
      async run(input: AuthInput, pluginProperties): Promise<AuthOutput> {
        const { entityId } = input;
        const { container, config } = pluginProperties!;

        try {
          let banInfo: BanInfo | null = null;

          if (config.checkBanStatus) {
            banInfo = await config.checkBanStatus(entityId, container);
          } else {
            const entity = await container.cradle.entityService.findEntity(
              entityId,
              'id',
            );

            if (entity && entity.banned) {
              banInfo = {
                banned: true,
                reason: entity.ban_reason,
                banned_at: entity.banned_at,
                banned_by: entity.banned_by,
              };
            }
          }

          return {
            success: true,
            message: banInfo ? 'User is banned' : 'User is not banned',
            status: 'su',
            banInfo,
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to check ban status',
            status: 'error',
          };
        }
      },
      protocol: {
        http: {
          method: 'GET',
          auth: true,
          su: 200,
          error: 500,
        },
      },
    },
  ],
  config: {},
  async initialize(container: AwilixContainer<ReAuthCradle>) {
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
                reason: entity.ban_reason,
                banned_at: entity.banned_at,
                banned_by: entity.banned_by,
              };
            }
            return null;
          },
        }),
      },
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
    this.container = container;
  },

  getSensitiveFields() {
    return ['ban_reason', 'banned_by'];
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
          email: {
            type: 'string',
            nullable: false,
            unique: true,
            index: true,
          },
          password_hash: {
            type: 'string',
            nullable: false,
          },
        },
      },
    ],
  },
};

export default function adminPlugin(
  config?: AdminConfig,
): AuthPlugin<AdminConfig> {
  return {
    ...plugin,
    config: config || {},
  };
}

// Extend the Entity type to include ban fields
declare module '../../types' {
  interface EntityExtension {
    banned?: boolean;
    ban_reason?: string | undefined;
    banned_at?: Date | undefined;
    banned_by?: string | undefined;
  }

  interface ReAuthCradleExtension {
    banCheckService: {
      checkBanStatus: (entityId: string) => Promise<BanInfo | null>;
    };
  }
}

export type { BanInfo, AdminConfig };
