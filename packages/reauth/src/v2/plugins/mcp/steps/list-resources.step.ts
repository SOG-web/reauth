import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { MCPConfigV2, MCPListResourcesInput, MCPListResourcesOutput } from '../types';
import { 
  hashSessionToken, 
  isSessionExpired, 
  getDefaultMCPResources,
  hasCapability 
} from '../utils';

export const listResourcesValidation = type({
  sessionToken: 'string',
});

export const listResourcesOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  resources: 'object[]',
});

export const listResourcesStep: AuthStepV2<
  MCPListResourcesInput,
  MCPListResourcesOutput,
  MCPConfigV2
> = {
  name: 'list-resources',
  description: 'List available authentication resources for an MCP server',
  validationSchema: listResourcesValidation,
  outputs: listResourcesOutputs,
  protocol: {
    http: {
      method: 'GET',
      codes: { 
        su: 200,    // success - resources listed
        unf: 401,   // unauthorized - invalid session
        eq: 410,    // session expired
        ic: 400,    // invalid request
      },
      auth: true, // This step requires authentication
    },
  },
  inputs: ['sessionToken'],
  
  async run(input, ctx): Promise<MCPListResourcesOutput> {
    const { sessionToken } = input;
    const orm = await ctx.engine.getOrm();
    
    try {
      // Find session by token hash
      const tokenHash = hashSessionToken(sessionToken);
      const session = await orm.findFirst('mcp_sessions', {
        where: (b: any) => b('session_token_hash', '=', tokenHash),
      });
      
      if (!session) {
        return {
          success: false,
          message: 'Invalid session token',
          status: 'unf',
          resources: [],
        };
      }
      
      // Check if session is expired
      if (isSessionExpired(new Date(session.expires_at as string))) {
        return {
          success: false,
          message: 'Session has expired',
          status: 'eq',
          resources: [],
        };
      }
      
      // Get server information
      const server = await orm.findFirst('mcp_servers', {
        where: (b: any) => b('id', '=', session.server_id),
      });
      
      if (!server || !server.is_active) {
        return {
          success: false,
          message: 'Server not found or inactive',
          status: 'unf',
          resources: [],
        };
      }
      
      // Get all available resources
      const allResources = getDefaultMCPResources();
      
      // Filter resources based on server capabilities
      const grantedCapabilities = (session.capabilities_granted as string[]) || [];
      const accessibleResources = allResources.filter(resource => {
        return hasCapability(grantedCapabilities, resource.uri);
      });
      
      // Update session last used time
      await orm.updateMany('mcp_sessions', {
        where: (b: any) => b('id', '=', session.id),
        set: {
          last_used_at: new Date(),
        },
      });
      
      return {
        success: true,
        message: `Found ${accessibleResources.length} accessible resources`,
        status: 'su',
        resources: accessibleResources,
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to list resources due to system error',
        status: 'ic',
        resources: [],
      };
    }
  },
};