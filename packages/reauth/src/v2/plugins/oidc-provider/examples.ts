/**
 * OIDC Provider Plugin V2 Examples
 * Usage examples for the OpenID Connect Provider plugin
 */

import { ReAuthEngineV2 } from '../../engine.v2';
import { createOIDCProviderPlugin } from './plugin.v2';
import type { OIDCProviderConfigV2 } from './types';
import { oidcProviderSchemaV2 } from './schema.v2';

/**
 * Basic OIDC Provider Setup Example
 */
export async function basicOIDCProviderExample() {
  // Configure the OIDC Provider
  const oidcConfig: Partial<OIDCProviderConfigV2> = {
    issuer: {
      url: 'https://auth.example.com',
      name: 'Example OIDC Provider',
      logo: 'https://example.com/logo.png',
    },
    features: {
      authorizationCodeFlow: true,
      refreshTokens: true,
      pkce: true,
      dynamicClientRegistration: true,
      tokenIntrospection: true,
      tokenRevocation: true,
      implicitFlow: false,
      hybridFlow: false,
      clientCredentialsFlow: false,
      deviceAuthorizationFlow: false,
    },
    tokens: {
      accessTokenTtl: 60, // 1 hour
      idTokenTtl: 60, // 1 hour
      refreshTokenTtl: 30, // 30 days
      authorizationCodeTtl: 10, // 10 minutes
      signingAlgorithm: 'RS256',
    },
    scopes: {
      openid: {
        description: 'OpenID Connect authentication',
        claims: ['sub'],
        required: true,
      },
      profile: {
        description: 'User profile information',
        claims: ['name', 'given_name', 'family_name', 'picture'],
      },
      email: {
        description: 'User email address',
        claims: ['email', 'email_verified'],
      },
    },
    security: {
      requirePkce: true,
      allowInsecureRedirectUris: false,
      maxAuthorizationAge: 300,
      requireRequestUri: false,
      allowPlaintextPkce: false,
    },
  };

  // Create OIDC provider plugin
  const oidcProviderPlugin = createOIDCProviderPlugin({
    config: oidcConfig,
  });

  // Note: You would need to provide a real database client here
  const mockDbClient = {
    version: async () => '1.0.0',
    orm: () => ({
      // Mock ORM implementation
    }),
  };

  // Create ReAuth engine with OIDC provider
  const engine = new ReAuthEngineV2({
    dbClient: mockDbClient as any,
    plugins: [oidcProviderPlugin],
  });

  return engine;
}

/**
 * Example: Complete OIDC Authorization Flow
 */
export async function oidcAuthorizationFlowExample() {
  const engine = await basicOIDCProviderExample();

  // 1. Client Registration
  const clientResult = await engine.executeStep('register-client', {
    clientName: 'My Web Application',
    redirectUris: ['https://myapp.example.com/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    scope: 'openid profile email',
  });

  console.log('Client registered:', clientResult);

  // 2. Get Discovery Document
  const discoveryResult = await engine.executeStep('get-discovery-document', {
    baseUrl: 'https://auth.example.com',
  });

  console.log('Discovery document:', discoveryResult.discoveryDocument);

  // 3. Get JWKS
  const jwksResult = await engine.executeStep('get-jwks', {});
  console.log('JWKS:', jwksResult.jwks);

  // 4. Authorization Request (assuming user is authenticated)
  const authResult = await engine.executeStep('begin-authorization', {
    clientId: clientResult.clientId!,
    redirectUri: 'https://myapp.example.com/callback',
    responseType: 'code',
    scopes: ['openid', 'profile', 'email'],
    state: 'random-state-value',
    nonce: 'random-nonce-value',
    userId: 'user-123', // Authenticated user ID
  });

  console.log('Authorization result:', authResult);

  // 5. Token Exchange
  const tokenResult = await engine.executeStep('exchange-authorization-code', {
    grantType: 'authorization_code',
    clientId: clientResult.clientId!,
    code: authResult.authorizationCode!,
    redirectUri: 'https://myapp.example.com/callback',
  });

  console.log('Token result:', tokenResult);

  // 6. UserInfo Request
  const userInfoResult = await engine.executeStep('get-userinfo', {
    accessToken: tokenResult.accessToken!,
  });

  console.log('User info:', userInfoResult);

  return {
    client: clientResult,
    discovery: discoveryResult,
    jwks: jwksResult,
    authorization: authResult,
    tokens: tokenResult,
    userInfo: userInfoResult,
  };
}

/**
 * Example: OIDC Provider with Custom Claims
 */
export async function oidcCustomClaimsExample() {
  const customConfig: Partial<OIDCProviderConfigV2> = {
    issuer: {
      url: 'https://auth.example.com',
      name: 'Custom Claims OIDC Provider',
    },
    scopes: {
      openid: {
        description: 'OpenID Connect authentication',
        claims: ['sub'],
        required: true,
      },
      profile: {
        description: 'User profile information',
        claims: ['name', 'nickname', 'picture', 'website', 'department', 'role'],
      },
      email: {
        description: 'User email address',
        claims: ['email', 'email_verified'],
      },
      custom: {
        description: 'Custom organizational claims',
        claims: ['organization', 'department', 'role', 'permissions'],
      },
    },
    claims: {
      sub: { description: 'Subject identifier', type: 'string', source: 'id' },
      name: { description: 'Full name', type: 'string', source: 'name' },
      nickname: { description: 'Nickname', type: 'string', source: 'nickname' },
      picture: { description: 'Profile picture', type: 'string', source: 'avatar_url' },
      website: { description: 'Website URL', type: 'string', source: 'website' },
      email: { description: 'Email address', type: 'string', source: 'email' },
      email_verified: { description: 'Email verified', type: 'boolean', source: 'email_verified' },
      organization: { description: 'Organization', type: 'string', source: 'organization_name' },
      department: { description: 'Department', type: 'string', source: 'department' },
      role: { description: 'User role', type: 'string', source: 'role' },
      permissions: { description: 'User permissions', type: 'array', source: 'permissions' },
    },
  };

  const oidcProvider = createOIDCProviderPlugin({
    config: customConfig,
  });

  console.log('OIDC Provider with custom claims configured');
  return oidcProvider;
}

/**
 * Example: Enterprise OIDC Provider Setup
 */
export async function enterpriseOIDCExample() {
  const enterpriseConfig: Partial<OIDCProviderConfigV2> = {
    issuer: {
      url: 'https://sso.company.com',
      name: 'Company SSO',
      termsOfService: 'https://company.com/terms',
      privacyPolicy: 'https://company.com/privacy',
    },
    features: {
      authorizationCodeFlow: true,
      refreshTokens: true,
      pkce: true,
      dynamicClientRegistration: false, // Controlled registration
      tokenIntrospection: true,
      tokenRevocation: true,
      clientCredentialsFlow: true, // For service-to-service
      implicitFlow: false, // Disabled for security
      hybridFlow: false,
      deviceAuthorizationFlow: false,
    },
    tokens: {
      accessTokenTtl: 30, // 30 minutes for security
      idTokenTtl: 30, // 30 minutes
      refreshTokenTtl: 1, // 1 day
      authorizationCodeTtl: 5, // 5 minutes
      signingAlgorithm: 'RS256',
    },
    security: {
      requirePkce: true,
      allowInsecureRedirectUris: false,
      maxAuthorizationAge: 600, // 10 minutes
      requireRequestUri: true, // Enhanced security
      allowPlaintextPkce: false,
    },
    cleanup: {
      enabled: true,
      intervalMinutes: 30, // More frequent cleanup
      expiredTokenRetentionDays: 3,
      expiredCodeRetentionHours: 1,
      revokedTokenRetentionDays: 7,
    },
  };

  const enterpriseOIDC = createOIDCProviderPlugin({
    config: enterpriseConfig,
  });

  console.log('Enterprise OIDC Provider configured with enhanced security');
  return enterpriseOIDC;
}

/**
 * Example: Multi-tenant OIDC Provider
 */
export async function multiTenantOIDCExample() {
  // Base configuration that can be extended per tenant
  const baseConfig: Partial<OIDCProviderConfigV2> = {
    features: {
      authorizationCodeFlow: true,
      refreshTokens: true,
      pkce: true,
      dynamicClientRegistration: true,
      tokenIntrospection: true,
      tokenRevocation: true,
      implicitFlow: false,
      hybridFlow: false,
      clientCredentialsFlow: false,
      deviceAuthorizationFlow: false,
    },
    tokens: {
      accessTokenTtl: 60,
      idTokenTtl: 60,
      refreshTokenTtl: 30,
      authorizationCodeTtl: 10,
      signingAlgorithm: 'RS256',
    },
    security: {
      requirePkce: true,
      allowInsecureRedirectUris: false,
      maxAuthorizationAge: 300,
      requireRequestUri: false,
      allowPlaintextPkce: false,
    },
  };

  // Tenant-specific configurations
  const tenants = [
    {
      name: 'tenant-a',
      issuer: {
        url: 'https://tenant-a.auth.platform.com',
        name: 'Tenant A Authentication',
      },
    },
    {
      name: 'tenant-b',
      issuer: {
        url: 'https://tenant-b.auth.platform.com',
        name: 'Tenant B Authentication',
      },
    },
  ];

  const tenantProviders = tenants.map(tenant => {
    return createOIDCProviderPlugin({
      config: {
        ...baseConfig,
        issuer: tenant.issuer,
      },
    });
  });

  console.log(`Created ${tenantProviders.length} tenant-specific OIDC providers`);
  return tenantProviders;
}

/**
 * Example: Testing OIDC Provider Functionality
 */
export async function testOIDCProviderExample() {
  const engine = await basicOIDCProviderExample();

  console.log('Testing OIDC Provider steps...');

  try {
    // Test discovery endpoint
    const discovery = await engine.executeStep('get-discovery-document', {
      baseUrl: 'https://auth.example.com',
    });
    console.log('✓ Discovery document generated');

    // Test JWKS endpoint (may fail without keys)
    try {
      const jwks = await engine.executeStep('get-jwks', {});
      console.log('✓ JWKS retrieved');
    } catch (error) {
      console.log('⚠ JWKS test failed (expected without keys):', (error as Error).message);
    }

    console.log('OIDC Provider tests completed');
    return true;
  } catch (error) {
    console.error('OIDC Provider test failed:', error);
    return false;
  }
}