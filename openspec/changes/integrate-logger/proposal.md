## Why

The ReAuth monorepo currently uses `console.log`, `console.warn`, and `console.error` statements throughout the codebase for debugging and operational logging. This approach has several limitations:

- **Inconsistent logging**: No standardized format, tags, or log levels across packages
- **No runtime control**: Cannot dynamically enable/disable logging for specific components
- **Poor debugging experience**: No structured logging for production troubleshooting
- **No log filtering**: All logs are always output, making it hard to focus on specific issues
- **Missing context**: No consistent way to track requests, sessions, or plugin operations

The new `@re-auth/logger` package provides tag-based filtering, beautiful terminal output, structured JSON logging, and runtime control - exactly what's needed for a professional authentication system.

## What Changes

- **ADDED** logger dependency to `@re-auth/reauth` and `@re-auth/http-adapters` packages
- **ADDED** logger instance to `ReAuthCradleExtension` interface for dependency injection
- **ADDED** logger instance to `ReAuthHttpAdapter` class for HTTP-specific logging
- **ADDED** comprehensive log tags with JSDoc documentation for all logging scenarios
- **REPLACED** all `console.log`, `console.warn`, `console.error` statements with structured logger calls
- **ADDED** logger configuration options to engine and adapter constructors
- **ADDED** tag-based log filtering for different operational scenarios (auth, session, plugin, etc.)

## Impact

- **Affected specs**: Logger integration specification, HTTP adapter logging specification
- **Affected code**:
  - `ReAuthCradleExtension` interface in `packages/reauth/src/types.ts`
  - `ReAuthHttpAdapter` class in `packages/http-adapters/src/base-adapter.ts`
  - All console.log usage across reauth and http-adapters packages (~80 instances)
  - Engine initialization and configuration
- **Dependencies**: Adds `@re-auth/logger` to reauth and http-adapters packages
- **Breaking changes**: None - all changes are additive and backward compatible
- **Performance**: Minimal impact - logger is lightweight and can be disabled via environment variables
