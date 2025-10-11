#!/usr/bin/env tsx

/**
 * Example usage of the @re-auth/logger package
 *
 * This demonstrates:
 * - Basic logging with tags
 * - Environment variable tag control
 * - Different log levels
 * - File output
 * - Runtime tag control
 * - Pino-pretty integration
 * - Human-readable timestamps
 * - Optional emojis
 * - Customizable default logger factory
 */

import { createDefaultLogger } from './index.js';
import { Logger } from './logger.js';

// Example 1: Basic logger with default settings (uses pino-pretty)
console.log('=== Example 1: Basic Logger with Pino-Pretty ===');
const basicLogger = new Logger({ prefix: 'MyApp' });

basicLogger.info('network', 'Starting server on port 3000');
basicLogger.warn('auth', 'Token will expire in 5 minutes');
basicLogger.error('database', 'Connection failed, retrying...');
basicLogger.success('startup', 'Application started successfully');

// Example 2: Logger with specific enabled tags
console.log('\n=== Example 2: Tag Filtering ===');
const filteredLogger = new Logger({
  enabledTags: ['network', 'auth'],
  prefix: 'FilteredApp',
});

filteredLogger.info('network', 'This will appear');
filteredLogger.info('auth', 'This will also appear');
filteredLogger.info('database', 'This will NOT appear');

// Example 3: Multiple tags
console.log('\n=== Example 3: Multiple Tags ===');
const multiTagLogger = new Logger({
  enabledTags: ['auth', 'session'],
  prefix: 'MultiTag',
});

multiTagLogger.warn(['auth', 'session'], 'User session expired');
multiTagLogger.info(['network', 'api'], 'API call completed'); // Won't appear

// Example 4: Runtime tag control
console.log('\n=== Example 4: Runtime Tag Control ===');
const runtimeLogger = new Logger({ prefix: 'Runtime' });

runtimeLogger.info('initial', 'Initial message'); // Won't appear (no tags enabled)

runtimeLogger.setEnabledTags(['initial', 'runtime']);
runtimeLogger.info('initial', 'Now this appears!');
runtimeLogger.info('runtime', 'And this too!');

// Example 5: Environment variable control
console.log('\n=== Example 5: Environment Variable Control ===');
// Set environment variable for demonstration
const originalEnv = process.env.REAUTH_DEBUG;
process.env.REAUTH_DEBUG = 'network,api';

const envLogger = new Logger({
  prefix: 'EnvControl',
  prefixEnv: 'REAUTH_',
});

envLogger.info('network', 'Network request'); // Will appear
envLogger.info('api', 'API response'); // Will appear
envLogger.info('database', 'DB query'); // Won't appear

// Restore environment
if (originalEnv) {
  process.env.REAUTH_DEBUG = originalEnv;
} else {
  delete process.env.REAUTH_DEBUG;
}

// Example 6: File output
console.log('\n=== Example 6: File Output ===');
const fileLogger = new Logger({
  prefix: 'FileApp',
  fileOutput: {
    enabled: true,
    fileName: 'example-app.log',
  },
});

fileLogger.info('file', 'This message will be written to example-app.log');
fileLogger.warn('file', 'Warning message also goes to file');

// Example 7: Human-readable timestamps with file output
console.log('\n=== Example 7: Human-Readable Timestamps with File Output ===');
const humanLogger = new Logger({
  prefix: 'HumanTime',
  timestampFormat: 'human',
  fileOutput: {
    enabled: true,
    fileName: 'human-timestamps.log',
  },
});
humanLogger.info('timestamp', 'This uses human-readable timestamps');
humanLogger.warn(
  'timestamp',
  'This warning also goes to file with human timestamps',
);
humanLogger.success('timestamp', 'Success message with human-readable time');

// Example 8: No emojis (professional output)
console.log('\n=== Example 8: No Emojis (Professional Output) ===');
const noEmojiLogger = new Logger({
  prefix: 'Professional',
  emojis: false,
});
noEmojiLogger.info('clean', 'Clean output without emojis');
noEmojiLogger.warn('clean', 'Professional warning message');
noEmojiLogger.error('clean', 'Clean error message');

// Example 9: Custom default logger factory
console.log('\n=== Example 9: Custom Default Logger Factory ===');
const customLogger = createDefaultLogger({
  prefix: 'CustomApp',
  prefixEnv: 'CUSTOM_',
  timestampFormat: 'human',
  emojis: false,
});
customLogger.info('factory', 'Created with custom factory function');

// Example 10: Production mode (JSON output)
console.log('\n=== Example 10: Production Mode ===');
const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';

const prodLogger = new Logger({ prefix: 'Production' });
prodLogger.info('prod', 'This will output as JSON');

// Restore environment
if (originalNodeEnv) {
  process.env.NODE_ENV = originalNodeEnv;
} else {
  delete process.env.NODE_ENV;
}

// Cleanup
basicLogger.destroy();
filteredLogger.destroy();
multiTagLogger.destroy();
runtimeLogger.destroy();
envLogger.destroy();
fileLogger.destroy();
humanLogger.destroy();
noEmojiLogger.destroy();
customLogger.destroy();
prodLogger.destroy();

console.log('\n=== Examples Complete ===');
