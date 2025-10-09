import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig, AdminUser } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ListUsersInput = {
  token: Token;
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'banned' | 'all';
  sortBy?: 'created_at' | 'updated_at' | 'email' | 'username';
  sortOrder?: 'asc' | 'desc';
};

export const listUsersValidation = type({
  token: tokenType,
  'page?': 'number',
  'limit?': 'number',
  'search?': 'string',
  'role?': 'string',
  'status?': 'string',
  'sortBy?': 'string',
  'sortOrder?': 'string',
});

export type ListUsersOutput = {
  users?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  token?: Token;
} & AuthOutput;

export const listUsersStep: AuthStep<
  AdminConfig,
  'list-users',
  ListUsersInput,
  ListUsersOutput
> = {
  name: 'list-users',
  description: 'List users with filtering and pagination (admin only)',
  validationSchema: listUsersValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { unf: 401, aut: 403, su: 200, ic: 400 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'page',
    'limit',
    'search',
    'role',
    'status',
    'sortBy',
    'sortOrder',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'users?': 'object[]',
    'total?': 'number',
    'page?': 'number',
    'limit?': 'number',
    'totalPages?': 'number',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      page = 1,
      limit = 20,
      search,
      role,
      status = 'all',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = input;

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

    // Validate input
    if (page < 1) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid page number',
          status: 'ic',
          error: 'Page must be >= 1',
        },
        token,
        session.token,
      );
    }

    if (limit < 1 || limit > 100) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid limit',
          status: 'ic',
          error: 'Limit must be between 1 and 100',
        },
        token,
        session.token,
      );
    }

    try {
      const offset = (page - 1) * limit;

      // Pre-fetch banned user IDs for status filtering
      let bannedUserIds: any[] = [];
      if (status === 'banned') {
        const bannedResults = await orm.findMany('user_bans', {
          where: (b: any) =>
            b.or(b('expires_at', '>', new Date()), b('expires_at', '=', null)),
        });
        bannedUserIds = bannedResults || [];
      }

      // Build where conditions using FumadB query builder
      const where = (b: any) => {
        const conditions: any[] = [];

        // Search filter
        if (search) {
          conditions.push(
            b.or(
              b('email', 'contains', search),
              b('username', 'contains', search),
            ),
          );
        }

        // Status filter
        if (status !== 'all') {
          switch (status) {
            case 'active':
              conditions.push(b('is_active', '=', true));
              conditions.push(
                b.or(
                  b('deleted_at', '=', null),
                  b('deleted_at', '>', new Date()),
                ),
              );
              break;
            case 'inactive':
              conditions.push(b('is_active', '=', false));
              break;
            case 'banned':
              // Users with active bans
              if (bannedUserIds.length > 0) {
                conditions.push(
                  b(
                    'id',
                    'in',
                    bannedUserIds.map((ban) => ban.subject_id),
                  ),
                );
              } else {
                // No banned users, return false condition
                conditions.push(b('id', '=', null));
              }
              break;
          }
        }

        // Combine conditions with AND
        return conditions.length > 0
          ? conditions.reduce((acc, cond) => b.and(acc, cond))
          : undefined;
      };

      // Get total count
      const totalResult = await orm.count('subjects', { where });
      const total = totalResult || 0;

      // Get users
      const subjects = await orm.findMany('subjects', {
        where,
        orderBy: [[sortBy, sortOrder]],
        limit,
        offset,
      });

      // Enrich with roles and ban status
      const users: AdminUser[] = [];
      for (const subject of subjects || []) {
        // Get roles
        const roles = await orm.findMany('subject_roles', {
          where: (b) =>
            b.and(b('subject_id', '=', subject.id), b('revoked_at', '=', null)),
        });

        // Get permissions from roles
        const permissions = new Set<string>();
        roles?.forEach((r) => {
          if (r.permissions) {
            try {
              const rolePerms = JSON.parse(r.permissions as string);
              rolePerms.forEach((p: string) => permissions.add(p));
            } catch {}
          }
        });

        // Check ban status
        const activeBan = await orm.findFirst('user_bans', {
          where: (b) =>
            b.and(
              b('subject_id', '=', subject.id),
              b.or(
                b('expires_at', '>', new Date()),
                b('expires_at', '=', null),
              ),
            ),
        });

        users.push({
          id: subject.id as string,
          email: subject.email as string | undefined,
          username: subject.username as string | undefined,
          roles: roles?.map((r) => r.role as string) || [],
          permissions: Array.from(permissions),
          createdAt: (subject.created_at as Date)?.toISOString() || '',
          lastLogin: (subject.last_login_at as Date)?.toISOString(),
          isActive: Boolean(subject.is_active) && !subject.deleted_at,
          metadata: subject.metadata
            ? JSON.parse(subject.metadata as string)
            : undefined,
        });
      }

      const totalPages = Math.ceil(total / limit);

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Found ${users.length} users`,
          status: 'su',
          users,
          total,
          page,
          limit,
          totalPages,
        },
        token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to list users',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
