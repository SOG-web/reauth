/**
 * OAuth 2.0 Discovery Metadata utilities for MCP and other plugins
 * Implements RFC 8414 (OAuth 2.0 Authorization Server Metadata)
 * and RFC 8693 (OAuth 2.0 Token Exchange)
 */

import type { ReAuthEngine } from '../auth-engine';

export interface OAuthDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  service_documentation?: string;
  ui_locales_supported?: string[];
}

export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
}

/**
 * Creates an OAuth 2.0 Authorization Server Metadata endpoint handler
 * Per RFC 8414: https://tools.ietf.org/html/rfc8414
 */
export function oAuthDiscoveryMetadata(
  auth: ReAuthEngine,
  options: {
    issuer: string;
    baseUrl?: string;
    scopes?: string[];
  } = { issuer: 'http://localhost:3000' }
) {
  return async function oAuthDiscoveryHandler(request: Request): Promise<Response> {
    const baseUrl = options.baseUrl || options.issuer;
    
    const metadata: OAuthDiscoveryMetadata = {
      issuer: options.issuer,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      scopes_supported: options.scopes || [
        'openid',
        'profile', 
        'email',
        'auth://users',
        'auth://sessions',
        'auth://plugins',
        'auth://audit',
        'auth://resources'
      ],
      response_types_supported: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token'
      ],
      grant_types_supported: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code'
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'private_key_jwt',
        'client_secret_jwt'
      ],
      service_documentation: `${baseUrl}/docs/oauth`,
      ui_locales_supported: ['en']
    };

    return new Response(JSON.stringify(metadata, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  };
}

/**
 * Creates an OAuth 2.0 Protected Resource Metadata endpoint handler
 * Per RFC 8693: https://tools.ietf.org/html/rfc8693
 */
export function oAuthProtectedResourceMetadata(
  auth: ReAuthEngine,
  options: {
    resource: string;
    authorizationServers?: string[];
    scopes?: string[];
  } = { resource: 'https://api.example.com' }
) {
  return async function protectedResourceHandler(request: Request): Promise<Response> {
    const metadata: OAuthProtectedResourceMetadata = {
      resource: options.resource,
      authorization_servers: options.authorizationServers || [
        'https://auth.example.com'
      ],
      scopes_supported: options.scopes || [
        'read',
        'write', 
        'admin',
        'auth://users',
        'auth://sessions',
        'auth://plugins',
        'auth://audit',
        'auth://resources'
      ],
      bearer_methods_supported: [
        'header',
        'body',
        'query'
      ],
      resource_documentation: `${options.resource}/docs`
    };

    return new Response(JSON.stringify(metadata, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'WWW-Authenticate': `Bearer realm="${options.resource}", scope="${(options.scopes || []).join(' ')}"`
      }
    });
  };
}

/**
 * OAuth-style authentication middleware for MCP handlers
 * Validates session tokens and provides session context
 */
export function withMcpAuth<T = any>(
  auth: ReAuthEngine,
  handler: (request: Request, session: T) => Promise<Response>
) {
  return async function authenticatedHandler(request: Request): Promise<Response> {
    try {
      // Extract token from Authorization header or query parameter
      const authHeader = request.headers.get('Authorization');
      let token: string | null = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        // Fallback to query parameter for MCP compatibility
        const url = new URL(request.url);
        token = url.searchParams.get('access_token');
      }

      if (!token) {
        return new Response(JSON.stringify({
          error: 'unauthorized',
          error_description: 'Missing or invalid access token'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="mcp", error="invalid_token"'
          }
        });
      }

      // Validate token using ReAuth engine
      const orm = await auth.getOrm();
      
      // Look for MCP session with this token
      const session = await orm.findFirst('mcp_sessions', {
        where: (b: any) => b('session_token', '=', token),
      });

      if (!session) {
        return new Response(JSON.stringify({
          error: 'unauthorized', 
          error_description: 'Invalid or expired access token'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="mcp", error="invalid_token"'
          }
        });
      }

      // Check if session is expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({
          error: 'unauthorized',
          error_description: 'Access token has expired'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="mcp", error="invalid_token"'
          }
        });
      }

      // Get server information for additional context
      const server = await orm.findFirst('mcp_servers', {
        where: (b: any) => b('id', '=', session.server_id),
      });

      // Create enhanced session object with server info
      const enhancedSession = {
        ...session,
        server: server ? {
          id: server.id,
          name: server.name,
          description: server.description,
          capabilities: server.capabilities,
          permissions: server.permissions
        } : null,
        scopes: session.capabilities || [],
        user_id: session.server_id // For compatibility with OAuth session format
      };

      // Call the handler with authenticated session
      return await handler(request, enhancedSession as T);

    } catch (error) {
      console.error('MCP auth error:', error);
      
      return new Response(JSON.stringify({
        error: 'server_error',
        error_description: 'Internal authentication error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };
}

/**
 * Extract bearer token from request headers or query parameters
 */
export function extractBearerToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fallback to query parameter
  const url = new URL(request.url);
  return url.searchParams.get('access_token');
}

/**
 * Create WWW-Authenticate header for OAuth errors
 */
export function createWWWAuthenticateHeader(
  realm: string = 'api',
  error?: string,
  errorDescription?: string,
  scope?: string
): string {
  let header = `Bearer realm="${realm}"`;
  
  if (error) {
    header += `, error="${error}"`;
  }
  
  if (errorDescription) {
    header += `, error_description="${errorDescription}"`;
  }
  
  if (scope) {
    header += `, scope="${scope}"`;
  }
  
  return header;
}