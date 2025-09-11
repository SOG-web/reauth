/**
 * OAuth 2.0 Discovery Metadata tests for MCP plugin V2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReAuthEngineV2 } from '../../engine.v2';
import { createOAuthDiscoveryMetadata, createOAuthProtectedResourceMetadata, createMcpAuthMiddleware, extractBearerToken, createWWWAuthenticateHeader } from './oauth-discovery';

describe('MCP V2 OAuth Discovery', () => {
  let engine: ReAuthEngineV2;

  beforeEach(() => {
    // Mock ReAuthEngineV2 for tests
    engine = {
      getOrm: () => Promise.resolve({
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve({}),
      } as any),
    } as any;
  });

  describe('createOAuthDiscoveryMetadata', () => {
    it('should create OAuth discovery metadata handler with default options', async () => {
      const handler = createOAuthDiscoveryMetadata(engine);
      const response = await handler(new Request('http://localhost/.well-known/oauth-authorization-server'));
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      
      const metadata = await response.json();
      expect(metadata.issuer).toBe('http://localhost:3000');
      expect(metadata.scopes_supported).toContain('mcp://servers');
      expect(metadata.scopes_supported).toContain('mcp://sessions');
      expect(metadata.grant_types_supported).toContain('authorization_code');
      expect(metadata.grant_types_supported).toContain('client_credentials');
    });

    it('should create OAuth discovery metadata handler with custom options', async () => {
      const options = {
        issuer: 'https://auth.example.com',
        baseUrl: 'https://api.example.com',
        scopes: ['read', 'write', 'admin']
      };
      
      const handler = createOAuthDiscoveryMetadata(engine, options);
      const response = await handler(new Request('http://localhost/.well-known/oauth-authorization-server'));
      
      const metadata = await response.json();
      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://api.example.com/oauth/authorize');
      expect(metadata.scopes_supported).toEqual(['read', 'write', 'admin']);
    });

    it('should include proper CORS headers', async () => {
      const handler = createOAuthDiscoveryMetadata(engine);
      const response = await handler(new Request('http://localhost/.well-known/oauth-authorization-server'));
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });
  });

  describe('createOAuthProtectedResourceMetadata', () => {
    it('should create protected resource metadata handler with default options', async () => {
      const handler = createOAuthProtectedResourceMetadata(engine);
      const response = await handler(new Request('http://localhost/.well-known/oauth-protected-resource'));
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const metadata = await response.json();
      expect(metadata.resource).toBe('https://api.example.com');
      expect(metadata.scopes_supported).toContain('mcp://servers');
      expect(metadata.bearer_methods_supported).toContain('header');
      expect(metadata.bearer_methods_supported).toContain('query');
    });

    it('should create protected resource metadata handler with custom options', async () => {
      const options = {
        resource: 'https://mcp.example.com',
        authorizationServers: ['https://auth1.com', 'https://auth2.com'],
        scopes: ['mcp:read', 'mcp:write']
      };
      
      const handler = createOAuthProtectedResourceMetadata(engine, options);
      const response = await handler(new Request('http://localhost/.well-known/oauth-protected-resource'));
      
      const metadata = await response.json();
      expect(metadata.resource).toBe('https://mcp.example.com');
      expect(metadata.authorization_servers).toEqual(['https://auth1.com', 'https://auth2.com']);
      expect(metadata.scopes_supported).toEqual(['mcp:read', 'mcp:write']);
    });

    it('should include WWW-Authenticate header', async () => {
      const handler = createOAuthProtectedResourceMetadata(engine);
      const response = await handler(new Request('http://localhost/.well-known/oauth-protected-resource'));
      
      const wwwAuth = response.headers.get('WWW-Authenticate');
      expect(wwwAuth).toBeTruthy();
      expect(wwwAuth).toContain('Bearer realm="https://api.example.com"');
    });
  });

  describe('createMcpAuthMiddleware', () => {
    it('should return 401 when no token is provided', async () => {
      const mockHandler = async () => new Response('OK');
      const middleware = createMcpAuthMiddleware(engine, mockHandler);
      
      const response = await middleware(new Request('http://localhost/api'));
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('unauthorized');
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer realm="mcp"');
    });

    it('should extract token from Authorization header', async () => {
      const mockSession = {
        id: 'session1',
        server_id: 'server1',
        session_token: 'valid-token',
        capabilities: ['read', 'write'],
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };
      
      const mockServer = {
        id: 'server1',
        name: 'Test Server',
        description: 'Test MCP Server',
        capabilities: ['tools', 'resources'],
        permissions: ['read', 'write']
      };

      const mockOrm = {
        findFirst: (table: string, options: any) => {
          if (table === 'mcp_sessions') {
            return Promise.resolve(mockSession);
          }
          if (table === 'mcp_servers') {
            return Promise.resolve(mockServer);
          }
          return Promise.resolve(null);
        }
      };

      const mockEngine = {
        getOrm: () => Promise.resolve(mockOrm)
      } as any;

      let capturedSession: any;
      const mockHandler = async (req: Request, session: any) => {
        capturedSession = session;
        return new Response('OK');
      };
      
      const middleware = createMcpAuthMiddleware(mockEngine, mockHandler);
      const request = new Request('http://localhost/api', {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
      expect(capturedSession.session_token).toBe('valid-token');
      expect(capturedSession.server.name).toBe('Test Server');
      expect(capturedSession.scopes).toEqual(['read', 'write']);
    });

    it('should extract token from query parameter', async () => {
      const mockSession = {
        id: 'session1',
        server_id: 'server1',
        session_token: 'query-token',
        capabilities: ['read'],
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      const mockOrm = {
        findFirst: () => Promise.resolve(mockSession)
      };

      const mockEngine = {
        getOrm: () => Promise.resolve(mockOrm)
      } as any;

      let capturedSession: any;
      const mockHandler = async (req: Request, session: any) => {
        capturedSession = session;
        return new Response('OK');
      };
      
      const middleware = createMcpAuthMiddleware(mockEngine, mockHandler);
      const request = new Request('http://localhost/api?access_token=query-token');
      
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
      expect(capturedSession.session_token).toBe('query-token');
    });

    it('should return 401 for invalid session token', async () => {
      const mockOrm = {
        findFirst: () => Promise.resolve(null)
      };

      const mockEngine = {
        getOrm: () => Promise.resolve(mockOrm)
      } as any;

      const mockHandler = async () => new Response('OK');
      const middleware = createMcpAuthMiddleware(mockEngine, mockHandler);
      
      const request = new Request('http://localhost/api', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      
      const response = await middleware(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('unauthorized');
      expect(body.error_description).toBe('Invalid or expired access token');
    });

    it('should return 401 for expired session', async () => {
      const expiredSession = {
        id: 'session1',
        server_id: 'server1',
        session_token: 'expired-token',
        capabilities: ['read'],
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };

      const mockOrm = {
        findFirst: () => Promise.resolve(expiredSession)
      };

      const mockEngine = {
        getOrm: () => Promise.resolve(mockOrm)
      } as any;

      const mockHandler = async () => new Response('OK');
      const middleware = createMcpAuthMiddleware(mockEngine, mockHandler);
      
      const request = new Request('http://localhost/api', {
        headers: { 'Authorization': 'Bearer expired-token' }
      });
      
      const response = await middleware(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('unauthorized');
      expect(body.error_description).toBe('Access token has expired');
    });

    it('should handle internal errors gracefully', async () => {
      const mockEngine = {
        getOrm: () => Promise.reject(new Error('Database error'))
      } as any;

      const mockHandler = async () => new Response('OK');
      const middleware = createMcpAuthMiddleware(mockEngine, mockHandler);
      
      const request = new Request('http://localhost/api', {
        headers: { 'Authorization': 'Bearer some-token' }
      });
      
      const response = await middleware(request);
      
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('server_error');
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from Authorization header', () => {
      const request = new Request('http://localhost', {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      
      const token = extractBearerToken(request);
      expect(token).toBe('test-token');
    });

    it('should extract token from query parameter', () => {
      const request = new Request('http://localhost?access_token=query-token');
      
      const token = extractBearerToken(request);
      expect(token).toBe('query-token');
    });

    it('should return null when no token is present', () => {
      const request = new Request('http://localhost');
      
      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should prefer Authorization header over query parameter', () => {
      const request = new Request('http://localhost?access_token=query-token', {
        headers: { 'Authorization': 'Bearer header-token' }
      });
      
      const token = extractBearerToken(request);
      expect(token).toBe('header-token');
    });

    it('should return null for non-Bearer Authorization header', () => {
      const request = new Request('http://localhost', {
        headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
      });
      
      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });
  });

  describe('createWWWAuthenticateHeader', () => {
    it('should create basic WWW-Authenticate header', () => {
      const header = createWWWAuthenticateHeader();
      expect(header).toBe('Bearer realm="mcp"');
    });

    it('should create WWW-Authenticate header with custom realm', () => {
      const header = createWWWAuthenticateHeader('custom-realm');
      expect(header).toBe('Bearer realm="custom-realm"');
    });

    it('should create WWW-Authenticate header with error', () => {
      const header = createWWWAuthenticateHeader('mcp', 'invalid_token');
      expect(header).toBe('Bearer realm="mcp", error="invalid_token"');
    });

    it('should create WWW-Authenticate header with error and description', () => {
      const header = createWWWAuthenticateHeader('mcp', 'invalid_token', 'The token is invalid');
      expect(header).toBe('Bearer realm="mcp", error="invalid_token", error_description="The token is invalid"');
    });

    it('should create WWW-Authenticate header with scope', () => {
      const header = createWWWAuthenticateHeader('mcp', 'insufficient_scope', 'Insufficient scope', 'read write');
      expect(header).toBe('Bearer realm="mcp", error="insufficient_scope", error_description="Insufficient scope", scope="read write"');
    });

    it('should create WWW-Authenticate header with all parameters', () => {
      const header = createWWWAuthenticateHeader('api', 'invalid_request', 'Invalid request format', 'admin');
      expect(header).toBe('Bearer realm="api", error="invalid_request", error_description="Invalid request format", scope="admin"');
    });
  });
});