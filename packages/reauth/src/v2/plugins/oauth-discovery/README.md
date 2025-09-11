# OAuth Discovery Plugin V2

The OAuth Discovery plugin provides OAuth 2.0 discovery metadata functionality as preparation for advanced OIDC auth plugins. This plugin is protocol/framework/runtime agnostic and returns plain data objects.

## Features

- **RFC 8414 Compliant**: OAuth 2.0 Authorization Server Metadata
- **RFC 8693 Support**: OAuth 2.0 Protected Resource Metadata
- **Protocol Agnostic**: Returns plain objects, not HTTP responses
- **Configurable**: Flexible configuration options
- **Runtime Independent**: Works across all JS runtimes and frameworks

## Usage

### Basic Setup

```typescript
import { ReAuthEngineV2, createOAuthDiscoveryPluginV2 } from 'reauth/v2';

const oauthPlugin = createOAuthDiscoveryPluginV2({
  issuer: 'https://auth.example.com',
  scopes: ['openid', 'profile', 'email'],
  baseUrl: 'https://api.example.com'
});

const engine = new ReAuthEngineV2({
  plugins: [oauthPlugin],
  // ... other config
});
```

### Get OAuth Discovery Metadata

```typescript
// Get RFC 8414 compliant discovery metadata
const result = await engine.getStep('get-oauth-discovery-metadata')({
  issuer: 'https://auth.example.com'
});

console.log(result.metadata);
// {
//   "issuer": "https://auth.example.com",
//   "authorization_endpoint": "https://auth.example.com/oauth/authorize",
//   "token_endpoint": "https://auth.example.com/oauth/token",
//   "userinfo_endpoint": "https://auth.example.com/oauth/userinfo",
//   "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
//   "scopes_supported": ["openid", "profile", "email"],
//   "response_types_supported": ["code", "token", "id_token"],
//   "grant_types_supported": ["authorization_code", "client_credentials"],
//   ...
// }
```

### Get Protected Resource Metadata

```typescript
// Get RFC 8693 compliant protected resource metadata
const result = await engine.getStep('get-oauth-protected-resource-metadata')({
  resource: 'https://api.example.com',
  authorizationServers: ['https://auth.example.com'],
  scopes: ['read', 'write', 'admin']
});

console.log(result.metadata);
// {
//   "resource": "https://api.example.com",
//   "authorization_servers": ["https://auth.example.com"],
//   "scopes_supported": ["read", "write", "admin"],
//   "bearer_methods_supported": ["header", "body", "query"]
// }
```

## Integration with HTTP Frameworks

Since this plugin returns plain objects, you can easily integrate it with any HTTP framework:

### Next.js API Route

```typescript
import { auth } from '@/lib/auth';

export async function GET() {
  const result = await auth.getStep('get-oauth-discovery-metadata')({});
  
  return Response.json(result.metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
```

### Express.js

```typescript
app.get('/.well-known/oauth-authorization-server', async (req, res) => {
  const result = await auth.getStep('get-oauth-discovery-metadata')({});
  
  res.json(result.metadata);
});
```

### Hono

```typescript
app.get('/.well-known/oauth-authorization-server', async (c) => {
  const result = await auth.getStep('get-oauth-discovery-metadata')({});
  
  return c.json(result.metadata);
});
```

## Configuration Options

```typescript
interface OAuthDiscoveryConfigV2 {
  // Required: The issuer identifier
  issuer: string;
  
  // Optional: Base URL for endpoints (defaults to issuer)
  baseUrl?: string;
  
  // Optional: Supported scopes
  scopes?: string[];
  
  // Optional: Supported response types
  responseTypes?: string[];
  
  // Optional: Supported grant types
  grantTypes?: string[];
  
  // Optional: Token endpoint auth methods
  tokenEndpointAuthMethods?: string[];
  
  // Optional: Supported UI locales
  uiLocales?: string[];
  
  // Optional: Service documentation URL
  serviceDocumentation?: string;
  
  // Optional: Include JWKS URI (default: true)
  includeJwksUri?: boolean;
  
  // Optional: Include userinfo endpoint (default: true)
  includeUserinfoEndpoint?: boolean;
  
  // Optional: Custom metadata fields
  customMetadata?: Record<string, any>;
}
```

## Default Configuration

```typescript
{
  issuer: 'http://localhost:3000',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  responseTypes: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token'],
  grantTypes: ['authorization_code', 'client_credentials', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
  tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post', 'private_key_jwt', 'client_secret_jwt'],
  uiLocales: ['en'],
  includeJwksUri: true,
  includeUserinfoEndpoint: true
}
```

## Standards Compliance

- **RFC 8414**: OAuth 2.0 Authorization Server Metadata
- **RFC 8693**: OAuth 2.0 Token Exchange (Protected Resource Metadata)
- **RFC 6749**: OAuth 2.0 Authorization Framework

## Use Cases

- **API Documentation**: Automatic OAuth discovery for API consumers
- **Client Configuration**: Dynamic client configuration based on server capabilities
- **OIDC Preparation**: Foundation for advanced OpenID Connect authentication plugins
- **Microservices**: OAuth discovery for distributed authentication systems
- **Developer Tools**: Enable OAuth tooling and debugging utilities