import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export interface RevokeRoleInput {
  token: Token;
  userId: string;
  role: string;
  reason: string;
  metadata?: Record<string, any>;
}

export const revokeRoleValidation = type({
  token: tokenType,
  userId: 'string',
  role: 'string',
  reason: 'string',
  'metadata?': 'object',
});

export interface RevokeRoleOutput extends AuthOutput {
  roleRevoked?: boolean;
  roleId?: string;
}

export const revokeRoleStep: AuthStep<
  AdminConfig,
  'revoke-role',
  RevokeRoleInput,
  RevokeRoleOutput
> = {
  name: 'revoke-role',
  description: 'Revoke a role from a user (admin only)',
  validationSchema: revokeRoleValidation,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { unf: 401, aut: 403, su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'userId', 'role', 'reason', 'metadata'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'roleRevoked?': 'boolean',
    'roleId?': 'string',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const { token, userId, role, reason, metadata } = input;

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
      where: (b) => b.and(
        b('subject_id', '=', session.subject!.id),
        b('role', '=', ctx.config?.adminRole || 'admin')
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

    // Check if user has this role
    const existingRole = await orm.findFirst('subject_roles', {
      where: (b) => b.and(
        b('subject_id', '=', userId),
        b('role', '=', role)
      ),
    });

    if (!existingRole) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User does not have this role',
          status: 'nf',
          error: 'Role not assigned',
        },
        token,
        session.token,
      );
    }

    // Prevent admin from revoking their own admin role if they're the only admin
    if (role === (ctx.config?.adminRole || 'admin') &&
        session.subject!.id === userId) {
      // Check if there are other admins
      const otherAdmins = await orm.findMany('subject_roles', {
        where: (b) => b.and(
          b('subject_id', '!=', userId),
          b('role', '=', ctx.config?.adminRole || 'admin')
        ),
        limit: 1,
      });

      if (!otherAdmins || otherAdmins.length === 0) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            message: 'Cannot revoke the last admin role',
            status: 'aut',
            error: 'At least one admin must remain',
          },
          token,
          session.token,
        );
      }
    }

    try {
      const now = new Date();

      // Revoke the role
      await orm.updateMany('subject_roles', {
        where: (b) => b('id', '=', existingRole.id),
        set: {
          revoked_at: now,
          revoked_by: session.subject!.id,
          revoked_reason: reason,
          metadata: metadata ? JSON.stringify(metadata) : existingRole.metadata,
          updated_at: now,
        },
      });

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: 'revoke_role',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            role,
            reason,
            metadata,
            previousPermissions: existingRole.permissions,
          }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Role '${role}' revoked successfully`,
          status: 'su',
          roleRevoked: true,
          roleId: existingRole.id as string,
        },
        token,
        session.token,
      );

    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to revoke role',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
