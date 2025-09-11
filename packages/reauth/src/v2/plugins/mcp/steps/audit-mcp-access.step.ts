import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { MCPConfigV2, MCPAuditInput } from '../types';

export const auditMcpAccessValidation = type({
  serverId: 'string',
  sessionId: 'string?',
  operation: 'string',
  resourceAccessed: 'string?',
  success: 'boolean',
  errorMessage: 'string?',
  metadata: 'object?',
});

export const auditMcpAccessOutputs = type({
  success: 'boolean',
  message: 'string',
  status: 'string',
  'auditId?': 'string',
});

export const auditMcpAccessStep: AuthStepV2<
  MCPAuditInput,
  AuthOutput,
  MCPConfigV2
> = {
  name: 'audit-mcp-access',
  description: 'Log MCP server operations for audit trail',
  validationSchema: auditMcpAccessValidation,
  outputs: auditMcpAccessOutputs,
  protocol: {
    http: {
      method: 'POST',
      codes: { 
        su: 201,    // success - audit logged
        ic: 400,    // invalid request
      },
    },
  },
  inputs: ['serverId', 'sessionId', 'operation', 'resourceAccessed', 'success', 'errorMessage', 'metadata'],
  
  async run(input, ctx): Promise<AuthOutput> {
    const { 
      serverId, 
      sessionId, 
      operation, 
      resourceAccessed, 
      success: operationSuccess, 
      errorMessage, 
      metadata 
    } = input;
    
    // Skip audit logging if disabled in config
    if (ctx.config?.auditingEnabled === false) {
      return {
        success: true,
        message: 'Audit logging is disabled',
        status: 'su',
      };
    }
    
    const orm = await ctx.engine.getOrm();
    
    try {
      // Create audit log entry
      const auditData = {
        server_id: serverId,
        session_id: sessionId || null,
        operation,
        resource_accessed: resourceAccessed || null,
        success: operationSuccess,
        error_message: errorMessage || null,
        timestamp: new Date(),
        metadata: metadata || null,
      };
      
      const auditEntry = await orm.create('mcp_audit_log', auditData);
      
      return {
        success: true,
        message: 'MCP operation logged to audit trail',
        status: 'su',
        others: {
          auditId: auditEntry.id as string,
          operation,
          timestamp: auditData.timestamp.toISOString(),
        },
      };
      
    } catch (error) {
      // Don't fail the operation if audit logging fails
      // This is a best-effort logging mechanism
      return {
        success: true,
        message: 'Audit logging failed but operation continued',
        status: 'su',
        others: {
          auditWarning: 'Failed to log to audit trail',
        },
      };
    }
  },
};