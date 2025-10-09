import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type BanUserInput = {
  token: Token;
  userId: string;
  reason: string;
  duration?: number; // in seconds, null for permanent
  banType?: 'temporary' | 'permanent';
  metadata?: Record<string, any>;
};

export const banUserValidation = type({
  token: tokenType,
  userId: 'string',
  reason: 'string',
  'duration?': 'number',
  'banType?': 'string',
  'metadata?': 'object',
});

export type BanUserOutput = {
  banned?: boolean;
  banExpiresAt?: string;
  previousStatus?: string;
} & AuthOutput;

export const banUserStep: AuthStep<
  AdminConfig,
  'ban-user',
  BanUserInput,
  BanUserOutput
> = {
  name: 'ban-user',
  description: 'Ban a user account (admin only)',
  validationSchema: banUserValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { unf: 401, aut: 403, su: 200, ic: 400, nf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'userId', 'reason', 'duration', 'banType', 'metadata'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'banned?': 'boolean',
    'banExpiresAt?': 'string',
    'previousStatus?': 'string',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      userId,
      reason,
      duration,
      banType = 'permanent',
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

    // Check if user is already banned
    const existingBan = await orm.findFirst('user_bans', {
      where: (b) =>
        b.and(
          b('subject_id', '=', userId),
          b.or(b('expires_at', '>', new Date()), b('expires_at', '=', null)),
        ),
    });

    if (existingBan) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'User is already banned',
          status: 'ic',
          error: 'User already banned',
        },
        token,
        session.token,
      );
    }

    try {
      const now = new Date();
      let expiresAt: Date | null = null;

      if (banType === 'temporary' && duration) {
        expiresAt = new Date(now.getTime() + duration * 1000);
      }

      // Create ban record
      await orm.create('user_bans', {
        subject_id: userId,
        banned_by: session.subject!.id,
        reason,
        ban_type: banType,
        duration_seconds: duration || null,
        expires_at: expiresAt,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: now,
      });

      // Deactivate the user
      const previousStatus = existingUser.is_active;
      await orm.updateMany('subjects', {
        where: (b) => b('id', '=', userId),
        set: {
          is_active: false,
          updated_at: now,
        },
      });

      // Log the admin action
      if (ctx.config?.enableAuditLogging) {
        await orm.create('audit_logs', {
          actor_id: session.subject!.id,
          action: 'ban_user',
          target_type: 'subject',
          target_id: userId,
          details: JSON.stringify({
            reason,
            banType,
            duration,
            expiresAt: expiresAt?.toISOString(),
            metadata,
            previousStatus,
          }),
          ip_address: null,
          user_agent: null,
          created_at: now,
        });
      }

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `User banned successfully`,
          status: 'su',
          banned: true,
          banExpiresAt: expiresAt?.toISOString(),
          previousStatus: previousStatus ? 'active' : 'inactive',
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to ban user',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
