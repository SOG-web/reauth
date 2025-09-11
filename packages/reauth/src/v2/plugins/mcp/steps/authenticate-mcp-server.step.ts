import { type } from 'arktype';
import type { AuthStepV2 } from '../../../types.v2';
import type { MCPConfigV2, MCPServerAuthInput, MCPServerAuthOutput } from '../types';
import { hashServerKey, verifyServerKey, findTestServer } from '../utils';

export const authenticateMcpServerValidation = type({
  serverName: 'string',
  serverKey: 'string',
  requestedCapabilities: 'string[]?',
});

export const authenticateMcpServerOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'serverId?': 'string',
  'grantedCapabilities?': 'string[]',
  'sessionToken?': 'string',
  'expiresAt?': 'string',
});

export const authenticateMcpServerStep: AuthStepV2<
  MCPServerAuthInput,
  MCPServerAuthOutput,
  MCPConfigV2
> = {
  name: 'authenticate-mcp-server',
  description: 'Authenticate an MCP server using server credentials',
  validationSchema: authenticateMcpServerValidation,
  outputs: authenticateMcpServerOutputs,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        su: 200,    // success - server authenticated
        unf: 401,   // unauthorized - invalid credentials
        ip: 403,    // invalid permissions - server not allowed
        ic: 400,    // invalid configuration - bad request
      },
    },
  },
  inputs: ['serverName', 'serverKey', 'requestedCapabilities'],
  
  async run(input, ctx): Promise<MCPServerAuthOutput> {
    const { serverName, serverKey, requestedCapabilities = [] } = input;
    const orm = await ctx.engine.getOrm();
    
    try {
      // Check for test server first (dev/test environments)
      const testServer = findTestServer(serverName, serverKey, ctx.config || {});
      if (testServer) {
        return {
          success: true,
          message: 'Test MCP server authenticated successfully',
          status: 'su',
          serverId: `test-${serverName}`,
          grantedCapabilities: testServer.capabilities,
          // Note: Test servers don't get real session tokens in this step
        };
      }
      
      // Look up server by name
      const server = await orm.findFirst('mcp_servers', {
        where: (b: any) => b.and(
          b('name', '=', serverName),
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
      
      // Verify server key
      const keyValid = verifyServerKey(serverKey, server.server_key_hash as string);
      if (!keyValid) {
        return {
          success: false,
          message: 'Invalid server credentials',
          status: 'unf',
        };
      }
      
      // Check server permissions against requested capabilities
      const serverCapabilities = (server.capabilities as string[]) || [];
      const allowedCapabilities = requestedCapabilities.filter(cap => 
        serverCapabilities.includes(cap)
      );
      
      if (requestedCapabilities.length > 0 && allowedCapabilities.length === 0) {
        return {
          success: false,
          message: 'No requested capabilities are permitted for this server',
          status: 'ip',
        };
      }
      
      // Update server last used timestamp
      await orm.updateMany('mcp_servers', {
        where: (b: any) => b('id', '=', server.id),
        set: {
          updated_at: new Date(),
        },
      });
      
      return {
        success: true,
        message: 'MCP server authenticated successfully',
        status: 'su',
        serverId: server.id as string,
        grantedCapabilities: allowedCapabilities.length > 0 ? allowedCapabilities : serverCapabilities,
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Server authentication failed due to system error',
        status: 'ic',
      };
    }
  },
};