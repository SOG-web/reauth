import type { MCPResource } from '../types';

/**
 * User Management Resource
 * Provides access to user authentication operations
 */
export const userManagementResource: MCPResource = {
  uri: 'auth://users',
  name: 'User Management',
  description: 'Access to user authentication operations including registration, login, password management, and user data retrieval',
  mimeType: 'application/json',
};

/**
 * Session Management Resource  
 * Provides access to session operations
 */
export const sessionManagementResource: MCPResource = {
  uri: 'auth://sessions',
  name: 'Session Management',
  description: 'Access to session operations including creation, validation, renewal, and termination of user sessions',
  mimeType: 'application/json',
};

/**
 * Plugin Configuration Resource
 * Provides access to plugin management and configuration
 */
export const pluginConfigurationResource: MCPResource = {
  uri: 'auth://plugins',
  name: 'Plugin Configuration',
  description: 'Access to plugin configuration and management including plugin settings, step execution, and introspection data',
  mimeType: 'application/json',
};

/**
 * Audit Logs Resource (Restricted)
 * Provides access to audit log data - typically admin-only
 */
export const auditLogsResource: MCPResource = {
  uri: 'auth://audit',
  name: 'Audit Logs',
  description: 'Access to audit log data including authentication attempts, session activities, and security events (restricted access)',
  mimeType: 'application/json',
};

/**
 * Resource Discovery Resource
 * Provides access to resource discovery and listing
 */
export const resourceDiscoveryResource: MCPResource = {
  uri: 'auth://resources',
  name: 'Resource Discovery',
  description: 'Access to resource discovery and listing functionality for available authentication resources and capabilities',
  mimeType: 'application/json',
};

/**
 * All available MCP resources
 */
export const allMCPResources: MCPResource[] = [
  userManagementResource,
  sessionManagementResource,
  pluginConfigurationResource,
  auditLogsResource,
  resourceDiscoveryResource,
];

/**
 * Get resource by URI
 */
export function getResourceByUri(uri: string): MCPResource | null {
  return allMCPResources.find(resource => resource.uri === uri) || null;
}

/**
 * Get resources accessible with specific capabilities
 */
export function getResourcesByCapabilities(capabilities: string[]): MCPResource[] {
  return allMCPResources.filter(resource => 
    capabilities.includes(resource.uri)
  );
}