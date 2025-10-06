import { type } from 'arktype';
import {
  type AuthStep,
  type AuthOutput,
  type Token,
  tokenType,
} from '../../../types';
import type { AdminConfig } from '../types';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export interface SystemStatusInput {
  token: Token;
  includeDatabaseStats?: boolean;
  includePluginStatus?: boolean;
  includeSessionStats?: boolean;
}

export const systemStatusValidation = type({
  token: tokenType,
  'includeDatabaseStats?': 'boolean',
  'includePluginStatus?': 'boolean',
  'includeSessionStats?': 'boolean',
});

export interface SystemStatusOutput extends AuthOutput {
  uptime?: number;
  version?: string;
  database?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionCount?: number;
    activeConnections?: number;
  };
  plugins?: {
    name: string;
    status: 'active' | 'inactive' | 'error';
    version?: string;
    config?: Record<string, any>;
  }[];
  sessions?: {
    active: number;
    totalToday: number;
    averageDuration: number;
  };
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  token?: Token;
}

export const systemStatusStep: AuthStep<
  AdminConfig,
  'system-status',
  SystemStatusInput,
  SystemStatusOutput
> = {
  name: 'system-status',
  description: 'Get system status and metrics (admin only)',
  validationSchema: systemStatusValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { unf: 401, aut: 403, su: 200 },
      auth: true,
    },
  },
  inputs: ['token', 'includeDatabaseStats', 'includePluginStatus', 'includeSessionStats'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'uptime?': 'number',
    'version?': 'string',
    'database?': 'object',
    'plugins?': 'object[]',
    'sessions?': 'object',
    'memory?': 'object',
    'token?': tokenType,
  }),
  async run(input, ctx) {
    const {
      token,
      includeDatabaseStats = true,
      includePluginStatus = true,
      includeSessionStats = true
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

    try {
      const result: SystemStatusOutput = {
        success: true,
        message: 'System status retrieved successfully',
        status: 'su',
        uptime: process.uptime(),
        version: process.version,
      };

      // Database stats
      if (includeDatabaseStats) {
        try {
          // Test database connection
          const testQuery = await orm.findFirst('subjects', {});
          const dbStatus: SystemStatusOutput['database'] = {
            status: 'healthy',
          };

          // Try to get connection stats if available
          try {
            // This would depend on the ORM implementation
            // For now, just mark as healthy if we can query
            dbStatus.connectionCount = 1; // Placeholder
            dbStatus.activeConnections = 1; // Placeholder
          } catch {}

          result.database = dbStatus;
        } catch (error) {
          result.database = {
            status: 'unhealthy',
          };
        }
      }

      // Plugin status - simplified since we don't have direct plugin access
      if (includePluginStatus) {
        const plugins: SystemStatusOutput['plugins'] = [];

        // Basic plugin status - we know admin plugin is active
        plugins.push({
          name: 'admin',
          status: 'active',
          version: '1.0.0',
          config: { enabled: true },
        });

        // Add other common plugins if they exist
        const commonPlugins = ['email-password', 'session', 'jwt', 'organization'];
        for (const pluginName of commonPlugins) {
          try {
            const plugin = ctx.engine.getPlugin(pluginName);
            if (plugin) {
              plugins.push({
                name: pluginName,
                status: 'active',
                version: '1.0.0',
                config: { enabled: true },
              });
            }
          } catch {}
        }

        result.plugins = plugins;
      }

      // Session stats
      if (includeSessionStats) {
        try {
          // Get today's session count
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const todaySessions = await orm.count('sessions', {
            where: (b: any) => b.and(
              b('created_at', '>=', today),
              b('created_at', '<', tomorrow)
            ),
          });

          // Simplified session stats
          result.sessions = {
            active: 0, // Placeholder - would need session service integration
            totalToday: todaySessions || 0,
            averageDuration: 1800, // 30 minutes placeholder
          };
        } catch (error) {
          // Session stats failed, but don't fail the whole request
          result.sessions = {
            active: 0,
            totalToday: 0,
            averageDuration: 0,
          };
        }
      }

      // Memory stats
      const memUsage = process.memoryUsage();
      result.memory = {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      };

      return attachNewTokenIfDifferent(result, token, session.token);

    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          message: 'Failed to retrieve system status',
          status: 'ic',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        token,
        session.token,
      );
    }
  },
};
