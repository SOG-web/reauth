import crypto from 'node:crypto';
import type { MCPResource, MCPPermission, MCPConfigV2 } from './types';
import type { OrmLike } from '../../types.v2';

/**
 * Hash an MCP server key using SHA-256
 */
export function hashServerKey(serverKey: string): string {
  return crypto.createHash('sha256').update(serverKey, 'utf8').digest('hex');
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Verify an MCP server key against a hash
 */
export function verifyServerKey(serverKey: string, hash: string): boolean {
  const keyHash = hashServerKey(serverKey);
  return crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(hash));
}

/**
 * Check if an MCP session is expired
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculate session expiration time
 */
export function calculateSessionExpiry(ttlMinutes: number = 60): Date {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
  return expiresAt;
}

/**
 * Default MCP resources available for authentication operations
 */
export function getDefaultMCPResources(): MCPResource[] {
  return [
    {
      uri: 'auth://users',
      name: 'User Management',
      description: 'Access to user authentication operations',
      mimeType: 'application/json',
    },
    {
      uri: 'auth://sessions',
      name: 'Session Management',
      description: 'Access to session operations',
      mimeType: 'application/json',
    },
    {
      uri: 'auth://plugins',
      name: 'Plugin Configuration',
      description: 'Access to plugin configuration and management',
      mimeType: 'application/json',
    },
    {
      uri: 'auth://audit',
      name: 'Audit Logs',
      description: 'Access to audit log data (restricted)',
      mimeType: 'application/json',
    },
    {
      uri: 'auth://resources',
      name: 'Resource Discovery',
      description: 'Access to resource discovery and listing',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Check if a permission is valid for a given resource
 */
export function isValidPermissionForResource(
  resourceUri: string,
  permission: MCPPermission,
): boolean {
  // All resources support read access
  if (permission === 'read') return true;
  
  // Audit logs are read-only except for admins
  if (resourceUri === 'auth://audit') {
    return permission === 'admin';
  }
  
  // Other resources support write and admin
  return ['write', 'admin'].includes(permission);
}

/**
 * Get the permissions required for an operation
 */
export function getRequiredPermission(operation: string): MCPPermission {
  const readOperations = ['list', 'get', 'view', 'check'];
  const writeOperations = ['create', 'update', 'modify', 'change'];
  
  if (readOperations.some(op => operation.toLowerCase().includes(op))) {
    return 'read';
  }
  if (writeOperations.some(op => operation.toLowerCase().includes(op))) {
    return 'write';
  }
  
  // Default to admin for unknown operations
  return 'admin';
}

/**
 * Find test server configuration (for testing environments only)
 */
export function findTestServer(
  serverName: string,
  serverKey: string,
  config: MCPConfigV2,
): {
  name: string;
  capabilities: string[];
  permissions: string[];
  profile?: Record<string, any>;
} | null {
  if (!config.testServers?.enabled) return null;
  
  const env = process.env.NODE_ENV || 'development';
  const allowedEnvs = config.testServers.environment || 'development';
  
  if (allowedEnvs !== 'all' && env !== allowedEnvs) return null;
  
  return config.testServers.servers.find(
    (server) => server.name === serverName && server.serverKey === serverKey,
  ) || null;
}

/**
 * Cleanup expired MCP sessions
 */
export async function cleanupExpiredSessions(orm: OrmLike): Promise<void> {
  const now = new Date();
  await orm.deleteMany('mcp_sessions', {
    where: (b: any) => b('expires_at', '<', now),
  });
}

/**
 * Get rate limiting key for an MCP server
 */
export function getRateLimitKey(serverId: string): string {
  return `mcp_rate_limit:${serverId}`;
}

/**
 * Check if capability is granted in session
 */
export function hasCapability(
  grantedCapabilities: string[],
  requiredCapability: string,
): boolean {
  return grantedCapabilities.includes(requiredCapability);
}

/**
 * Validate MCP resource URI format
 */
export function isValidResourceUri(uri: string): boolean {
  // MCP resource URIs should follow auth://resource pattern
  return /^auth:\/\/[a-z][a-z0-9]*$/i.test(uri);
}

/**
 * Extract resource name from URI
 */
export function extractResourceName(uri: string): string {
  const match = uri.match(/^auth:\/\/(.+)$/);
  return match ? match[1] : '';
}