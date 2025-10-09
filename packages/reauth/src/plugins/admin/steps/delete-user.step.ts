import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type DeleteUserInput = {
  token: Token;
  userId: string;
  reason: string;
  hardDelete?: boolean; // false = soft delete, true = hard delete
  metadata?: Record<string, any>;
};

export const deleteUserValidation = type({
  token: tokenType,
  userId: 'string',
  reason: 'string',
  'hardDelete?': 'boolean',
  'metadata?': 'object',
});

export type DeleteUserOutput = {
  deleted?: boolean;
  deleteType?: 'soft' | 'hard';
  token?: Token;
} & AuthOutput;

export const deleteUserStep: AuthStep<
  AdminConfig,
  'delete-user',
  DeleteUserInput,
  DeleteUserOutput
> = {
  name: 'delete-user',
  description: 'Delete a user account (admin only) - USE WITH CAUTION',
  validationSchema: deleteUserValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { unf: 401, aut: 403, su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'userId', 'reason', 'hardDelete', 'metadata'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'deleted?': 'boolean',
    'deleteType?': 'string',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, userId, reason, hardDelete = false, metadata } = input;

    // Check admin permissions
    const session = await ctx.engine.checkSession(token);
    if (!session.subject) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Authentication required',
          status: 'unf',
          error: 'No valid session',
        },
        token,
        session.token,
      );
    }

    const orm = await ctx.engine.getOrm();
    const adminRole = await orm.findFirst('subject_roles', {
      where: (b: any) =>
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

    // Check if admin is trying to delete themselves
    if (session.subject!.id === userId) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Cannot delete your own account',
          status: 'aut',
          error: 'Self-deletion not allowed',
        },
        token,
        session.token,
      );
    }

    // Check if user exists
    const existingUser = await orm.findFirst('subjects', {
      where: (b: any) => b('id', '=', userId),
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

    try {
      const now = new Date();

      if (hardDelete) {
        // HARD DELETE - Completely remove user and all associated data
        // This is destructive and should be used with extreme caution

        // Delete in reverse dependency order
        await orm.deleteMany('audit_logs', {
          where: (b: any) => b('actor_id', '=', userId),
        });

        await orm.deleteMany('subject_roles', {
          where: (b: any) => b('subject_id', '=', userId),
        });

        await orm.deleteMany('user_bans', {
          where: (b: any) => b('subject_id', '=', userId),
        });

        await orm.deleteMany('identities', {
          where: (b: any) => b('subject_id', '=', userId),
        });

        await orm.deleteMany('subjects', {
          where: (b: any) => b('id', '=', userId),
        });
      } else {
        // SOFT DELETE - Mark as deleted but keep data for audit/compliance
        await orm.updateMany('subjects', {
          where: (b: any) => b('id', '=', userId),
          set: {
            is_active: false,
            deleted_at: now,
            deleted_by: session.subject!.id,
            deleted_reason: reason,
            updated_at: now,
          },
        });

        // Deactivate all identities
        await orm.updateMany('identities', {
          where: (b: any) => b('subject_id', '=', userId),
          set: {
            is_active: false,
            updated_at: now,
          },
        });
      }

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: hardDelete ? 'hard_delete_user' : 'soft_delete_user',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            reason,
            hardDelete,
            metadata,
            userDetails: {
              email: existingUser.email,
              username: existingUser.username,
              createdAt: existingUser.created_at,
            },
          }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `User ${hardDelete ? 'permanently deleted' : 'soft deleted'} successfully`,
          status: 'su',
          deleted: true,
          deleteType: hardDelete ? 'hard' : 'soft',
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to delete user',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
