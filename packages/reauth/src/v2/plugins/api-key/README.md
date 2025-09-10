# API Key Plugin V2 Usage Example

This example demonstrates how to use the API Key plugin for machine-to-machine authentication.

## Setup

```typescript
import { ReAuthEngineV2, apiKeyPluginV2, buildSchemaV2 } from '@re-auth/reauth/v2';
import { FumaClient } from 'fumadb';

// Initialize with API key plugin
const engine = new ReAuthEngineV2({
  dbClient: fumaClient,
  plugins: [
    apiKeyPluginV2({
      keyLength: 32,
      keyPrefix: 'myapp_',
      defaultTtlDays: 365,
      maxKeysPerUser: 5,
      allowedScopes: ['read', 'write', 'admin'],
      requireScopes: true,
      enableUsageTracking: true,
    }),
  ],
});
```

## Creating API Keys

```typescript
// User must be authenticated first
const sessionToken = await engine.createSessionFor('subject', 'user-123');

// Create a new API key
const result = await engine.executeStep('api-key', 'create-api-key', {
  token: sessionToken,
  name: 'Production API Key',
  scopes: ['read', 'write'],
  ttl_days: 90,
});

if (result.success) {
  const { api_key, metadata } = result.data;
  console.log('API Key:', api_key); // Only shown once!
  console.log('Key ID:', metadata.id);
  console.log('Expires:', metadata.expires_at);
}
```

## Authenticating with API Keys

```typescript
// Machine-to-machine authentication
const authResult = await engine.executeStep('api-key', 'authenticate-api-key', {
  api_key: 'myapp_abc123def456...',
  track_usage: true,
  endpoint: '/api/users',
  ip_address: '192.168.1.100',
});

if (authResult.success) {
  const { token, subject } = authResult;
  console.log('Session token:', token);
  console.log('Subject:', subject);
  console.log('Permissions:', subject.permissions);
  console.log('Scopes:', subject.scopes);
}
```

## Managing API Keys

```typescript
// List all API keys for authenticated user
const listResult = await engine.executeStep('api-key', 'list-api-keys', {
  token: sessionToken,
  include_inactive: false,
});

// Update API key permissions
const updateResult = await engine.executeStep('api-key', 'update-api-key', {
  token: sessionToken,
  name: 'Production API Key',
  scopes: ['read'], // Reduce permissions
  expires_at: new Date('2025-12-31'),
});

// Revoke an API key
const revokeResult = await engine.executeStep('api-key', 'revoke-api-key', {
  token: sessionToken,
  name: 'Production API Key',
});
```

## Security Best Practices

1. **Store API keys securely**: Never log or expose API keys in plain text
2. **Use appropriate scopes**: Grant minimum necessary permissions
3. **Set expiration dates**: Regularly rotate API keys
4. **Monitor usage**: Enable usage tracking for audit trails
5. **Revoke unused keys**: Clean up old or unnecessary keys

## Database Schema

The plugin creates these tables:

```sql
-- API keys table (hashed keys only)
CREATE TABLE api_keys (
  id VARCHAR(255) PRIMARY KEY,
  subject_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL, -- Securely hashed
  permissions JSON,
  scopes JSON,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking (optional)
CREATE TABLE api_key_usage (
  id VARCHAR(255) PRIMARY KEY,
  api_key_id VARCHAR(255) NOT NULL,
  endpoint VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent VARCHAR(1000),
  success BOOLEAN DEFAULT true,
  error_message VARCHAR(500),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration Options

- `keyLength`: Length of generated keys (default: 32)
- `keyPrefix`: Prefix for keys (default: 'ak_')
- `defaultTtlDays`: Default expiration in days (default: 365)
- `maxKeysPerUser`: Maximum keys per subject (default: 10)
- `allowedScopes`: Available permission scopes
- `requireScopes`: Whether scopes are mandatory (default: false)
- `enableUsageTracking`: Enable audit logging (default: false)
- `cleanupExpiredKeys`: Auto-cleanup expired keys (default: true)
- `cleanupUsageOlderThanDays`: Remove old usage logs (default: 90)