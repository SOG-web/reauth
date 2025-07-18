# Project Structure

## Monorepo Organization

```
reauth/
├── apps/                    # Application examples and demos
│   ├── hono-test/          # HTTP protocol integration example with Hono
│   └── web/                # Next.js web application demo with HTTP client
├── packages/               # Reusable packages and libraries
│   ├── reauth/             # Core protocol-agnostic authentication engine
│   ├── http-adapters/      # HTTP protocol adapters (Express, Fastify, Hono)
│   ├── sdk-generator/      # Client SDK generation tool for HTTP protocol
│   ├── eslint-config/      # Shared ESLint configurations
│   ├── typescript-config/  # Shared TypeScript configurations
│   └── ui/                 # Shared React components
├── api-doc/                # HTTP API documentation (Bruno collections)
└── .changeset/             # Version management and changelog
```

## Core Package Architecture

### packages/reauth/ (Protocol-Agnostic Core)

```
src/
├── auth-engine.ts          # Main ReAuthEngine class (protocol-independent)
├── types.ts                # Core type definitions (protocol-agnostic)
├── lib/                    # Utility libraries
├── plugins/                # Authentication plugins (protocol-independent)
│   ├── email-password/     # Email/password authentication
│   ├── oauth/              # OAuth providers (Google, GitHub, etc.)
│   ├── session/            # Session management (protocol-agnostic)
│   ├── admin/              # Admin functionality
│   └── utils/              # Plugin utilities
└── utils/                  # General utilities
```

### packages/http-adapters/ (HTTP Protocol Implementation)

```
src/
├── adapters/
│   ├── express/            # Express.js HTTP adapter
│   ├── fastify/            # Fastify HTTP adapter
│   └── hono/               # Hono HTTP adapter
├── types/                  # HTTP adapter type definitions
└── utils/                  # HTTP adapter utilities and factory
```

## Architecture Principles

### Separation of Concerns

- **Core Engine**: Protocol-agnostic authentication logic
- **Protocol Adapters**: Protocol-specific communication handling
- **Framework Adapters**: Framework-specific integration within protocols
- **Application Examples**: Real-world usage demonstrations

### Adapter Pattern Implementation

- Core engine defines abstract interfaces (EntityService, SessionService)
- Protocol adapters implement protocol-specific communication
- Framework adapters handle framework-specific details within protocols
- Clean separation allows for multiple protocol implementations

## Naming Conventions

### Packages

- Core packages: `@re-auth/package-name`
- Internal packages: `@repo/package-name`
- Scoped publishing with public access

### Files & Directories

- kebab-case for directories and files
- `.plugin.ts` suffix for plugin implementations
- `.adapter.ts` suffix for protocol/framework adapters
- `.spec.ts` suffix for test files
- `index.ts` for package entry points

### Code Structure

- **Plugin-based architecture**: Authentication methods as plugins
- **Protocol independence**: Core engine works with any protocol
- **Dependency injection**: Clean architecture using Awilix container
- **Interface segregation**: Abstract services for different concerns
- **Plugin interface**: Each plugin implements `AuthPlugin` interface
- **Step definitions**: Discrete authentication flows within plugins
- **Hook system**: Before/after/error handling for extensibility

## Configuration Files

### Package-level

- `package.json` - Package metadata and scripts
- `tsconfig.json` - TypeScript configuration
- `tsconfig.esm.json` / `tsconfig.cjs.json` - Build-specific configs

### Workspace-level

- `turbo.json` - Turborepo task configuration
- `pnpm-workspace.yaml` - Workspace package definitions
- `.changeset/config.json` - Version management settings

## Development Patterns

### Plugin Development (Protocol-Agnostic)

- Object-based plugins for simple cases (no `this` usage)
- Class-based plugins for stateful implementations
- Standard Schema validation support
- Protocol-independent step definitions
- Dependency injection through Awilix container

### Protocol Adapter Development

- Implement `FrameworkAdapter` interface for HTTP protocol
- Handle protocol-specific request/response patterns
- Abstract framework differences within protocol
- Support auto-introspection and route generation

### Package Exports

- Dual ESM/CJS builds for universal compatibility
- Subpath exports for granular imports
- TypeScript declaration maps for debugging
- Protocol-specific exports in adapter packages

## Extension Points

### Adding New Protocols

1. Create new protocol adapter package (e.g., `@re-auth/websocket-adapters`)
2. Implement protocol-specific adapter interfaces
3. Handle protocol-specific communication patterns
4. Integrate with core engine through standard interfaces

### Adding New Authentication Methods

1. Create plugin implementing `AuthPlugin` interface
2. Define authentication steps with protocol-agnostic logic
3. Use dependency injection for external services
4. Register plugin with core engine
