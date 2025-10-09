import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type AssignRoleInput = {
  token: Token;
  userId: string;
  role: string;
  permissions?: string[];
  expiresAt?: string; // ISO date string
  reason: string;
  metadata?: Record<string, any>;
};

export const assignRoleValidation = type({
  token: tokenType,
  userId: 'string',
  role: 'string',
  'permissions?': 'string[]',
  'expiresAt?': 'string',
  reason: 'string',
  'metadata?': 'object',
});

export type AssignRoleOutput = {
  roleAssigned?: boolean;
  roleId?: string;
  expiresAt?: string;
} & AuthOutput;

export const assignRoleStep: AuthStep<
  AdminConfig,
  'assign-role',
  AssignRoleInput,
  AssignRoleOutput
> = {
  name: 'assign-role',
  description: 'Assign a role to a user (admin only)',
  validationSchema: assignRoleValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, aut: 403, su: 201, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'userId',
    'role',
    'permissions',
    'expiresAt',
    'reason',
    'metadata',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'roleAssigned?': 'boolean',
    'roleId?': 'string',
    'expiresAt?': 'string',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      userId,
      role,
      permissions = [],
      expiresAt,
      reason,
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

    // Validate role
    if (
      ctx.config?.availableRoles &&
      !ctx.config.availableRoles.includes(role)
    ) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid role',
          status: 'ic',
          error: `Role '${role}' is not in the list of available roles`,
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

    // Check if user already has this role
    const existingRole = await orm.findFirst('subject_roles', {
      where: (b) => b.and(b('subject_id', '=', userId), b('role', '=', role)),
    });

    if (existingRole) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User already has this role',
          status: 'ic',
          error: 'Role already assigned',
        },
        token,
        session.token,
      );
    }

    try {
      const now = new Date();
      let expiresAtDate: Date | null = null;

      if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          return attachNewTokenIfDifferent(
            {
              success: false,
              message: 'Invalid expiration date',
              status: 'ic',
              error: 'expiresAt must be a valid ISO date string',
            },
            token,
            session.token,
          );
        }
      }

      // Assign the role
      const roleRecord = await orm.create('subject_roles', {
        subject_id: userId,
        role,
        permissions: JSON.stringify(permissions),
        assigned_by: session.subject!.id,
        assigned_at: now,
        expires_at: expiresAtDate,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: 'assign_role',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            role,
            permissions,
            expiresAt: expiresAtDate?.toISOString(),
            reason,
            metadata,
          }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Role '${role}' assigned successfully`,
          status: 'su',
          roleAssigned: true,
          roleId: roleRecord.id as string,
          expiresAt: expiresAtDate?.toISOString(),
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to assign role',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
