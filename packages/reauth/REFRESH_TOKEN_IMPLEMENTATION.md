# JWT Refresh Token Implementation

This document describes the refresh token functionality that has been added to the ReAuth JWT system.

## Overview

The refresh token implementation provides a secure way to maintain user sessions without requiring frequent re-authentication. It follows OAuth 2.0 best practices and includes features like token rotation, revocation, and cleanup.

## Features

### Core Functionality
- **Token Pair Generation**: Creates both access and refresh tokens simultaneously
- **Token Refresh**: Exchange refresh tokens for new access tokens
- **Token Rotation**: Optionally rotate refresh tokens on each use for enhanced security
- **Token Revocation**: Revoke individual or all refresh tokens for a subject
- **Automatic Cleanup**: Remove expired refresh tokens from the database

### Security Features
- **Secure Storage**: Refresh tokens are hashed before storage in the database
- **Device Tracking**: Optional device fingerprinting and metadata storage
- **Configurable Lifetimes**: Separate TTL configuration for access and refresh tokens
- **Revocation Reasons**: Track why tokens were revoked (logout, security, rotation, etc.)

## Database Schema

### Refresh Tokens Table (`refresh_tokens`)

```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(255) PRIMARY KEY,
  token_id VARCHAR(255) UNIQUE NOT NULL,
  subject_type VARCHAR(255) NOT NULL,
  subject_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP NULL,
  revocation_reason VARCHAR(50) NULL,
  device_fingerprint VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL
);
```

## API Reference

### JWT Service Methods

#### `createTokenPair(payload, deviceInfo?): Promise<TokenPair>`
Creates a new access token and refresh token pair.

```typescript
const tokenPair = await jwtService.createTokenPair(
  { sub: 'user123', subject_type: 'user' },
  {
    fingerprint: 'device123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
);
```

#### `refreshAccessToken(refreshToken): Promise<TokenPair>`
Exchanges a refresh token for a new access token (and optionally a new refresh token).

```typescript
const newTokenPair = await jwtService.refreshAccessToken(refreshToken);
```

#### `revokeRefreshToken(token, reason?): Promise<void>`
Revokes a specific refresh token.

```typescript
await jwtService.revokeRefreshToken(refreshToken, 'logout');
```

#### `revokeAllRefreshTokens(subjectType, subjectId, reason?): Promise<number>`
Revokes all refresh tokens for a subject.

```typescript
const revokedCount = await jwtService.revokeAllRefreshTokens('user', 'user123', 'security');
```

### Session Service Methods

#### `createJWTTokenPair(subjectType, subjectId, deviceInfo?): Promise<TokenPair>`
High-level method to create token pairs through the session service.

#### `refreshJWTTokenPair(refreshToken): Promise<TokenPair>`
High-level method to refresh tokens through the session service.

#### `revokeRefreshToken(refreshToken, reason?): Promise<void>`
High-level method to revoke refresh tokens through the session service.

#### `revokeAllRefreshTokens(subjectType, subjectId, reason?): Promise<number>`
High-level method to revoke all refresh tokens through the session service.

## Plugin Steps

The JWT plugin includes the following new steps for refresh token operations:

### `create-token-pair`
Creates a JWT access token and refresh token pair.

**HTTP**: `POST` with status codes:
- `200` (su): Success
- `400` (unf): Validation failed
- `500` (ic): Internal error

### `refresh-access-token`
Exchanges a refresh token for a new access token.

**HTTP**: `POST` with status codes:
- `200` (su): Success
- `400` (unf): Validation failed
- `401` (unauth): Invalid refresh token
- `500` (ic): Internal error

### `revoke-refresh-token`
Revokes a refresh token.

**HTTP**: `POST` with status codes:
- `200` (su): Success
- `400` (unf): Validation failed
- `500` (ic): Internal error

### `revoke-all-refresh-tokens`
Revokes all refresh tokens for a subject.

**HTTP**: `POST` with status codes:
- `200` (su): Success
- `400` (unf): Validation failed
- `500` (ic): Internal error

## Configuration

### JWT Plugin Configuration

```typescript
{
  // Token lifetimes
  defaultAccessTokenTtlSeconds: 900, // 15 minutes
  defaultRefreshTokenTtlSeconds: 2592000, // 30 days
  
  // Security
  enableRefreshTokenRotation: true, // Rotate refresh tokens on use
  
  // Other existing JWT config...
}
```

### Service Configuration

```typescript
const jwtService = new EnhancedJWKSService(
  dbClient,
  'issuer',
  10, // keyRotationIntervalDays
  2,  // keyGracePeriodDays
  900, // defaultAccessTokenTtlSeconds
  2592000, // defaultRefreshTokenTtlSeconds
  true // enableRefreshTokenRotation
);
```

## Usage Examples

### Basic Token Pair Creation

```typescript
// Create token pair during login
const tokenPair = await sessionService.createJWTTokenPair(
  'user',
  userId,
  {
    fingerprint: req.headers['x-device-fingerprint'],
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  }
);

res.json({
  accessToken: tokenPair.accessToken,
  refreshToken: tokenPair.refreshToken,
  tokenType: tokenPair.tokenType,
  expiresIn: 900 // 15 minutes
});
```

### Token Refresh

```typescript
// Refresh access token
try {
  const newTokenPair = await sessionService.refreshJWTTokenPair(refreshToken);
  
  res.json({
    accessToken: newTokenPair.accessToken,
    refreshToken: newTokenPair.refreshToken,
    tokenType: newTokenPair.tokenType,
    expiresIn: 900
  });
} catch (error) {
  res.status(401).json({ error: 'Invalid refresh token' });
}
```

### Logout with Token Revocation

```typescript
// Revoke refresh token during logout
await sessionService.revokeRefreshToken(refreshToken, 'logout');

// Or revoke all refresh tokens for the user
await sessionService.revokeAllRefreshTokens('user', userId, 'logout');
```

## Security Considerations

1. **Token Storage**: Refresh tokens are hashed using SHA-256 before database storage
2. **Token Rotation**: When enabled, refresh tokens are rotated on each use to limit exposure
3. **Device Tracking**: Optional device fingerprinting helps detect suspicious activity
4. **Revocation**: Tokens can be immediately revoked for security incidents
5. **Cleanup**: Expired tokens are automatically cleaned up to prevent database bloat

## Backward Compatibility

The refresh token implementation is fully backward compatible with existing JWT functionality:

- Existing `createJWTSession()` method continues to work
- Existing `verifyJWTSession()` method continues to work
- All existing JWT plugin steps continue to work
- New functionality is additive and optional

## Migration Guide

To enable refresh token functionality in an existing JWT setup:

1. **Update Database Schema**: Add the `refresh_tokens` table
2. **Update Plugin Configuration**: Add refresh token settings to JWT plugin config
3. **Update Application Code**: Use new token pair methods instead of single token methods
4. **Update Client Code**: Handle refresh token storage and rotation

## Cleanup Tasks

The JWT plugin automatically registers cleanup tasks:

- **Expired JWKS Keys**: Removes expired signing keys
- **Blacklisted Tokens**: Removes old blacklisted tokens
- **Expired Refresh Tokens**: Removes expired refresh tokens

Cleanup intervals are configurable through the plugin configuration.