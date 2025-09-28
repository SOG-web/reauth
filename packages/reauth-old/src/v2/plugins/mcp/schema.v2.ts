import { column, idColumn, table } from 'fumadb/schema';
import type { ReauthSchemaPlugin } from '../../../types';

// MCP servers registered with the authentication system
export const mcpServers = table('mcp_servers', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  name: column('name', 'varchar(255)'),
  server_key_hash: column('server_key_hash', 'varchar(255)'),
  description: column('description', 'varchar(500)').nullable(),
  capabilities: column('capabilities', 'json').defaultTo([]),
  permissions: column('permissions', 'json').defaultTo([]),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  updated_at: column('updated_at', 'timestamp').defaultTo$('now'),
  is_active: column('is_active', 'bool').defaultTo(true),
  rate_limit_per_minute: column('rate_limit_per_minute', 'integer').defaultTo(60),
  max_concurrent_sessions: column('max_concurrent_sessions', 'integer').defaultTo(10),
}).unique('mcp_servers_name_uk', ['name']);

// MCP server sessions for authenticated access
export const mcpSessions = table('mcp_sessions', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  server_id: column('server_id', 'varchar(255)'),
  session_token_hash: column('session_token_hash', 'varchar(255)'),
  capabilities_granted: column('capabilities_granted', 'json').defaultTo([]),
  expires_at: column('expires_at', 'timestamp'),
  created_at: column('created_at', 'timestamp').defaultTo$('now'),
  last_used_at: column('last_used_at', 'timestamp').defaultTo$('now'),
});

// Audit log for MCP server operations
export const mcpAuditLog = table('mcp_audit_log', {
  id: idColumn('id', 'varchar(255)').defaultTo$('auto'),
  server_id: column('server_id', 'varchar(255)'),
  session_id: column('session_id', 'varchar(255)').nullable(),
  operation: column('operation', 'varchar(255)'),
  resource_accessed: column('resource_accessed', 'varchar(255)').nullable(),
  success: column('success', 'bool'),
  error_message: column('error_message', 'varchar(1000)').nullable(),
  timestamp: column('timestamp', 'timestamp').defaultTo$('now'),
  metadata: column('metadata', 'json').nullable(),
});

export const mcpSchemaV2: ReauthSchemaPlugin = {
  tables: {
    mcp_servers: mcpServers,
    mcp_sessions: mcpSessions,
    mcp_audit_log: mcpAuditLog,
  },
  relations: {},
};