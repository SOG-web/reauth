export interface MCPServerConfig {
  name: string;
  serverKey: string;
  description?: string;
  capabilities: string[];
  permissions: string[];
  rateLimitPerMinute?: number;
  maxConcurrentSessions?: number;
}

export type MCPConfigV2 = {
  allowedServers?: MCPServerConfig[];
  defaultPermissions?: string[];
  sessionTtlMinutes?: number;
  rateLimitPerMinute?: number;
  auditingEnabled?: boolean;
  requireTLS?: boolean;
  
  // Test servers support (NO test users - this is for testing server configurations)
  testServers?: {
    enabled: boolean;
    servers: Array<{
      name: string;
      serverKey: string;
      capabilities: string[];
      permissions: string[];
      profile?: Record<string, any>;
    }>;
    environment?: 'development' | 'test' | 'all';
  };
};

// MCP Resource types
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// MCP Permission types
export type MCPPermission = 'read' | 'write' | 'admin';

// MCP Capability types
export type MCPCapability = 
  | 'auth://users'
  | 'auth://sessions' 
  | 'auth://plugins'
  | 'auth://audit'
  | 'auth://resources';

// MCP Server Authentication Input/Output types
export interface MCPServerAuthInput {
  serverName: string;
  serverKey: string;
  requestedCapabilities?: string[];
}

export interface MCPServerAuthOutput {
  success: boolean;
  message: string;
  status: string;
  serverId?: string;
  grantedCapabilities?: string[];
  sessionToken?: string;
  expiresAt?: string;
}

export interface MCPSessionInput {
  serverId: string;
  requestedCapabilities?: string[];
  sessionTtlMinutes?: number;
}

export interface MCPResourceAuthInput {
  sessionToken: string;
  resourceUri: string;
  permission: MCPPermission;
}

export interface MCPResourceAuthOutput {
  success: boolean;
  message: string;
  status: string;
  authorized: boolean;
  resourceAccess?: {
    uri: string;
    permissions: MCPPermission[];
  };
}

export interface MCPListResourcesInput {
  sessionToken: string;
}

export interface MCPListResourcesOutput {
  success: boolean;
  message: string;
  status: string;
  resources: MCPResource[];
}

export interface MCPRevokeSessionInput {
  sessionToken: string;
}

export interface MCPAuditInput {
  serverId: string;
  sessionId?: string;
  operation: string;
  resourceAccessed?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}