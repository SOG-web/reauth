## Context

The ReAuth monorepo currently uses basic `console.log` statements for debugging across multiple packages. This creates inconsistent logging, makes debugging difficult, and provides no structured output for production environments. A centralized logging solution is needed that:

- Works across all packages in the monorepo
- Provides consistent, beautiful output for development
- Supports structured logging for production
- Allows focused debugging through tag-based filtering
- Maintains library safety (no global state pollution)
- Can be extended with advanced terminal UI features

## Goals / Non-Goals

### Goals

- **Consistency**: Uniform logging format across all ReAuth packages
- **Developer Experience**: Beautiful, colorized terminal output with emojis and timestamps
- **Production Ready**: Structured JSON logging with pino for performance
- **Flexibility**: Tag-based filtering for focused debugging
- **Library Safety**: No global state, safe for use in libraries
- **Modularity**: Core logger lightweight, optional TUI extensions
- **Runtime Control**: Environment variable and programmatic tag control
- **Log Persistence**: built-in log file management

### Non-Goals

- **Log Aggregation**: No centralized log collection
- **Performance Monitoring**: No metrics or performance tracking
- **Complex Filtering**: No advanced query syntax or regex filtering
- **Multi-Process Logging**: No distributed logging across processes

## Decisions

### Decision: Use pino as the underlying structured logger

- **Rationale**: High performance, battle-tested, JSON structured logging
- **Alternatives considered**: winston (heavier), bunyan (deprecated), custom solution
- **Trade-offs**: Adds dependency but provides production-grade structured logging

### Decision: Use chalk for terminal styling

- **Rationale**: Lightweight, widely adopted, excellent TypeScript support
- **Alternatives considered**: kleur (smaller), colors (unmaintained), ansi-colors
- **Trade-offs**: Slightly larger bundle but better ecosystem support

### Decision: Tag-based filtering system

- **Rationale**: Simple, intuitive, allows focused debugging
- **Alternatives considered**: Log levels only, category-based, regex filtering
- **Trade-offs**: Less flexible than regex but much simpler to use

### Decision: Dual-mode output (pretty vs JSON)

- **Rationale**: Best of both worlds - beautiful dev experience, structured production logs
- **Alternatives considered**: Single mode, multiple formatters, configurable output
- **Trade-offs**: Slightly more complex but provides optimal experience for each environment

### Decision: Modular architecture with optional TUI extensions

- **Rationale**: Keeps core lightweight while allowing future rich terminal features
- **Alternatives considered**: Monolithic design, separate packages, plugin system
- **Trade-offs**: More complex architecture but better separation of concerns

### Decision: Basic log file management

- **Rationale**: Provides essential persistence capabilities without external dependencies
- **Alternatives considered**: External log management tools, database logging, cloud logging
- **Trade-offs**: Simple implementation for basic file output needs

## Risks / Trade-offs

### Risk: Bundle size increase

- **Mitigation**: Use tree-shaking, optional TUI module, minimal dependencies
- **Trade-off**: Slightly larger bundles for significantly better debugging experience

### Risk: Performance impact in production

- **Mitigation**: JSON mode is optimized for performance, tag filtering reduces overhead
- **Trade-off**: Minimal performance cost for structured logging benefits

### Risk: Learning curve for tag-based filtering

- **Mitigation**: Clear documentation, examples, intuitive API design
- **Trade-off**: Slight complexity increase for much better debugging control

### Risk: Dependency on external packages (pino, chalk)

- **Mitigation**: Well-maintained packages, pin versions, have fallbacks
- **Trade-off**: External dependencies for proven, maintained solutions

### Risk: Log file management complexity

- **Mitigation**: Keep implementation simple, comprehensive testing, clear configuration
- **Trade-off**: Minimal complexity for basic persistence capabilities

## Migration Plan

### Phase 1: Core Implementation

1. Create logger package with basic functionality
2. Implement tag-based filtering and dual-mode output
3. Add comprehensive tests and documentation

### Phase 2: Integration

1. Replace console.log in HTTP adapters
2. Add logging to core engine authentication events
3. Update other packages to use the logger

### Phase 3: Enhancement

1. Add TUI extension module (optional)
2. Optimize performance and bundle size
3. Add advanced features based on usage feedback

## Open Questions

- Should we support log levels (debug, info, warn, error) in addition to tags?
- What should be the default tag set for ReAuth packages?
- What should be the default log file naming pattern?
- Should we support different log file formats (JSON, plain text, both)?
- How should we handle log context (request IDs, user IDs, etc.)?
