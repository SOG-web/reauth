# Logger Migration Guide

This guide helps migrate existing `console.log` usage to the new `@re-auth/logger` package.

## Migration Overview

The new logger provides:

- Tag-based filtering for focused debugging
- Beautiful terminal output with colors and emojis
- Structured JSON logging for production
- Environment variable control
- Optional file output

## Step-by-Step Migration

### 1. Install the Logger Package

```bash
# In your package.json, add:
"@re-auth/logger": "workspace:*"
```

### 2. Replace Basic Console Logs

#### Before:

```typescript
console.log('Starting server...');
console.warn('Token expired');
console.error('Database connection failed');
```

#### After:

```typescript
import { logger } from '@re-auth/logger';

logger.info('startup', 'Starting server...');
logger.warn('auth', 'Token expired');
logger.error('database', 'Database connection failed');
```

### 3. Add Meaningful Tags

Choose descriptive tags that help with debugging:

```typescript
// Good tags
logger.info('network', 'Request sent');
logger.info('auth', 'User authenticated');
logger.info('database', 'Query executed');
logger.info('cache', 'Cache miss');

// Avoid generic tags
logger.info('debug', 'Something happened'); // Too vague
logger.info('log', 'Logging'); // Redundant
```

### 4. Environment Variable Control

Set up environment variables for different environments:

```bash
# Development - show everything
export REAUTH_DEBUG=*

# Production - show only errors
export REAUTH_DEBUG=error

# Debugging specific areas
export REAUTH_DEBUG=network,auth
```

## Specific Migration Examples

### HTTP Adapters

#### Current console.log usage in base-adapter.ts:

```typescript
console.log('no token in getCurrentUser', req.path, req.headers);
console.log('session check failed', req.headers, error);
```

#### Migrated version:

```typescript
import { logger } from '@re-auth/logger';

logger.warn('auth', 'No token in getCurrentUser', {
  path: req.path,
  headers: req.headers,
});

logger.error('session', 'Session check failed', {
  headers: req.headers,
  error: error.message,
});
```

### Core Engine

#### Before:

```typescript
console.log('User login attempt:', userId);
console.error('Authentication failed:', error);
```

#### After:

```typescript
import { logger } from '@re-auth/logger';

logger.info('auth', 'User login attempt', { userId });
logger.error('auth', 'Authentication failed', {
  userId,
  error: error.message,
});
```

### SDK Generator

#### Before:

```typescript
console.log('Generating SDK for:', url);
console.warn('Deprecated endpoint detected');
```

#### After:

```typescript
import { logger } from '@re-auth/logger';

logger.info('sdk', 'Generating SDK for URL', { url });
logger.warn('sdk', 'Deprecated endpoint detected', { endpoint });
```

## Tag Naming Conventions

### Recommended Tags

- **`network`** - HTTP requests, API calls, network operations
- **`auth`** - Authentication, authorization, sessions
- **`database`** - Database queries, connections, transactions
- **`cache`** - Cache operations, hits, misses
- **`sdk`** - SDK generation, client operations
- **`startup`** - Application initialization, server startup
- **`config`** - Configuration loading, validation
- **`session`** - Session management, token handling

### Tag Combinations

For complex operations, use multiple tags:

```typescript
// User authentication flow
logger.info(['auth', 'session'], 'User authenticated', { userId });

// API request with caching
logger.info(['network', 'cache'], 'API request cached', { endpoint });

// Database operation with auth context
logger.info(['database', 'auth'], 'User data retrieved', { userId });
```

## Environment Configuration

### Development

```bash
# Show all logs for debugging
export REAUTH_DEBUG=*

# Or focus on specific areas
export REAUTH_DEBUG=network,auth,database
```

### Production

```bash
# Show only errors and warnings
export REAUTH_DEBUG=error,warn

# Or disable all logging
export REAUTH_DEBUG=""
```

### Testing

```bash
# Show test-related logs only
export REAUTH_DEBUG=test,setup
```

## File Output Configuration

For persistent logging, configure file output:

```typescript
import { Logger } from '@re-auth/logger';

const logger = new Logger({
  prefix: 'ReAuth',
  fileOutput: {
    enabled: true,
    filePath: './logs',
    fileName: 'reauth-{date}.log',
  },
});
```

## Migration Checklist

- [ ] Install `@re-auth/logger` package
- [ ] Replace `console.log` with `logger.info(tag, message)`
- [ ] Replace `console.warn` with `logger.warn(tag, message)`
- [ ] Replace `console.error` with `logger.error(tag, message)`
- [ ] Add meaningful tags to all log statements
- [ ] Set up environment variable control
- [ ] Test log filtering in different environments
- [ ] Configure file output if needed
- [ ] Update documentation with new logging approach

## Common Patterns

### Request/Response Logging

```typescript
logger.info('network', 'Request received', {
  method: req.method,
  path: req.path,
  userAgent: req.headers['user-agent'],
});

logger.info('network', 'Response sent', {
  statusCode: res.statusCode,
  duration: Date.now() - startTime,
});
```

### Error Logging with Context

```typescript
try {
  await authenticateUser(credentials);
} catch (error) {
  logger.error('auth', 'Authentication failed', {
    userId: credentials.email,
    error: error.message,
    stack: error.stack,
  });
  throw error;
}
```

### Performance Logging

```typescript
const startTime = Date.now();
await databaseQuery();
const duration = Date.now() - startTime;

logger.info('database', 'Query completed', {
  duration,
  query: queryType,
});
```

## Troubleshooting

### Logs Not Appearing

1. Check if the tag is enabled:

   ```bash
   echo $REAUTH_DEBUG
   ```

2. Enable all tags temporarily:

   ```bash
   export REAUTH_DEBUG=*
   ```

3. Check logger configuration:
   ```typescript
   const logger = new Logger({ enabledTags: ['your-tag'] });
   ```

### File Output Not Working

1. Check file permissions
2. Verify directory exists
3. Check logger configuration:
   ```typescript
   const logger = new Logger({
     fileOutput: { enabled: true, filePath: './logs' },
   });
   ```

## Benefits After Migration

- **Focused Debugging**: Filter logs by tags to see only relevant information
- **Production Ready**: Structured JSON logs for log aggregation systems
- **Environment Control**: Different log levels for different environments
- **Better Developer Experience**: Colorized, formatted logs with emojis
- **Consistent Formatting**: Uniform log format across all packages
