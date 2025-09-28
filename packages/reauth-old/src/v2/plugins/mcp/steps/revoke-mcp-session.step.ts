import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { MCPConfigV2, MCPRevokeSessionInput } from '../types';
import { hashSessionToken } from '../utils';

export const revokeSessionValidation = type({
  sessionToken: 'string',
});

export const revokeSessionOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
});

export const revokeMcpSessionStep: AuthStepV2<
  MCPRevokeSessionInput,
  AuthOutput,
  MCPConfigV2
> = {
  name: 'revoke-mcp-session',
  description: 'Revoke an active MCP server session',
  validationSchema: revokeSessionValidation,
  outputs: revokeSessionOutputs,
  protocol: {
    http: {
      method: 'DELETE',
      codes: { 
        su: 200,    // success - session revoked
        unf: 401,   // unauthorized - invalid session
        ic: 400,    // invalid request
      },
      auth: true, // This step requires authentication
    },
  },
  inputs: ['sessionToken'],
  
  async run(input, ctx): Promise<AuthOutput> {
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
          message: 'Session not found or already revoked',
          status: 'unf',
        };
      }
      
      // Delete the session
      await orm.deleteMany('mcp_sessions', {
        where: (b: any) => b('id', '=', session.id),
      });
      
      return {
        success: true,
        message: 'MCP session revoked successfully',
        status: 'su',
        others: {
          sessionId: session.id as string,
          serverId: session.server_id as string,
          revokedAt: new Date().toISOString(),
        },
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to revoke session due to system error',
        status: 'ic',
      };
    }
  },
};