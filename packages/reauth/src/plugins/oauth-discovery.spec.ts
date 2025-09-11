import { describe, it, expect, beforeEach } from 'vitest';
import {
  oAuthDiscoveryMetadata,
  oAuthProtectedResourceMetadata,
  withMcpAuth,
  extractBearerToken,
  createWWWAuthenticateHeader,
  type OAuthDiscoveryMetadata,
  type OAuthProtectedResourceMetadata,
} from './oauth-discovery';
import { ReAuthEngine } from '../auth-engine';
import { testSecurityService } from '../utils/testing-utilities';

describe('OAuth Discovery Metadata', () => {
  let mockEngine: ReAuthEngine;

  beforeEach(() => {
    // Create a minimal mock ReAuth engine for testing
    mockEngine = {
      getOrm: async () => ({
        findFirst: async (table: string, options: any) => {
          if (table === 'mcp_sessions') {
            // Mock valid session
            return {
              id: 'session-123',
              server_id: 'server-456',
              session_token: 'valid-token',
              capabilities: ['read', 'write'],
              expires_at: new Date(Date.now() + 3600000), // 1 hour from now
              created_at: new Date(),
            };
          }
          if (table === 'mcp_servers') {
            // Mock server info
            return {
              id: 'server-456',
              name: 'Test MCP Server',
              description: 'Test server for OAuth',
              capabilities: ['auth://users', 'auth://sessions'],
              permissions: ['read', 'write'],
            };
          }
          return null;
        },
      }),
    } as any;
  });

  describe('oAuthDiscoveryMetadata', () => {
    it('should return valid OAuth discovery metadata', async () => {
      const handler = oAuthDiscoveryMetadata(mockEngine, {
        issuer: 'https://auth.example.com',
        baseUrl: 'https://auth.example.com',
        scopes: ['openid', 'profile', 'auth://users'],
      });

      const request = new Request('https://auth.example.com/.well-known/oauth-authorization-server');
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');

      const metadata: OAuthDiscoveryMetadata = await response.json();
      
      expect(metadata.issuer).toBe('https://auth.example.com');
      expect(metadata.authorization_endpoint).toBe('https://auth.example.com/oauth/authorize');
      expect(metadata.token_endpoint).toBe('https://auth.example.com/oauth/token');
      expect(metadata.scopes_supported).toContain('openid');
      expect(metadata.scopes_supported).toContain('auth://users');
      expect(metadata.response_types_supported).toContain('code');
      expect(metadata.grant_types_supported).toContain('authorization_code');
    });

    it('should use default values when options are minimal', async () => {
      const handler = oAuthDiscoveryMetadata(mockEngine, {
        issuer: 'http://localhost:3000',
      });

      const request = new Request('http://localhost:3000/.well-known/oauth-authorization-server');
      const response = await handler(request);

      const metadata: OAuthDiscoveryMetadata = await response.json();
      
      expect(metadata.issuer).toBe('http://localhost:3000');
      expect(metadata.scopes_supported).toContain('auth://resources');
      expect(metadata.scopes_supported).toContain('openid');
    });
  });

  describe('oAuthProtectedResourceMetadata', () => {
    it('should return valid protected resource metadata', async () => {
      const handler = oAuthProtectedResourceMetadata(mockEngine, {
        resource: 'https://api.example.com',
        authorizationServers: ['https://auth.example.com'],
        scopes: ['read', 'write', 'auth://sessions'],
      });

      const request = new Request('https://api.example.com/.well-known/oauth-protected-resource');
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer realm="https://api.example.com"');

      const metadata: OAuthProtectedResourceMetadata = await response.json();
      
      expect(metadata.resource).toBe('https://api.example.com');
      expect(metadata.authorization_servers).toContain('https://auth.example.com');
      expect(metadata.scopes_supported).toContain('read');
      expect(metadata.scopes_supported).toContain('auth://sessions');
      expect(metadata.bearer_methods_supported).toContain('header');
    });
  });

  describe('withMcpAuth', () => {
    it('should authenticate valid bearer token', async () => {
      const mockHandler = async (request: Request, session: any) => {
        expect(session.id).toBe('session-123');
        expect(session.server?.name).toBe('Test MCP Server');
        expect(session.scopes).toContain('read');
        
        return new Response(JSON.stringify({ success: true, user_id: session.user_id }), {
          headers: { 'Content-Type': 'application/json' }
        });
      };

      const authenticatedHandler = withMcpAuth(mockEngine, mockHandler);
      
      const request = new Request('https://api.example.com/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      const response = await authenticatedHandler(request);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should reject requests without token', async () => {
      const mockHandler = async () => {
        throw new Error('Should not be called');
      };

      const authenticatedHandler = withMcpAuth(mockEngine, mockHandler);
      
      const request = new Request('https://api.example.com/test');
      const response = await authenticatedHandler(request);
      
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer realm="mcp"');
      
      const error = await response.json();
      expect(error.error).toBe('unauthorized');
    });

    it('should support token from query parameter', async () => {
      const mockHandler = async (request: Request, session: any) => {
        return new Response(JSON.stringify({ authenticated: true }));
      };

      const authenticatedHandler = withMcpAuth(mockEngine, mockHandler);
      
      const request = new Request('https://api.example.com/test?access_token=valid-token');
      const response = await authenticatedHandler(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from Authorization header', () => {
      const request = new Request('https://example.com', {
        headers: { 'Authorization': 'Bearer test-token-123' },
      });
      
      const token = extractBearerToken(request);
      expect(token).toBe('test-token-123');
    });

    it('should extract token from query parameter', () => {
      const request = new Request('https://example.com?access_token=query-token-456');
      
      const token = extractBearerToken(request);
      expect(token).toBe('query-token-456');
    });

    it('should prefer Authorization header over query parameter', () => {
      const request = new Request('https://example.com?access_token=query-token', {
        headers: { 'Authorization': 'Bearer header-token' },
      });
      
      const token = extractBearerToken(request);
      expect(token).toBe('header-token');
    });

    it('should return null when no token is found', () => {
      const request = new Request('https://example.com');
      
      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });
  });

  describe('createWWWAuthenticateHeader', () => {
    it('should create basic WWW-Authenticate header', () => {
      const header = createWWWAuthenticateHeader('api');
      expect(header).toBe('Bearer realm="api"');
    });

    it('should include error information', () => {
      const header = createWWWAuthenticateHeader('api', 'invalid_token', 'The token is expired');
      expect(header).toBe('Bearer realm="api", error="invalid_token", error_description="The token is expired"');
    });

    it('should include scope information', () => {
      const header = createWWWAuthenticateHeader('api', undefined, undefined, 'read write');
      expect(header).toBe('Bearer realm="api", scope="read write"');
    });

    it('should include all parameters', () => {
      const header = createWWWAuthenticateHeader(
        'mcp',
        'insufficient_scope',
        'Requires admin scope',
        'admin'
      );
      expect(header).toBe('Bearer realm="mcp", error="insufficient_scope", error_description="Requires admin scope", scope="admin"');
    });
  });
});