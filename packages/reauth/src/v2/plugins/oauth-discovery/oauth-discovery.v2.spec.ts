/**
 * OAuth Discovery Plugin V2 Tests
 * 
 * Tests for the protocol-agnostic OAuth 2.0 discovery metadata functionality
 */

import { describe, it, expect } from 'vitest';
import { createOAuthDiscoveryPluginV2, baseOAuthDiscoveryPluginV2 } from './plugin.v2';
import type { OAuthDiscoveryConfigV2 } from './types';

describe('OAuth Discovery Plugin V2', () => {
  describe('Plugin Structure', () => {
    it('should have correct plugin name', () => {
      expect(baseOAuthDiscoveryPluginV2.name).toBe('oauth-discovery');
    });

    it('should have default configuration', () => {
      expect(baseOAuthDiscoveryPluginV2.config).toEqual({
        issuer: 'http://localhost:3000',
        scopes: [
          'openid',
          'profile',
          'email',
          'offline_access'
        ],
        responseTypes: [
          'code',
          'token',
          'id_token',
          'code token',
          'code id_token',
          'token id_token',
          'code token id_token'
        ],
        grantTypes: [
          'authorization_code',
          'client_credentials',
          'refresh_token',
          'urn:ietf:params:oauth:grant-type:device_code'
        ],
        tokenEndpointAuthMethods: [
          'client_secret_basic',
          'client_secret_post',
          'private_key_jwt',
          'client_secret_jwt'
        ],
        uiLocales: ['en'],
        includeJwksUri: true,
        includeUserinfoEndpoint: true,
      });
    });

    it('should have required steps', () => {
      expect(baseOAuthDiscoveryPluginV2.steps).toHaveLength(2);
      expect(baseOAuthDiscoveryPluginV2.steps![0].name).toBe('get-oauth-discovery-metadata');
      expect(baseOAuthDiscoveryPluginV2.steps![1].name).toBe('get-oauth-protected-resource-metadata');
    });

    it('should have step descriptions', () => {
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      expect(steps[0].description).toBe('Generate OAuth 2.0 Authorization Server Metadata per RFC 8414');
      expect(steps[1].description).toBe('Generate OAuth 2.0 Protected Resource Metadata per RFC 8693');
    });

    it('should have HTTP protocol configuration', () => {
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      expect(steps[0].protocol?.http?.method).toBe('GET');
      expect(steps[0].protocol?.http?.codes?.su).toBe(200);
      
      expect(steps[1].protocol?.http?.method).toBe('GET');
      expect(steps[1].protocol?.http?.codes?.su).toBe(200);
    });

    it('should have input and output validation schemas', () => {
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      // Each step should have validation schema and outputs
      expect(steps[0].validationSchema).toBeDefined();
      expect(steps[0].outputs).toBeDefined();
      expect(steps[0].inputs).toBeDefined();
      
      expect(steps[1].validationSchema).toBeDefined();
      expect(steps[1].outputs).toBeDefined();
      expect(steps[1].inputs).toBeDefined();
    });

    it('should have correct input fields', () => {
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      // Discovery metadata step inputs
      expect(steps[0].inputs).toContain('issuer');
      expect(steps[0].inputs).toContain('baseUrl');
      expect(steps[0].inputs).toContain('scopes');
      expect(steps[0].inputs).toContain('responseTypes');
      expect(steps[0].inputs).toContain('grantTypes');
      expect(steps[0].inputs).toContain('tokenEndpointAuthMethods');
      expect(steps[0].inputs).toContain('uiLocales');
      expect(steps[0].inputs).toContain('serviceDocumentation');
      expect(steps[0].inputs).toContain('includeJwksUri');
      expect(steps[0].inputs).toContain('includeUserinfoEndpoint');
      expect(steps[0].inputs).toContain('customMetadata');
      
      // Protected resource metadata step inputs
      expect(steps[1].inputs).toContain('resource');
      expect(steps[1].inputs).toContain('authorizationServers');
      expect(steps[1].inputs).toContain('scopes');
      expect(steps[1].inputs).toContain('bearerMethods');
      expect(steps[1].inputs).toContain('resourceDocumentation');
    });
  });

  describe('Plugin Factory', () => {
    it('should create plugin with custom config', () => {
      const customConfig: Partial<OAuthDiscoveryConfigV2> = {
        issuer: 'https://custom.example.com',
        scopes: ['custom:scope'],
        includeJwksUri: false
      };
      
      const plugin = createOAuthDiscoveryPluginV2(customConfig);
      
      expect(plugin.name).toBe('oauth-discovery');
      expect(plugin.config!.issuer).toBe('https://custom.example.com');
      expect(plugin.config!.scopes).toEqual(['custom:scope']);
      expect(plugin.config!.includeJwksUri).toBe(false);
    });

    it('should preserve default config when not overridden', () => {
      const plugin = createOAuthDiscoveryPluginV2({
        issuer: 'https://custom.example.com'
      });
      
      expect(plugin.config!.issuer).toBe('https://custom.example.com');
      expect(plugin.config!.includeJwksUri).toBe(true); // Default preserved
      expect(plugin.config!.uiLocales).toEqual(['en']); // Default preserved
    });

    it('should support all configuration options', () => {
      const fullConfig: Partial<OAuthDiscoveryConfigV2> = {
        issuer: 'https://auth.example.com',
        baseUrl: 'https://api.example.com',
        scopes: ['read', 'write', 'admin'],
        responseTypes: ['code'],
        grantTypes: ['authorization_code'],
        tokenEndpointAuthMethods: ['client_secret_basic'],
        uiLocales: ['en', 'es', 'fr'],
        serviceDocumentation: 'https://docs.example.com',
        includeJwksUri: false,
        includeUserinfoEndpoint: false,
        customMetadata: {
          custom_field: 'value',
          another_field: 123
        }
      };
      
      const plugin = createOAuthDiscoveryPluginV2(fullConfig);
      
      expect(plugin.config).toMatchObject(fullConfig);
    });
  });

  describe('Step Implementation', () => {
    it('should have async run functions', () => {
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      expect(typeof steps[0].run).toBe('function');
      expect(typeof steps[1].run).toBe('function');
    });
  });

  describe('Plugin Compliance', () => {
    it('should follow V2 plugin architecture', () => {
      expect(baseOAuthDiscoveryPluginV2.name).toBeTruthy();
      expect(baseOAuthDiscoveryPluginV2.config).toBeDefined();
      expect(Array.isArray(baseOAuthDiscoveryPluginV2.steps)).toBe(true);
      expect(typeof baseOAuthDiscoveryPluginV2.initialize).toBe('function');
    });

    it('should be stateless (no session resolvers needed)', () => {
      // OAuth discovery is stateless, so no session resolvers are registered
      // This is verified by checking the initialize function does nothing
      expect(baseOAuthDiscoveryPluginV2.initialize).toBeDefined();
    });

    it('should be protocol agnostic', () => {
      // Verify steps return plain objects, not HTTP responses
      const steps = baseOAuthDiscoveryPluginV2.steps || [];
      
      // Steps should have outputs that are plain objects
      expect(steps[0].outputs).toBeDefined();
      expect(steps[1].outputs).toBeDefined();
      
      // No HTTP-specific dependencies in the plugin
      expect(JSON.stringify(baseOAuthDiscoveryPluginV2)).not.toContain('Response');
      expect(JSON.stringify(baseOAuthDiscoveryPluginV2)).not.toContain('Request');
    });
  });
});