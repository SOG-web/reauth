import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig, AuditLogEntry } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type ViewAuditLogsInput = {
  token: Token;
  page?: number;
  limit?: number;
  actorId?: string;
  targetId?: string;
  action?: string;
  targetType?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  ipAddress?: string;
  sortBy?: 'created_at' | 'action' | 'actor_id';
  sortOrder?: 'asc' | 'desc';
};

export const viewAuditLogsValidation = type({
  token: tokenType,
  'page?': 'number',
  'limit?': 'number',
  'actorId?': 'string',
  'targetId?': 'string',
  'action?': 'string',
  'targetType?': 'string',
  'dateFrom?': 'string',
  'dateTo?': 'string',
  'ipAddress?': 'string',
  'sortBy?': 'string',
  'sortOrder?': 'string',
});

export type ViewAuditLogsOutput = {
  logs?: AuditLogEntry[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  token?: Token;
} & AuthOutput;

export const viewAuditLogsStep: AuthStep<
  AdminConfig,
  'view-audit-logs',
  ViewAuditLogsInput,
  ViewAuditLogsOutput
> = {
  name: 'view-audit-logs',
  description: 'View audit logs with filtering and pagination (admin only)',
  validationSchema: viewAuditLogsValidation,
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
    'actorId',
    'targetId',
    'action',
    'targetType',
    'dateFrom',
    'dateTo',
    'ipAddress',
    'sortBy',
    'sortOrder',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'logs?': 'object[]',
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
      limit = 50,
      actorId,
      targetId,
      action,
      targetType,
      dateFrom,
      dateTo,
      ipAddress,
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

    if (limit < 1 || limit > 200) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Invalid limit',
          status: 'ic',
          error: 'Limit must be between 1 and 200',
        },
        token,
        session.token,
      );
    }

    try {
      const offset = (page - 1) * limit;

      // Build where conditions using FumadB query builder
      const where = (b: any) => {
        const conditions: any[] = [];

        if (actorId) {
          conditions.push(b('actor_id', '=', actorId));
        }

        if (targetId) {
          conditions.push(b('target_id', '=', targetId));
        }

        if (action) {
          conditions.push(b('action', '=', action));
        }

        if (targetType) {
          conditions.push(b('target_type', '=', targetType));
        }

        if (ipAddress) {
          conditions.push(b('ip_address', '=', ipAddress));
        }

        // Date range filters
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (!isNaN(fromDate.getTime())) {
            conditions.push(b('created_at', '>=', fromDate));
          }
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          if (!isNaN(toDate.getTime())) {
            conditions.push(b('created_at', '<=', toDate));
          }
        }

        // Combine conditions with AND
        return conditions.length > 0
          ? conditions.reduce((acc, cond) => b.and(acc, cond))
          : undefined;
      };

      // Get total count
      const totalResult = await orm.count('audit_logs', { where });
      const total = totalResult || 0;

      // Get audit logs
      const auditLogs = await orm.findMany('audit_logs', {
        where,
        orderBy: [[sortBy, sortOrder]],
        limit,
        offset,
      });

      // Format logs
      const logs: AuditLogEntry[] = (auditLogs || []).map((log) => ({
        id: log.id as string,
        actorId: log.actor_id as string,
        action: log.action as string,
        targetType: log.target_type as string | undefined,
        targetId: log.target_id as string | undefined,
        details: log.details ? JSON.parse(log.details as string) : undefined,
        ipAddress: log.ip_address as string | undefined,
        userAgent: log.user_agent as string | undefined,
        createdAt: (log.created_at as Date)?.toISOString() || '',
      }));

      const totalPages = Math.ceil(total / limit);

      return attachNewTokenIfDifferent(
        {
          success: true,
          message: `Found ${logs.length} audit log entries`,
          status: 'su',
          logs,
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
          message: 'Failed to retrieve audit logs',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
