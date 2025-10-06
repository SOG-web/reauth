import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export interface UpdateUserInput {
  token: Token;
  userId: string;
  email?: string;
  username?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export const updateUserValidation = type({
  token: tokenType,
  userId: 'string',
  'email?': 'string',
  'username?': 'string',
  'metadata?': 'object',
  'isActive?': 'boolean',
});

export interface UpdateUserOutput extends AuthOutput {
  userUpdated?: boolean;
  changes?: string[];
  token?: Token;
}

export const updateUserStep: AuthStep<
  AdminConfig,
  'update-user',
  UpdateUserInput,
  UpdateUserOutput
> = {
  name: 'update-user',
  description: 'Update user account details (admin only)',
  validationSchema: updateUserValidation,
  protocol: {
    http: {
      method: 'PUT',
      codes: { unf: 401, aut: 403, su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'userId', 'email', 'username', 'metadata', 'isActive'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'userUpdated?': 'boolean',
    'changes?': 'string[]',
    'token?': tokenType,
  }),
  async run(input: UpdateUserInput, ctx): Promise<UpdateUserOutput> {
    const { token, userId, email, username, metadata, isActive } = input;

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
      where: (b: any) => b.and(
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
      const changes: string[] = [];
      const updateData: any = {};

      // Update email if provided
      if (email !== undefined && email !== existingUser.email) {
        updateData.email = email;
        changes.push('email');

        // Update identity if it exists
        await orm.updateMany('identities', {
          where: (b: any) => b('subject_id', '=', userId),
          set: { identifier: email },
        });
      }

      // Update username if provided
      if (username !== undefined && username !== existingUser.username) {
        updateData.username = username;
        changes.push('username');

        // Update identity if it exists
        await orm.updateMany('identities', {
          where: (b: any) => b('subject_id', '=', userId),
          set: { identifier: username },
        });
      }

      // Update metadata if provided
      if (metadata !== undefined) {
        updateData.metadata = JSON.stringify(metadata);
        changes.push('metadata');
      }

      // Update active status if provided
      if (isActive !== undefined) {
        updateData.is_active = isActive;
        changes.push(isActive ? 'activated' : 'deactivated');
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        await orm.updateMany('subjects', {
          where: (b: any) => b('id', '=', userId),
          set: updateData,
        });
      }

      // Log the admin action
      if (ctx.config?.enableAuditLogging && changes.length > 0) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: 'update_user',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            changes,
            previousValues: {
              email: existingUser.email,
              username: existingUser.username,
              isActive: existingUser.is_active,
            },
            newValues: {
              email,
              username,
              isActive,
            },
          }),
          ip_address: null,
          user_agent: null,
          created_at: new Date(),
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `User updated successfully`,
          status: 'su',
          userUpdated: changes.length > 0,
          changes,
        },
        token,
        session.token,
      );

    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to update user',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
