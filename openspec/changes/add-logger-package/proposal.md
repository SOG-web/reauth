## Why

The ReAuth monorepo currently lacks a centralized logging solution. Individual packages use basic `console.log` statements scattered throughout the codebase, making debugging and monitoring difficult. A unified logger package will provide:

- Consistent logging format across all packages
- Tag-based filtering for focused debugging
- Beautiful terminal output for development
- Structured logging for production environments
- Future-ready architecture for advanced terminal UI features

## What Changes

- **ADDED** new `@re-auth/logger` package in the monorepo
- **ADDED** tag-based logging system with external control
- **ADDED** dual-mode output (pretty terminal + structured JSON)
- **ADDED** environment variable support for tag filtering
- **ADDED** built-in log file management
- **ADDED** modular architecture supporting future TUI extensions
- **MODIFIED** existing packages to use the new logger instead of console.log

## Impact

- **Affected specs**: New logger capability specification
- **Affected code**:
  - New package: `packages/logger/`
  - HTTP adapters: Replace console.log with structured logging
  - Core engine: Add logging for authentication events
  - All packages: Consistent logging interface
- **Dependencies**: Adds `pino` and `chalk` to the project
- **Breaking changes**: None - this is purely additive functionality
