## Context

The ReAuth monorepo currently uses basic `console.log` statements for debugging and operational logging across all packages. This creates several problems:

1. **Inconsistent logging**: No standardized format or log levels
2. **No runtime control**: Cannot filter logs by component or operation type
3. **Poor production debugging**: No structured logging for troubleshooting
4. **Debugging overhead**: All logs always output, cluttering development experience

The new `@re-auth/logger` package provides exactly what's needed: tag-based filtering, structured logging, beautiful terminal output, and runtime control.

## Goals / Non-Goals

### Goals

- **Structured Logging**: Replace all console.log with structured, tagged logging
- **Runtime Control**: Enable/disable logging for specific components via environment variables
- **Better Debugging**: Provide clear, categorized logs for different operational scenarios
- **Production Ready**: Structured JSON logging for production environments
- **Developer Experience**: Beautiful terminal output with colors and emojis for development
- **Zero Breaking Changes**: Maintain backward compatibility while adding logging capabilities

### Non-Goals

- **Log Aggregation**: Focus on logging, not log shipping or aggregation
- **Performance Monitoring**: Focus on operational logging, not performance metrics
- **Complex Filtering**: Keep tag-based filtering simple and straightforward
- **Custom Log Formats**: Use existing logger package formatting capabilities

## Decisions

### Decision: Integrate logger via dependency injection

- **Rationale**: Clean architecture pattern, testable, configurable
- **Alternatives considered**: Global logger instance, factory pattern, direct instantiation
- **Trade-offs**: Slightly more complex setup but better testability and flexibility

### Decision: Add logger to ReAuthCradleExtension

- **Rationale**: Consistent with existing DI pattern, available throughout engine
- **Alternatives considered**: Pass logger as parameter, use global instance
- **Trade-offs**: Integrates cleanly with existing architecture

### Decision: Comprehensive log tags with JSDoc documentation

- **Rationale**: Clear documentation helps developers understand when and why to use each tag
- **Alternatives considered**: Simple tag names without documentation, minimal tags
- **Trade-offs**: More upfront work but better long-term maintainability

### Decision: Environment variable control for log filtering

- **Rationale**: Runtime control without code changes, standard pattern
- **Alternatives considered**: Configuration files, API-based control
- **Trade-offs**: Simple but limited to environment-based control

### Decision: Replace all console.log usage

- **Rationale**: Consistent logging approach across entire codebase
- **Alternatives considered**: Gradual migration, selective replacement
- **Trade-offs**: More work upfront but cleaner final result

## Risks / Trade-offs

### Risk: Increased bundle size

- **Mitigation**: Logger package is lightweight, can be tree-shaken
- **Trade-off**: Minimal size increase for significant logging capabilities

### Risk: Performance impact

- **Mitigation**: Logger is fast, can be disabled via environment variables
- **Trade-off**: Negligible performance cost for better debugging experience

### Risk: Breaking existing debugging workflows

- **Mitigation**: Maintain backward compatibility, provide migration guide
- **Trade-off**: Temporary learning curve for long-term benefits

## Implementation Plan

### Phase 1: Foundation Setup

1. Add logger dependencies to packages
2. Update type definitions and interfaces
3. Add logger to dependency injection container

### Phase 2: Core Integration

1. Update ReAuthEngine to accept logger configuration
2. Update ReAuthHttpAdapter to use logger instance
3. Define comprehensive log tags with documentation

### Phase 3: Console.log Replacement

1. Replace console.log in reauth package (engine, services, plugins)
2. Replace console.log in http-adapters package
3. Update example code and documentation

### Phase 4: Testing & Validation

1. Test logger integration across packages
2. Validate tag-based filtering functionality
3. Ensure no console.log statements remain

## Open Questions

- Should we provide a default logger configuration or require explicit setup?
- How should we handle logger configuration in different environments (dev, test, prod)?
- Should we add log levels beyond the basic info/warn/error/success?
- How should we handle sensitive data in logs (tokens, passwords, etc.)?
- Should we add performance timing logs for authentication operations?
