import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type UnbanUserInput = {
  token: Token;
  userId: string;
  reason: string;
  restoreActiveStatus?: boolean;
  metadata?: Record<string, any>;
};

export const unbanUserValidation = type({
  token: tokenType,
  userId: 'string',
  reason: 'string',
  'restoreActiveStatus?': 'boolean',
  'metadata?': 'object',
});

export type UnbanUserOutput = {
  unbanned?: boolean;
  userReactivated?: boolean;
} & AuthOutput;

export const unbanUserStep: AuthStep<
  AdminConfig,
  'unban-user',
  UnbanUserInput,
  UnbanUserOutput
> = {
  name: 'unban-user',
  description: 'Unban a user account (admin only)',
  validationSchema: unbanUserValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, aut: 403, su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'userId', 'reason', 'restoreActiveStatus', 'metadata'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'unbanned?': 'boolean',
    'userReactivated?': 'boolean',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      userId,
      reason,
      restoreActiveStatus = true,
      metadata,
    } = input;

    // Check admin permissions
    const session = await ctx.engine.checkSession(token);
    if (!session.subject) {
      return {
        success: false,
        message: 'Authentication required',
        status: 'unf',
        error: 'No valid session',
      };
    }

    const orm = await ctx.engine.getOrm();
    const adminRole = await orm.findFirst('subject_roles', {
      where: (b) =>
        b.and(
          b('subject_id', '=', session.subject!.id),
          b('role', '=', ctx.config?.adminRole || 'admin'),
        ),
    });

    if (!adminRole) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Admin access required',
          status: 'aut',
          error: 'Insufficient permissions',
        },
        token,
        session.token,
      );
    }

    // Check if user exists
    const existingUser = await orm.findFirst('subjects', {
      where: (b) => b('id', '=', userId),
    });

    if (!existingUser) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User not found',
          status: 'nf',
          error: 'User does not exist',
        },
        token,
        session.token,
      );
    }

    // Check if user is actually banned
    const activeBan = await orm.findFirst('user_bans', {
      where: (b) =>
        b.and(
          b('subject_id', '=', userId),
          b.or(b('expires_at', '>', new Date()), b('expires_at', '=', null)),
        ),
    });

    if (!activeBan) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User is not currently banned',
          status: 'ic',
          error: 'User not banned',
        },
        token,
        session.token,
      );
    }

    try {
      const now = new Date();
      let userReactivated = false;

      // Update the ban record to mark it as lifted
      await orm.updateMany('user_bans', {
        where: (b) => b('id', '=', activeBan.id),
        set: {
          lifted_at: now,
          lifted_by: session.subject!.id,
          lifted_reason: reason,
          metadata: metadata ? JSON.stringify(metadata) : activeBan.metadata,
          updated_at: now,
        },
      });

      // Reactivate user if requested
      if (restoreActiveStatus) {
        await orm.updateMany('subjects', {
          where: (b) => b('id', '=', userId),
          set: {
            is_active: true,
            updated_at: now,
          },
        });
        userReactivated = true;
      }

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: 'unban_user',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            reason,
            restoreActiveStatus,
            metadata,
            userReactivated,
            banId: activeBan.id,
          }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `User unbanned successfully`,
          status: 'su',
          unbanned: true,
          userReactivated,
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to unban user',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
