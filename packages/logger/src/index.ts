export { Logger } from './logger.js';
export type {
  LogLevel,
  LoggerOptions,
  LoggerInterface,
  LogMessage,
  FileOutputOptions,
  TimestampFormat,
  CreateDefaultLoggerFunction,
} from './types.js';

import { Logger } from './logger.js';
import type { LoggerOptions, LoggerInterface } from './types.js';

// Factory function for creating default logger instances
export const createDefaultLogger = (
  options?: LoggerOptions,
): LoggerInterface => {
  const defaultOptions: LoggerOptions = {
    prefix: 'ReAuth',
    prefixEnv: 'REAUTH_',
    timestampFormat: 'iso',
    emojis: true,
    ...options, // Override with user-provided options
  };

  return new Logger(defaultOptions);
};

// Create a default logger instance for backward compatibility
export const logger = createDefaultLogger();

// Export the default logger as the main export for easy usage
export default logger;
