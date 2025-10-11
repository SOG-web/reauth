## Context

The current logger package provides a hardcoded default logger instance with fixed configuration (prefix: 'ReAuth', prefixEnv: 'REAUTH\_'). Users need flexibility to create logger instances with their own prefixes and environment variable names. Additionally, the current implementation uses console.log for terminal output instead of fully leveraging pino's powerful transport system. The package should embrace pino-pretty for beautiful terminal output and make emojis optional for cleaner, more professional log formatting.

## Goals / Non-Goals

### Goals

- **Pino-Centric Architecture**: Fully embrace pino as the logging engine with proper transport configuration
- **Beautiful Terminal Output**: Use pino-pretty for development terminal formatting
- **Flexibility**: Allow users to create logger instances with custom prefix and prefixEnv
- **Optional Emojis**: Make emoji display configurable for different preferences
- **Better Developer Experience**: Provide human-readable timestamp formatting option
- **Backward Compatibility**: Maintain existing default logger behavior
- **Configuration Options**: Support both ISO and human-readable timestamp formats
- **Factory Pattern**: Provide factory function for creating default logger instances

### Non-Goals

- **Console.log Usage**: Remove direct console.log usage in favor of pino transports
- **Complex Date Libraries**: Avoid adding heavy date manipulation dependencies
- **Multiple Timezone Support**: Keep timestamp formatting simple and local
- **Custom Date Formats**: Focus on predefined human-readable format
- **Performance Optimization**: Prioritize developer experience over micro-optimizations

## Decisions

### Decision: Fully embrace pino with pino-pretty for terminal output

- **Rationale**: Leverages pino's powerful transport system and pino-pretty's beautiful formatting
- **Alternatives considered**: Continue using console.log, custom formatting, other log formatters
- **Trade-offs**: Removes console.log flexibility but provides professional, consistent formatting

### Decision: Make emojis optional in log output

- **Rationale**: Allows users to choose between fun/colorful vs professional/clean log output
- **Alternatives considered**: Always show emojis, never show emojis, custom emoji sets
- **Trade-offs**: More configuration but better flexibility for different use cases

### Decision: Add timestamp format configuration option

- **Rationale**: Provides flexibility while maintaining backward compatibility
- **Alternatives considered**: Always use human-readable, separate timestamp toggle, custom format strings
- **Trade-offs**: Slightly more complex configuration but better user experience

### Decision: Use factory pattern for default logger

- **Rationale**: Allows customization while maintaining convenience of default export
- **Alternatives considered**: Remove default logger, require explicit instantiation, global configuration
- **Trade-offs**: More API surface but better flexibility and backward compatibility

### Decision: Simple human-readable timestamp format

- **Rationale**: Easy to read and parse, no external dependencies
- **Alternatives considered**: Complex formats, timezone-aware formats, customizable formats
- **Trade-offs**: Less flexible but simpler implementation and better performance

## Risks / Trade-offs

### Risk: Increased API complexity

- **Mitigation**: Keep new options optional with sensible defaults
- **Trade-off**: More configuration options for better flexibility

### Risk: Breaking changes in timestamp format

- **Mitigation**: Default to ISO format for backward compatibility
- **Trade-off**: New format is opt-in to avoid breaking existing usage

### Risk: Performance impact of timestamp formatting

- **Mitigation**: Use efficient native Date methods, cache formatted timestamps
- **Trade-off**: Minimal performance cost for better developer experience

## Implementation Plan

### Phase 1: Pino-Centric Architecture

1. Remove console.log usage and embrace pino transports
2. Integrate pino-pretty for beautiful terminal output
3. Add optional emoji configuration
4. Add timestamp format options to LoggerOptions

### Phase 2: Enhanced Configuration

1. Implement human-readable timestamp formatting
2. Update Logger class to support configurable timestamps and emojis
3. Create factory function for default logger instances

### Phase 3: Factory Pattern & Testing

1. Update default export to use factory
2. Add comprehensive tests for new features
3. Update documentation and examples
4. Validate backward compatibility

## Open Questions

- Should we support multiple timestamp formats simultaneously?
- What should be the default timestamp format for new logger instances?
- Should we add timezone information to human-readable timestamps?
- How should we handle timestamp formatting in production mode?
