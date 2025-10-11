## Why

The current logger package has a hardcoded default logger instance with fixed prefix ('ReAuth') and prefixEnv ('REAUTH\_'). Users need the flexibility to create their own logger instances with custom prefixes and environment variable names. Additionally, the current implementation uses console.log for terminal output instead of fully embracing pino's capabilities. The package should leverage pino-pretty for beautiful terminal output and make emojis optional for cleaner log formatting.

## What Changes

- **MODIFIED** Logger class to fully embrace pino as the logging engine
- **ADDED** pino-pretty integration for beautiful terminal output
- **MODIFIED** LoggerOptions interface to support customizable prefixEnv and prefix defaults
- **MODIFIED** default logger instance to be configurable rather than hardcoded
- **ADDED** optional emoji configuration for log messages
- **ADDED** human-readable timestamp formatting option
- **REMOVED** console.log usage in favor of pino's transport system
- **ADDED** configuration options for emoji display and timestamp formatting

## Impact

- **Affected specs**: Logger capability specification updates
- **Affected code**:
  - Logger class implementation (pino-centric)
  - Logger types and interfaces
  - Default logger instance creation
  - Terminal output formatting (pino-pretty)
  - Configuration options
- **Dependencies**: Adds pino-pretty to existing pino dependency
- **Breaking changes**: None - all changes are backward compatible and additive
