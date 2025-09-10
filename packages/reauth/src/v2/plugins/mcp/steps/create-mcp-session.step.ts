import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { MCPConfigV2, MCPSessionInput } from '../types';
import { 
  generateSessionToken, 
  hashSessionToken, 
  calculateSessionExpiry 
} from '../utils';

export const createMcpSessionValidation = type({
  serverId: 'string',
  requestedCapabilities: 'string[]?',
  sessionTtlMinutes: 'number?',
});

export const createMcpSessionOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'token?': 'string',
  'sessionId?': 'string',
  'expiresAt?': 'string',
  'grantedCapabilities?': 'string[]',
});

export const createMcpSessionStep: AuthStepV2<
  MCPSessionInput,
  AuthOutput,
  MCPConfigV2
> = {
  name: 'create-mcp-session',
  description: 'Create an authenticated session for an MCP server',
  validationSchema: createMcpSessionValidation,
  outputs: createMcpSessionOutputs,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        su: 200,    // success - session created
        unf: 401,   // unauthorized - invalid server
        ip: 403,    // insufficient permissions
        ic: 400,    // invalid configuration
        eq: 429,    // rate limited
      },
    },
  },
  inputs: ['serverId', 'requestedCapabilities', 'sessionTtlMinutes'],
  
  async run(input, ctx): Promise<AuthOutput> {
    const { 
      serverId, 
      requestedCapabilities = [], 
      sessionTtlMinutes 
    } = input;
    const orm = await ctx.engine.getOrm();
    
    try {
      // Check if server exists and is active
      const server = await orm.findFirst('mcp_servers', {
        where: (b: any) => b.and(
          b('id', '=', serverId),
          b('is_active', '=', true)
        ),
      });
      
      if (!server) {
        return {
          success: false,
          message: 'MCP server not found or inactive',
          status: 'unf',
        };
      }
      
      // Check concurrent session limit
      const activeSessions = await orm.count('mcp_sessions', {
        where: (b: any) => b.and(
          b('server_id', '=', serverId),
          b('expires_at', '>', new Date())
        ),
      });
      
      const maxSessions = (server.max_concurrent_sessions as number) || 10;
      if (activeSessions >= maxSessions) {
        return {
          success: false,
          message: 'Maximum concurrent sessions exceeded for this server',
          status: 'eq',
        };
      }
      
      // Determine capabilities to grant
      const serverCapabilities = (server.capabilities as string[]) || [];
      const grantedCapabilities = requestedCapabilities.length > 0
        ? requestedCapabilities.filter(cap => serverCapabilities.includes(cap))
        : serverCapabilities;
      
      if (requestedCapabilities.length > 0 && grantedCapabilities.length === 0) {
        return {
          success: false,
          message: 'No requested capabilities can be granted',
          status: 'ip',
        };
      }
      
      // Calculate session expiry
      const ttl = sessionTtlMinutes || ctx.config?.sessionTtlMinutes || 60;
      const expiresAt = calculateSessionExpiry(ttl);
      
      // Generate session token
      const sessionToken = generateSessionToken();
      const tokenHash = hashSessionToken(sessionToken);
      
      // Create session record
      const sessionData = {
        server_id: serverId,
        session_token_hash: tokenHash,
        capabilities_granted: grantedCapabilities,
        expires_at: expiresAt,
        created_at: new Date(),
        last_used_at: new Date(),
      };
      
      const session = await orm.create('mcp_sessions', sessionData);
      
      return {
        success: true,
        message: 'MCP session created successfully',
        status: 'su',
        token: sessionToken,
        sessionId: session.id as string,
        expiresAt: expiresAt.toISOString(),
        grantedCapabilities,
        others: {
          serverId,
          serverName: server.name as string,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create MCP session due to system error',
        status: 'ic',
      };
    }
  },
};