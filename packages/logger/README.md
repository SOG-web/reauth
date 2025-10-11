# @re-auth/logger

A tag-based logging package with beautiful terminal output and structured JSON logging for the ReAuth monorepo.

## Features

- 🏷️ **Tag-based filtering** - Control which log messages appear using tags
- 🎨 **Beautiful terminal output** - Powered by pino-pretty with colorized logs
- 📄 **Structured JSON logging** - Production-ready structured logs with pino
- 🌍 **Environment variable control** - Configure tags via environment variables
- 📁 **File output** - Optional log file persistence
- 🔧 **Library-safe** - No global state, safe for use in libraries
- 📦 **TypeScript support** - Full type definitions included
- ⏰ **Human-readable timestamps** - Optional human-readable timestamp formatting
- 🎭 **Optional emojis** - Choose between fun and professional output styles
- 🏭 **Factory pattern** - Create customizable default logger instances

## Quick Start

```typescript
import { Logger } from '@re-auth/logger';

// Create a logger instance
const logger = new Logger({ prefix: 'MyApp' });

// Log with tags
logger.info('network', 'Connecting to server...');
logger.warn(['auth', 'session'], 'Token expired');
logger.error('database', 'Connection failed');
logger.success('startup', 'Application ready');
```

## Configuration

### Basic Options

```typescript
const logger = new Logger({
  prefix: 'MyApp', // Prefix for log messages
  enabledTags: ['network'], // Initially enabled tags
  prefixEnv: 'MYAPP_', // Environment variable prefix
  timestamp: true, // Include timestamps
  timestampFormat: 'iso', // 'iso' or 'human' timestamp format
  emojis: true, // Enable emoji indicators
  fileOutput: {
    // Optional file output
    enabled: true,
    filePath: './logs',
    fileName: 'app.log',
  },
});
```

### Environment Variable Control

Set environment variables to control which tags are enabled:

```bash
# Enable specific tags
export MYAPP_DEBUG=network,auth

# Enable all tags
export MYAPP_DEBUG=*

# Multiple tags
export MYAPP_DEBUG=network,auth,database
```

## API Reference

### Logger Class

#### Constructor Options

```typescript
interface LoggerOptions {
  prefix?: string; // Prefix for log messages
  enabledTags?: string[]; // Initially enabled tags
  prefixEnv?: string; // Environment variable prefix
  timestamp?: boolean; // Include timestamps (default: true)
  timestampFormat?: 'iso' | 'human'; // Timestamp format (default: 'iso')
  emojis?: boolean; // Enable emoji indicators (default: true)
  fileOutput?: FileOutputOptions;
}
```

#### Logging Methods

```typescript
// Single tag
logger.info('network', 'Message');

// Multiple tags
logger.warn(['auth', 'session'], 'Message');

// All log levels
logger.info(tag, ...args); // ℹ️ Blue
logger.warn(tag, ...args); // ⚠️ Yellow
logger.error(tag, ...args); // ❌ Red
logger.success(tag, ...args); // ✅ Green
```

#### Control Methods

```typescript
// Enable/disable tags at runtime
logger.setEnabledTags(['network', 'auth']);

// Clean up resources
logger.destroy();
```

### Factory Function

Create customizable default logger instances:

```typescript
import { createDefaultLogger } from '@re-auth/logger';

// Create a custom default logger
const logger = createDefaultLogger({
  prefix: 'MyApp',
  prefixEnv: 'MYAPP_',
  timestampFormat: 'human',
  emojis: false,
});

logger.info('custom', 'Created with factory function');
```

### File Output Options

```typescript
interface FileOutputOptions {
  enabled: boolean; // Enable file output
  filePath?: string; // Directory for log files
  fileName?: string; // Log file name pattern
}
```

## Usage Examples

### Basic Usage

```typescript
import { Logger } from '@re-auth/logger';

const logger = new Logger({ prefix: 'MyApp' });

// These will all appear (no tag filtering)
logger.info('startup', 'Application starting...');
logger.warn('config', 'Using default configuration');
logger.error('database', 'Failed to connect');
logger.success('ready', 'Server listening on port 3000');
```

### Tag Filtering

```typescript
const logger = new Logger({
  enabledTags: ['network', 'auth'],
});

logger.info('network', 'Request sent'); // ✅ Will appear
logger.info('auth', 'User logged in'); // ✅ Will appear
logger.info('database', 'Query executed'); // ❌ Won't appear
```

### Environment Variable Control

```typescript
// Set REAUTH_DEBUG=network,auth
const logger = new Logger({
  prefixEnv: 'REAUTH_',
  prefix: 'AuthService',
});

logger.info('network', 'API call'); // ✅ Will appear
logger.info('auth', 'Login attempt'); // ✅ Will appear
logger.info('cache', 'Cache hit'); // ❌ Won't appear
```

### Human-Readable Timestamps

```typescript
const logger = new Logger({
  timestampFormat: 'human', // Use human-readable timestamps
});

logger.info('time', 'This uses human-readable timestamps');
// Output: [11:09pm 30 Sep 2025][MyApp] [time] ℹ️ This uses human-readable timestamps
```

### Optional Emojis

```typescript
// Professional output without emojis
const logger = new Logger({
  emojis: false,
});

logger.info('clean', 'Clean professional output');
logger.warn('clean', 'Professional warning message');
// Output: [timestamp][prefix] [tag] Clean professional output
```

### File Output

```typescript
const logger = new Logger({
  fileOutput: {
    enabled: true,
    filePath: './logs',
    fileName: 'app-{date}.log',
  },
});

logger.info('file', 'This goes to console and file');
```

### Multiple Logger Instances

```typescript
// Each logger maintains independent state
const networkLogger = new Logger({
  prefix: 'Network',
  enabledTags: ['network'],
});

const authLogger = new Logger({
  prefix: 'Auth',
  enabledTags: ['auth'],
});

// These loggers work independently
networkLogger.info('network', 'Request sent');
authLogger.info('auth', 'User authenticated');
```

## Output Formats

### Development Mode (NODE_ENV !== 'production')

Powered by pino-pretty for beautiful terminal output:

```
[2025-01-11 12:34:56.789 +0100] INFO: Connecting to server...
    tags: ["network"]
    message: "Connecting to server..."
    prefix: "MyApp"
    emoji: "ℹ️"

[2025-01-11 12:34:56.790 +0100] WARN: Token will expire in 5 minutes
    tags: ["auth"]
    message: "Token will expire in 5 minutes"
    prefix: "MyApp"
    emoji: "⚠️"

[2025-01-11 12:34:56.791 +0100] ERROR: Connection failed, retrying...
    tags: ["database"]
    message: "Connection failed, retrying..."
    prefix: "MyApp"
    emoji: "❌"

[2025-01-11 12:34:56.792 +0100] INFO: Application started successfully
    tags: ["startup"]
    message: "Application started successfully"
    prefix: "MyApp"
    emoji: "✅"
```

### Production Mode (NODE_ENV === 'production')

```json
{"level":"info","tags":["network"],"message":"Connecting to server...","timestamp":"2025-01-11T12:34:56.789Z","prefix":"MyApp"}
{"level":"warn","tags":["auth","session"],"message":"Token will expire in 5 minutes","timestamp":"2025-01-11T12:34:56.790Z","prefix":"MyApp"}
{"level":"error","tags":["database"],"message":"Connection failed, retrying...","timestamp":"2025-01-11T12:34:56.791Z","prefix":"MyApp"}
{"level":"success","tags":["startup"],"message":"Application started successfully","timestamp":"2025-01-11T12:34:56.792Z","prefix":"MyApp"}
```

## Integration with ReAuth

### HTTP Adapters

```typescript
import { logger } from '@re-auth/logger';

// In HTTP adapter middleware
logger.info('http', 'Request received', { method: req.method, path: req.path });
logger.warn('auth', 'Invalid token', { token: req.headers.authorization });
```

### Core Engine

```typescript
import { logger } from '@re-auth/logger';

// In authentication flows
logger.info('auth', 'User login attempt', { userId, method: 'email' });
logger.success('session', 'Session created', { sessionId, userId });
logger.error('auth', 'Login failed', { userId, reason: 'invalid_credentials' });
```

## Best Practices

### Tag Naming

- Use lowercase, descriptive tags: `network`, `auth`, `database`, `cache`
- Use kebab-case for multi-word tags: `api-request`, `user-session`
- Group related functionality: `auth-login`, `auth-logout`, `auth-token`

### Environment Configuration

```bash
# Development - show everything
export REAUTH_DEBUG=*

# Production - show only errors and warnings
export REAUTH_DEBUG=error,warn

# Debugging - focus on specific areas
export REAUTH_DEBUG=network,auth
```

### Performance Considerations

- Tag filtering happens before log formatting, so disabled tags have minimal overhead
- File output is asynchronous and won't block your application
- In production, structured JSON logging is optimized for performance

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run example
pnpm tsx src/example.ts
```

## License

This package is part of the ReAuth monorepo and follows the same license terms.
