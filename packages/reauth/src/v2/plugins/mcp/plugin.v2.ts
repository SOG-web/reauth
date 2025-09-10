import type { AuthPluginV2, OrmLike } from '../../types.v2';
import type { MCPConfigV2 } from './types';
export type { MCPConfigV2 } from './types';
import { authenticateMcpServerStep } from './steps/authenticate-mcp-server.step';
import { createMcpSessionStep } from './steps/create-mcp-session.step';
import { authorizeResourceStep } from './steps/authorize-resource.step';
import { listResourcesStep } from './steps/list-resources.step';
import { revokeMcpSessionStep } from './steps/revoke-mcp-session.step';
import { auditMcpAccessStep } from './steps/audit-mcp-access.step';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';
import { cleanupExpiredSessions } from './utils';

export const baseMcpPluginV2: AuthPluginV2<MCPConfigV2> = {
  name: 'mcp',
  initialize(engine) {
    // MCP doesn't use traditional subject sessions, but we register a resolver for compatibility
    engine.registerSessionResolver('mcp-server', {
      async getById(id: string, orm: OrmLike) {
        const server = await orm.findFirst('mcp_servers', {
          where: (b: any) => b('id', '=', id),
        });
        return (server ?? null) as unknown as
          | import('../../types.v2').Subject
          | null;
      },
      sanitize(server: any) {
        // Remove sensitive server key hash from responses
        const { server_key_hash, ...sanitized } = server;
        return sanitized;
      },
    });
  },
  config: {
    allowedServers: [],
    defaultPermissions: ['read'],
    sessionTtlMinutes: 60,
    rateLimitPerMinute: 100,
    auditingEnabled: true,
    requireTLS: true,
    testServers: {
      enabled: false,
      servers: [],
      environment: 'development',
    },
  },
  steps: [
    authenticateMcpServerStep,
    createMcpSessionStep,
    authorizeResourceStep,
    listResourcesStep,
    revokeMcpSessionStep,
    auditMcpAccessStep,
  ],
  rootHooks: {
    // Opportunistic cleanup for expired MCP sessions (acts as a soft TTL)
    async before(_input, ctx) {
      try {
        const orm = await ctx.engine.getOrm();
        await cleanupExpiredSessions(orm);
      } catch (_) {
        // Best effort cleanup; never block MCP operations
      }
    },
    
    // Audit all MCP operations (if auditing is enabled)
    async after(output, ctx, step) {
      if (ctx.config?.auditingEnabled === false) return;
      
      try {
        // Extract operation info from step and output
        const operation = step.name;
        const success = output && typeof output === 'object' && 'success' in output 
          ? Boolean(output.success) 
          : true;
        
        // Get server/session IDs from output if available
        const serverId = output && typeof output === 'object' && 'others' in output && output.others
          ? (output.others as any)?.serverId || (output.others as any)?.server_id
          : undefined;
          
        const sessionId = output && typeof output === 'object' && 'sessionId' in output
          ? String(output.sessionId)
          : undefined;
        
        // Only audit if we have a server ID
        if (serverId) {
          const orm = await ctx.engine.getOrm();
          await orm.create('mcp_audit_log', {
            server_id: serverId,
            session_id: sessionId || null,
            operation,
            resource_accessed: null,
            success,
            error_message: success ? null : 'Operation failed',
            timestamp: new Date(),
            metadata: {
              step: step.name,
              automaticAudit: true,
            },
          });
        }
      } catch (_) {
        // Best effort audit logging; never block operations
      }
    },
    
    // Log errors for audit trail
    async onError(error, input, ctx, step) {
      if (ctx.config?.auditingEnabled === false) return;
      
      try {
        // Try to extract server ID from input
        const serverId = input && typeof input === 'object' && 'serverId' in input
          ? String((input as any).serverId)
          : undefined;
          
        if (serverId) {
          const orm = await ctx.engine.getOrm();
          await orm.create('mcp_audit_log', {
            server_id: serverId,
            session_id: null,
            operation: step.name,
            resource_accessed: null,
            success: false,
            error_message: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            metadata: {
              step: step.name,
              errorAudit: true,
            },
          });
        }
      } catch (_) {
        // Best effort audit logging; never block operations
      }
    },
  },
};

// Export a configured plugin creator that validates config at construction time
const mcpPluginV2: AuthPluginV2<MCPConfigV2> = createAuthPluginV2<MCPConfigV2>(
  baseMcpPluginV2,
  {
    validateConfig: (config) => {
      const errs: string[] = [];
      
      if (config.sessionTtlMinutes && config.sessionTtlMinutes < 1) {
        errs.push('sessionTtlMinutes must be at least 1 minute');
      }
      
      if (config.rateLimitPerMinute && config.rateLimitPerMinute < 1) {
        errs.push('rateLimitPerMinute must be at least 1');
      }
      
      if (config.allowedServers) {
        for (const server of config.allowedServers) {
          if (!server.name || !server.serverKey) {
            errs.push('Each allowed server must have a name and serverKey');
          }
          if (!Array.isArray(server.capabilities)) {
            errs.push('Each allowed server must have capabilities as an array');
          }
          if (!Array.isArray(server.permissions)) {
            errs.push('Each allowed server must have permissions as an array');
          }
        }
      }
      
      return errs.length ? errs : null;
    },
  },
);

export default mcpPluginV2;