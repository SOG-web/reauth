import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { MCPConfigV2, MCPResourceAuthInput, MCPResourceAuthOutput, MCPPermission } from '../types';
import { 
  hashSessionToken, 
  isSessionExpired, 
  isValidResourceUri,
  isValidPermissionForResource,
  hasCapability,
  extractResourceName 
} from '../utils';

export const authorizeResourceValidation = type({
  sessionToken: 'string',
  resourceUri: 'string',
  permission: '"read" | "write" | "admin"',
});

export const authorizeResourceOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  authorized: 'boolean',
  'resourceAccess?': {
    uri: 'string',
    permissions: 'string[]',
  },
});

export const authorizeResourceStep: AuthStepV2<
  MCPResourceAuthInput,
  MCPResourceAuthOutput,
  MCPConfigV2
> = {
  name: 'authorize-resource',
  description: 'Check MCP server permissions for accessing authentication resources',
  validationSchema: authorizeResourceValidation,
  outputs: authorizeResourceOutputs,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        su: 200,    // success - authorized
        unf: 401,   // unauthorized - invalid session
        ip: 403,    // insufficient permissions
        ic: 400,    // invalid request
        eq: 410,    // session expired
      },
      auth: true, // This step requires authentication
    },
  },
  inputs: ['sessionToken', 'resourceUri', 'permission'],
  
  async run(input, ctx): Promise<MCPResourceAuthOutput> {
    const { sessionToken, resourceUri, permission } = input;
    const orm = await ctx.engine.getOrm();
    
    try {
      // Validate resource URI format
      if (!isValidResourceUri(resourceUri)) {
        return {
          success: false,
          message: 'Invalid resource URI format',
          status: 'ic',
          authorized: false,
        };
      }
      
      // Validate permission for resource type
      if (!isValidPermissionForResource(resourceUri, permission)) {
        return {
          success: false,
          message: `Permission '${permission}' not valid for resource '${resourceUri}'`,
          status: 'ic',
          authorized: false,
        };
      }
      
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
          authorized: false,
        };
      }
      
      // Check if session is expired
      if (isSessionExpired(new Date(session.expires_at as string))) {
        return {
          success: false,
          message: 'Session has expired',
          status: 'eq',
          authorized: false,
        };
      }
      
      // Check if server has the required capability for this resource
      const resourceName = extractResourceName(resourceUri);
      const requiredCapability = resourceUri; // e.g., 'auth://users'
      const grantedCapabilities = (session.capabilities_granted as string[]) || [];
      
      if (!hasCapability(grantedCapabilities, requiredCapability)) {
        return {
          success: false,
          message: `Server does not have capability for resource '${resourceUri}'`,
          status: 'ip',
          authorized: false,
        };
      }
      
      // Get server to check permissions
      const server = await orm.findFirst('mcp_servers', {
        where: (b: any) => b('id', '=', session.server_id as string),
      });
      
      if (!server || !(server.is_active as boolean)) {
        return {
          success: false,
          message: 'Server not found or inactive',
          status: 'unf',
          authorized: false,
        };
      }
      
      // Check server permissions
      const serverPermissions = (server.permissions as string[]) || [];
      const hasPermission = serverPermissions.includes(permission) || 
                           serverPermissions.includes('admin');
      
      if (!hasPermission) {
        return {
          success: false,
          message: `Server does not have '${permission}' permission`,
          status: 'ip',
          authorized: false,
        };
      }
      
      // Update session last used time
      await orm.updateMany('mcp_sessions', {
        where: (b: any) => b('id', '=', session.id),
        set: {
          last_used_at: new Date(),
        },
      });
      
      // Determine available permissions for this resource
      const availablePermissions = serverPermissions.filter(perm =>
        isValidPermissionForResource(resourceUri, perm as any)
      ) as MCPPermission[];
      
      return {
        success: true,
        message: 'Resource access authorized',
        status: 'su',
        authorized: true,
        resourceAccess: {
          uri: resourceUri,
          permissions: availablePermissions,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Resource authorization failed due to system error',
        status: 'ic',
        authorized: false,
      };
    }
  },
};