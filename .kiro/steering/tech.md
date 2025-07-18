# Technology Stack

## Build System & Package Management

- **Monorepo**: Turborepo for build orchestration and caching
- **Package Manager**: pnpm with workspaces
- **Node.js**: >= 18 required (but ReAuth works in all JS runtimes)
- **TypeScript**: 5.8.2 across all packages

## Core Architecture

- **Runtime Agnostic**: Works in Node.js, Deno, Bun, browsers, edge runtimes
- **Protocol Independent**: Core engine separate from protocol implementations
- **Framework Universal**: Adapter pattern for any framework integration
- **Language**: TypeScript with strict type checking for universal compatibility
- **Dependency Injection**: Awilix container system for clean architecture
- **Validation**: Standard Schema spec with ArkType for universal validation

## Core Engine Technologies

- **Authentication Engine**: Protocol-agnostic plugin-based system
- **Plugin System**: Extensible authentication methods and flows
- **Session Management**: Protocol-independent session handling
- **Entity Management**: Abstract entity service interface
- **Introspection**: Automatic API discovery and SDK generation
- **Migration System**: Database-agnostic schema management

## Protocol Adapters

- **HTTP Adapters**: Express, Fastify, Hono framework integrations
- **Adapter Factory**: Generic pattern for creating protocol adapters
- **Context Rules**: Protocol-specific request/response handling
- **Auto-Routing**: Automatic route generation from plugin introspection
- **Framework Abstraction**: Unified interface across different frameworks

## Development Tools

- **Linting**: ESLint with custom configs
- **Formatting**: Prettier
- **Testing**: Vitest for unit tests
- **Build**: TypeScript compiler with dual ESM/CJS output
- **Changesets**: For version management and publishing

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Start development mode (all packages)
pnpm dev

# Build all packages
pnpm build

# Run linting
pnpm lint

# Format code
pnpm format

# Type checking
pnpm check-types
```

### Testing

```bash
# Run tests (in package directory)
pnpm test

# Watch mode
pnpm test:watch
```

### Package Management

```bash
# Add dependency to specific package
pnpm add <package> --filter <workspace>

# Generate SDK client (HTTP protocol)
pnpm generate:sdk

# Release workflow
pnpm release
```

## Package Structure

- **Core Engine**: Protocol-agnostic authentication logic
- **Protocol Adapters**: Protocol-specific implementations
- **Examples**: Framework-specific integration demonstrations
- **Dual Build**: ESM/CJS output for universal compatibility
- **TypeScript Declarations**: Full type support across environments
- **Subpath Exports**: Granular imports for tree-shaking
- **Workspace Dependencies**: Internal package linking with `workspace:*`

## Architecture Patterns

- **Adapter Pattern**: Protocol adapters implement common interface
- **Plugin System**: Authentication methods as composable plugins
- **Dependency Injection**: Services injected through Awilix container
- **Factory Pattern**: Generic adapter creation for any protocol
- **Introspection**: Runtime API discovery for tooling and SDK generation
