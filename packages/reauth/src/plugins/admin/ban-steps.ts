import type { AuthInput, AuthOutput, AuthStep } from '../../types';
import type { AdminConfig, BanInfo } from './admin.plugin';
import { type } from 'arktype';

const userIdSchema = type('string');
const reasonSchema = type('string');

const banSteps: AuthStep<AdminConfig>[] = [
  {
    name: 'ban-user',
    description: 'Ban a user from the system',
    validationSchema: type({
      entityId: userIdSchema,
      reason: reasonSchema,
      bannedBy: userIdSchema,
    }),
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
    outputs: type({
      success: 'boolean',
      message: 'string',
      status: 'string',
    }),
  },
  {
    name: 'unban-user',
    description: 'Unban a user from the system',
    validationSchema: type({
      entityId: userIdSchema,
      unbannedBy: userIdSchema,
    }),
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
          status: 'su',
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
        su: 200,
        error: 500,
      },
    },
    outputs: type({
      success: 'boolean',
      message: 'string',
      status: 'string',
    }),
  },
  {
    name: 'check-ban-status',
    description: 'Check if a user is banned',
    validationSchema: type({
      entityId: userIdSchema,
    }),
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
              reason: entity.ban_reason!,
              banned_at: entity.banned_at!,
              banned_by: entity.banned_by!,
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
    outputs: type({
      success: 'boolean',
      message: 'string',
      status: 'string',
      banInfo: 'object',
    }),
  },
];

export default banSteps;
