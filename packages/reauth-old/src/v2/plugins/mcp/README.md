# MCP (Model Context Protocol) Authentication Plugin V2

This plugin provides secure authentication and authorization for Model Context Protocol (MCP) servers, enabling AI agents and tools to securely interact with ReAuth's authentication system.

## Overview

The MCP plugin enables:
- **MCP Server Registration**: Secure registration and authentication of MCP servers
- **Session Management**: Time-limited sessions with capability-based access control
- **Resource Authorization**: Granular permissions for authentication operations
- **Audit Logging**: Complete audit trail of MCP server activities
- **Rate Limiting**: Protection against abuse and DoS attacks

## Features

### 🔐 Security
- Server keys are SHA-256 hashed at rest
- Cryptographically secure session tokens
- Time-limited sessions with configurable TTL
- Granular resource-based permissions
- Complete audit trail with metadata support

### 🚀 Performance
- Fast server authentication with indexed key lookups
- Efficient resource authorization checks
- Minimal overhead for MCP protocol handling
- Optimized audit logging that doesn't impact performance

### 🔧 Configuration
- Flexible server capability and permission configuration
- Configurable session TTL and rate limiting
- Support for test servers in development environments
- Optional TLS requirement enforcement

## Quick Start

### Installation

```typescript
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { mcpPluginV2 } from '@re-auth/reauth/v2';

const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [mcpPluginV2],
});
```

### Basic Configuration

```typescript
import { createAuthPluginV2 } from '@re-auth/reauth/v2';

const mcpPlugin = createAuthPluginV2(mcpPluginV2, {
  config: {
    sessionTtlMinutes: 60,
    auditingEnabled: true,
    requireTLS: true,
    allowedServers: [
      {
        name: 'ai-assistant',
        serverKey: 'your-secure-server-key',
        capabilities: ['auth://users', 'auth://sessions'],
        permissions: ['read', 'write'],
      },
    ],
  },
});
```

## Authentication Flow

### 1. Server Authentication

```typescript
const authResult = await engine.executeStep('mcp', 'authenticate-mcp-server', {
  serverName: 'ai-assistant',
  serverKey: 'your-secure-server-key',
  requestedCapabilities: ['auth://users'],
});

if (authResult.success) {
  console.log('Server authenticated:', authResult.serverId);
}
```

### 2. Session Creation

```typescript
const sessionResult = await engine.executeStep('mcp', 'create-mcp-session', {
  serverId: authResult.serverId,
  requestedCapabilities: ['auth://users'],
  sessionTtlMinutes: 30,
});

const sessionToken = sessionResult.token;
```

### 3. Resource Authorization

```typescript
const authzResult = await engine.executeStep('mcp', 'authorize-resource', {
  sessionToken,
  resourceUri: 'auth://users',
  permission: 'read',
});

if (authzResult.authorized) {
  // Proceed with user operations
}
```

### 4. Resource Discovery

```typescript
const resourcesResult = await engine.executeStep('mcp', 'list-resources', {
  sessionToken,
});

console.log('Available resources:', resourcesResult.resources);
```

## Available Resources

The MCP plugin provides access to these authentication resources:

| Resource URI | Description | Permissions |
|--------------|-------------|-------------|
| `auth://users` | User management operations | read, write, admin |
| `auth://sessions` | Session operations | read, write, admin |
| `auth://plugins` | Plugin configuration | read, write, admin |
| `auth://audit` | Audit logs (restricted) | admin only |
| `auth://resources` | Resource discovery | read, write, admin |

## Configuration Options

### MCPConfigV2

```typescript
interface MCPConfigV2 {
  // Server management
  allowedServers?: MCPServerConfig[];
  defaultPermissions?: string[];
  
  // Session configuration
  sessionTtlMinutes?: number; // Default: 60
  rateLimitPerMinute?: number; // Default: 100
  
  // Security settings
  auditingEnabled?: boolean; // Default: true
  requireTLS?: boolean; // Default: true
  
  // Development/testing
  testServers?: {
    enabled: boolean;
    servers: TestServerConfig[];
    environment?: 'development' | 'test' | 'all';
  };
}
```

### Server Configuration

```typescript
interface MCPServerConfig {
  name: string; // Unique server identifier
  serverKey: string; // Secure authentication key
  description?: string;
  capabilities: string[]; // Resources the server can access
  permissions: string[]; // Permission levels (read/write/admin)
  rateLimitPerMinute?: number; // Override default rate limit
  maxConcurrentSessions?: number; // Max active sessions
}
```

## Steps Reference

### authenticate-mcp-server

Authenticates an MCP server using credentials.

**Input:**
```typescript
{
  serverName: string;
  serverKey: string;
  requestedCapabilities?: string[];
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  status: string;
  serverId?: string;
  grantedCapabilities?: string[];
}
```

### create-mcp-session

Creates an authenticated session for an MCP server.

**Input:**
```typescript
{
  serverId: string;
  requestedCapabilities?: string[];
  sessionTtlMinutes?: number;
}
```

**Output:**
```typescript
{
  success: boolean;
  token?: string;
  sessionId?: string;
  expiresAt?: string;
  grantedCapabilities?: string[];
}
```

### authorize-resource

Checks if an MCP server has permission to access a resource.

**Input:**
```typescript
{
  sessionToken: string;
  resourceUri: string;
  permission: 'read' | 'write' | 'admin';
}
```

**Output:**
```typescript
{
  success: boolean;
  authorized: boolean;
  resourceAccess?: {
    uri: string;
    permissions: string[];
  };
}
```

### list-resources

Lists available resources for an authenticated MCP server.

**Input:**
```typescript
{
  sessionToken: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  resources: Array<{
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
  }>;
}
```

### revoke-mcp-session

Revokes an active MCP server session.

**Input:**
```typescript
{
  sessionToken: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

### audit-mcp-access

Logs MCP server operations for audit purposes.

**Input:**
```typescript
{
  serverId: string;
  operation: string;
  success: boolean;
  metadata?: Record<string, any>;
}
```

## Database Schema

The plugin creates three tables:

### mcp_servers
- `id` - Unique server identifier
- `name` - Server name (unique)
- `server_key_hash` - Hashed server key
- `capabilities` - JSON array of allowed capabilities
- `permissions` - JSON array of permissions
- `is_active` - Server status
- `rate_limit_per_minute` - Rate limiting configuration
- `max_concurrent_sessions` - Session limit

### mcp_sessions
- `id` - Session identifier
- `server_id` - Reference to MCP server
- `session_token_hash` - Hashed session token
- `capabilities_granted` - JSON array of granted capabilities
- `expires_at` - Session expiration time
- `last_used_at` - Last activity timestamp

### mcp_audit_log
- `id` - Log entry identifier
- `server_id` - Reference to MCP server
- `operation` - Operation performed
- `success` - Operation success status
- `timestamp` - When operation occurred
- `metadata` - Additional operation data

## Security Considerations

### Key Management
- Server keys should be long, random, and unique
- Keys are hashed using SHA-256 before storage
- Use secure key generation and distribution

### Session Security
- Sessions use cryptographically secure tokens
- Tokens are time-limited and automatically expire
- Session tokens are hashed for storage

### Permission Model
- Follow principle of least privilege
- Grant only necessary capabilities and permissions
- Regularly audit server access patterns

### Network Security
- Enable `requireTLS: true` in production
- Use HTTPS for all MCP communications
- Implement proper firewall rules

## Monitoring and Observability

### Audit Logging
- All MCP operations are logged when auditing is enabled
- Logs include server ID, operation, success status, and metadata
- Use audit logs for security monitoring and compliance

### Rate Limiting
- Configure appropriate rate limits per server
- Monitor for unusual access patterns
- Implement alerting for rate limit violations

### Session Monitoring
- Track active session counts
- Monitor session creation and expiration patterns
- Alert on suspicious session activity

## Development and Testing

### Test Servers

For development environments, you can configure test servers:

```typescript
{
  testServers: {
    enabled: true,
    environment: 'development',
    servers: [
      {
        name: 'dev-ai-assistant',
        serverKey: 'dev-test-key-123',
        capabilities: ['auth://users'],
        permissions: ['read'],
      },
    ],
  },
}
```

### Example Integration

```typescript
// MCP server authentication flow
async function authenticateMCPServer() {
  // 1. Authenticate server
  const auth = await engine.executeStep('mcp', 'authenticate-mcp-server', {
    serverName: 'ai-assistant',
    serverKey: process.env.MCP_SERVER_KEY,
    requestedCapabilities: ['auth://users', 'auth://sessions'],
  });

  if (!auth.success) {
    throw new Error('MCP server authentication failed');
  }

  // 2. Create session
  const session = await engine.executeStep('mcp', 'create-mcp-session', {
    serverId: auth.serverId,
    sessionTtlMinutes: 60,
  });

  // 3. Use session for operations
  const resources = await engine.executeStep('mcp', 'list-resources', {
    sessionToken: session.token,
  });

  return { session: session.token, resources: resources.resources };
}
```

## MCP Protocol Compliance

This plugin follows the [Model Context Protocol specification](https://modelcontextprotocol.io/) for:
- Server-to-server communication patterns
- Resource discovery and access control
- Capability negotiation
- Error handling and status codes

## Troubleshooting

### Common Issues

1. **Authentication Failure**
   - Verify server name and key are correct
   - Check that server is active in configuration
   - Ensure server key hasn't been rotated

2. **Permission Denied**
   - Verify server has required capabilities
   - Check permission levels (read/write/admin)
   - Ensure resource URI is valid

3. **Session Expired**
   - Check session TTL configuration
   - Implement automatic session renewal
   - Handle session expiration gracefully

4. **Rate Limiting**
   - Monitor request patterns
   - Adjust rate limits if necessary
   - Implement exponential backoff

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
{
  auditingEnabled: true, // Enable audit logging
  // Other config options
}
```

Check audit logs for detailed operation information and error messages.