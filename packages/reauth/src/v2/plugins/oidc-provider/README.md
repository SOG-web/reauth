# OIDC Provider Plugin V2

A comprehensive OpenID Connect (OIDC) Provider implementation for ReAuth V2 that enables ReAuth to act as an Identity Provider, allowing other applications to authenticate users through ReAuth.

## Features

- **Full OIDC Compliance**: Implements OpenID Connect 1.0 and OAuth 2.0 specifications
- **Protocol Agnostic**: Works without HTTP dependencies in core logic
- **Platform Agnostic**: Runs on Node.js, Deno, Bun, browsers, and edge runtimes
- **Runtime Agnostic**: Compatible with all JavaScript runtimes
- **Security First**: PKCE support, secure token handling, proper validation
- **Standards Compliant**: RFC 6749 (OAuth 2.0), RFC 7519 (JWT), RFC 7517 (JWKS)

## Supported Flows

- ✅ **Authorization Code Flow** with PKCE
- ✅ **Refresh Token Flow**
- ✅ **Client Credentials Flow** (basic support)
- ❌ **Implicit Flow** (disabled by default for security)
- ❌ **Hybrid Flow** (not implemented)
- ❌ **Device Authorization Flow** (not implemented)

## Core Steps

### Discovery and Metadata
- `get-discovery-document` - OpenID Connect Discovery document
- `get-jwks` - JSON Web Key Set for token verification

### Authorization Flow
- `begin-authorization` - Initiate OIDC authorization flow
- `exchange-authorization-code` - Exchange code for tokens

### Token Management
- `revoke-token` - Revoke access or refresh tokens
- `get-userinfo` - UserInfo endpoint for claims

### Client Management
- `register-client` - Dynamic client registration (RFC 7591)

## Quick Start

```typescript
import { ReAuthEngineV2 } from '@re-auth/reauth/v2';
import { createOIDCProviderPlugin } from '@re-auth/reauth/v2';

// Configure OIDC Provider
const oidcProvider = createOIDCProviderPlugin({
  config: {
    issuer: {
      url: 'https://auth.example.com',
      name: 'My OIDC Provider'
    },
    features: {
      authorizationCodeFlow: true,
      refreshTokens: true,
      pkce: true,
      dynamicClientRegistration: true,
      tokenRevocation: true
    },
    tokens: {
      accessTokenTtl: 60, // 1 hour
      idTokenTtl: 60, // 1 hour
      refreshTokenTtl: 30, // 30 days
      signingAlgorithm: 'RS256'
    }
  }
});

// Create engine with OIDC provider
const engine = new ReAuthEngineV2({
  dbClient: yourDbClient,
  plugins: [oidcProvider]
});
```

## Configuration

### Basic Configuration

```typescript
interface OIDCProviderConfigV2 {
  // Issuer information
  issuer: {
    url: string;           // Issuer URL (must be HTTPS in production)
    name: string;          // Human-readable provider name
    logo?: string;         // Logo URL
    termsOfService?: string;
    privacyPolicy?: string;
  };

  // Feature flags
  features: {
    authorizationCodeFlow: boolean;
    refreshTokens: boolean;
    pkce: boolean;
    dynamicClientRegistration: boolean;
    tokenRevocation: boolean;
    // ... other features
  };

  // Token configuration
  tokens: {
    accessTokenTtl: number;      // Minutes
    idTokenTtl: number;          // Minutes  
    refreshTokenTtl: number;     // Days
    authorizationCodeTtl: number; // Minutes
    signingAlgorithm: 'RS256' | 'ES256' | 'HS256';
  };

  // Security settings
  security: {
    requirePkce: boolean;
    allowInsecureRedirectUris: boolean;
    maxAuthorizationAge: number; // Seconds
  };

  // Scopes and claims
  scopes: Record<string, {
    description: string;
    claims: string[];
    required?: boolean;
  }>;

  claims: Record<string, {
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    source: string; // User profile field mapping
  }>;
}
```

## Database Schema

The plugin requires the following database tables:

- `oidc_clients` - OAuth/OIDC client registrations
- `oidc_authorization_codes` - Authorization codes
- `oidc_access_tokens` - Access tokens
- `oidc_refresh_tokens` - Refresh tokens  
- `oidc_id_tokens` - ID tokens (audit log)
- `oidc_keys` - Cryptographic keys

Use the provided schema:

```typescript
import { oidcProviderSchemaV2 } from '@re-auth/reauth/v2';

// Add to your database schema
const schema = {
  ...existingSchema,
  ...oidcProviderSchemaV2
};
```

## Usage Examples

### Complete Authorization Flow

```typescript
// 1. Register a client
const client = await engine.executeStep('register-client', {
  clientName: 'My Web App',
  redirectUris: ['https://myapp.com/callback'],
  grantTypes: ['authorization_code'],
  responseTypes: ['code']
});

// 2. Get discovery document
const discovery = await engine.executeStep('get-discovery-document', {
  baseUrl: 'https://auth.example.com'
});

// 3. Start authorization (user authenticated)
const auth = await engine.executeStep('begin-authorization', {
  clientId: client.clientId,
  redirectUri: 'https://myapp.com/callback',
  responseType: 'code',
  scopes: ['openid', 'profile', 'email'],
  state: 'random-state',
  userId: 'authenticated-user-id'
});

// 4. Exchange code for tokens
const tokens = await engine.executeStep('exchange-authorization-code', {
  grantType: 'authorization_code',
  clientId: client.clientId,
  code: auth.authorizationCode,
  redirectUri: 'https://myapp.com/callback'
});

// 5. Get user info
const userInfo = await engine.executeStep('get-userinfo', {
  accessToken: tokens.accessToken
});
```

### Custom Claims Configuration

```typescript
const oidcProvider = createOIDCProviderPlugin({
  config: {
    scopes: {
      openid: {
        description: 'OpenID Connect authentication',
        claims: ['sub'],
        required: true
      },
      profile: {
        description: 'User profile',
        claims: ['name', 'email', 'department', 'role']
      },
      admin: {
        description: 'Administrative access',
        claims: ['admin_level', 'permissions']
      }
    },
    claims: {
      sub: { description: 'Subject', type: 'string', source: 'id' },
      name: { description: 'Full name', type: 'string', source: 'name' },
      email: { description: 'Email', type: 'string', source: 'email' },
      department: { description: 'Department', type: 'string', source: 'dept' },
      role: { description: 'Role', type: 'string', source: 'role' },
      admin_level: { description: 'Admin level', type: 'number', source: 'admin_level' },
      permissions: { description: 'Permissions', type: 'array', source: 'permissions' }
    }
  }
});
```

## Security Considerations

### PKCE (Proof Key for Code Exchange)
- **Required by default** for security
- Supports both S256 and plain methods
- Plain method can be disabled via configuration

### Redirect URI Validation
- Strict validation of redirect URIs
- HTTPS required by default (configurable)
- No fragments allowed in redirect URIs

### Token Security
- Secure random token generation
- Proper token hashing for storage
- Configurable token lifetimes
- Automatic cleanup of expired tokens

### JWT Security
- Proper JWT signing (requires real keys in production)
- Nonce validation for replay protection
- State parameter for CSRF protection

## Production Deployment

### Cryptographic Keys
In production, generate proper RSA or EC keys:

```typescript
// Example key generation (use proper crypto libraries)
import { generateKeyPair } from 'crypto';

const { publicKey, privateKey } = generateKeyPair('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Store in oidc_keys table with proper encryption
```

### Environment Configuration
```typescript
const productionConfig = {
  issuer: {
    url: process.env.OIDC_ISSUER_URL,
    name: process.env.OIDC_ISSUER_NAME
  },
  security: {
    requirePkce: true,
    allowInsecureRedirectUris: false,
    maxAuthorizationAge: 300
  },
  tokens: {
    accessTokenTtl: 30,  // Shorter for production
    idTokenTtl: 30,
    refreshTokenTtl: 7,  // 7 days
    signingAlgorithm: 'RS256'
  }
};
```

## Cleanup and Maintenance

The plugin automatically registers cleanup tasks:

- **Expired Codes**: Removes expired authorization codes
- **Expired Tokens**: Cleans up expired access/refresh/ID tokens  
- **Revoked Tokens**: Archives old revoked tokens

Configure cleanup behavior:

```typescript
{
  cleanup: {
    enabled: true,
    intervalMinutes: 60,
    expiredTokenRetentionDays: 7,
    expiredCodeRetentionHours: 1,
    revokedTokenRetentionDays: 30
  }
}
```

## Testing

```typescript
import { createInMemoryDatabase } from '@re-auth/reauth/testing';
import { oidcProviderSchemaV2 } from '@re-auth/reauth/v2';

// Create test database
const testDb = await createInMemoryDatabase(oidcProviderSchemaV2);

// Test OIDC provider
const engine = new ReAuthEngineV2({
  dbClient: testDb,
  plugins: [oidcProvider]
});
```

## Standards Compliance

- **OpenID Connect Core 1.0**
- **OpenID Connect Discovery 1.0**  
- **OAuth 2.0** (RFC 6749)
- **JWT** (RFC 7519)
- **JWKS** (RFC 7517)
- **Token Revocation** (RFC 7009)
- **Dynamic Client Registration** (RFC 7591)
- **PKCE** (RFC 7636)

## Limitations

- JWT signing uses placeholder implementation (needs real crypto)
- No support for request objects (JAR/PAR)
- Limited support for advanced OIDC features
- No built-in UI for authorization consent

## Contributing

When extending the OIDC Provider plugin:

1. Follow V2 architecture patterns
2. Maintain protocol-agnostic design
3. Add proper tests for new features
4. Update documentation
5. Follow security best practices

## License

Part of ReAuth - see main project license.