# Project Context

## Purpose

ReAuth is a **runtime, framework, and protocol-independent** authentication engine for TypeScript/JavaScript applications. It provides a universal authentication solution that works across all JS runtimes and frameworks through a plugin-based architecture with protocol-specific adapters.

Key goals:

- Universal compatibility across Node.js, Deno, Bun, browsers, and edge runtimes
- Protocol-agnostic core engine supporting HTTP, WebSocket, gRPC, or custom protocols
- Framework-independent integration through adapters (Express, Fastify, Hono, etc.)
- Extensible plugin architecture for authentication methods
- Type-safe client SDK generation from runtime introspection

## Tech Stack

### Core Technologies

- **TypeScript** (5.8.2+) - Primary language with strict mode enabled
- **pnpm** (9.0.0) - Package manager and workspace management
- **Turbo** (2.5.3) - Monorepo build system and task orchestration
- **Node.js** (>=18) - Runtime requirement for development

### Build & Development Tools

- **tsup** - TypeScript bundler for dual ESM/CJS builds
- **Vitest** - Testing framework
- **Biome** - Code formatting and linting
- **ESLint** - Code quality with custom configurations
- **Prettier** - Code formatting

### Database & ORM

- **FumaDB** (0.1.0) - Schema management and migrations
- **Kysely** - Type-safe SQL query builder
- **SQLite** - Default database for development/testing

### Authentication & Security

- **JWT** (jose library) - Token-based authentication
- **Arctic** - OAuth 2.0 implementation
- **Argon2** - Password hashing
- **UUID** - Unique identifier generation

### Web Framework Support

- **Next.js** (15.3.0) - React framework for web app
- **Hono** (4.7.10) - Lightweight web framework for HTTP adapters
- **Express/Fastify** - Additional HTTP framework support

### UI & Documentation

- **React** (19.1.0) - UI framework
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first CSS framework
- **Fumadocs** - Documentation system

## Project Conventions

### Code Style

- **Indentation**: 2 spaces (configured in Biome)
- **Quotes**: Double quotes for strings (configured in Biome)
- **TypeScript**: Strict mode enabled with `noImplicitAny: false` for compatibility
- **Import Organization**: Automatic import sorting enabled
- **File Naming**: kebab-case for files, PascalCase for components
- **Variable Naming**: camelCase for variables, PascalCase for types/interfaces

### Architecture Patterns

- **Plugin Architecture**: Extensible authentication methods through plugins
- **Dependency Injection**: Awilix container for clean architecture
- **Protocol Adapter Pattern**: Abstract core engine from protocol concerns
- **Schema Versioning**: Incremental schema evolution with FumaDB
- **Monorepo Structure**: Turborepo-managed packages with workspace dependencies

### Testing Strategy

- **Unit Tests**: Vitest for core engine and plugin testing
- **Type Checking**: `tsc --noEmit` for type validation across packages
- **Linting**: ESLint with custom configurations per package type
- **Integration Tests**: Example applications (hono-test, web) for end-to-end validation

### Git Workflow

- **Branching**: Feature branches with descriptive names
- **Current Branch**: `kilo_test` (active development)
- **Main Branch**: `main` (stable releases)
- **Changesets**: Automated changelog generation and versioning
- **Commit Convention**: Descriptive commits with conventional format

## Domain Context

### Authentication Engine

ReAuth follows a three-layer architecture:

1. **Core Engine** (`@re-auth/reauth`) - Protocol-agnostic authentication logic
2. **Protocol Adapters** (`@re-auth/http-adapters`) - HTTP framework integrations
3. **Client SDKs** (`@re-auth/sdk-generator`) - Type-safe client generation

### Plugin System

- **Email/Password**: Traditional username/password authentication
- **OAuth**: Social login providers (Google, GitHub, etc.)
- **JWT**: Token-based authentication with refresh token support
- **API Keys**: Service-to-service authentication
- **Phone**: SMS-based authentication
- **Passwordless**: Magic link and OTP authentication
- **Anonymous**: Guest user support
- **Organization**: Multi-tenant user management

### Session Management

- **Legacy Sessions**: Database-backed token sessions
- **JWT Sessions**: Stateless JWT with refresh token rotation
- **Session Introspection**: Runtime API discovery and validation
- **Device Tracking**: Optional device fingerprinting and metadata

### Schema Versioning

- **Incremental Changes**: Add authentication methods without breaking existing implementations
- **Migration Support**: Automatic database migrations between schema versions
- **CLI Tools**: Command-line migration management
- **Version Tracking**: Semantic versioning for schema evolution

## Important Constraints

### Runtime Compatibility

- Must work across Node.js, Deno, Bun, browsers, and edge runtimes
- Dual ESM/CJS builds required for universal compatibility
- No Node.js-specific APIs in core engine

### Security Requirements

- Password hashing with Argon2
- JWT token rotation and blacklisting
- Secure key management with JWKS
- Device fingerprinting for security monitoring
- Rate limiting on authentication endpoints

### Performance Considerations

- Stateless JWT verification to reduce database load
- Connection pooling for database operations
- In-memory JWKS caching with TTL
- Async key rotation to avoid blocking operations

### Backward Compatibility

- Legacy token system must remain functional during JWT migration
- Schema versioning ensures smooth upgrades
- Plugin API stability across versions

## External Dependencies

### Core Dependencies

- **FumaDB** - Database schema management and migrations
- **Awilix** - Dependency injection container
- **Jose** - JWT implementation
- **Arctic** - OAuth 2.0 provider integration
- **Kysely** - Type-safe SQL query builder

### Development Dependencies

- **Turbo** - Monorepo build orchestration
- **Changesets** - Automated versioning and changelog generation
- **Biome** - Code formatting and linting
- **Vitest** - Testing framework

### Framework Integrations

- **Hono** - Lightweight web framework
- **Express/Fastify** - Traditional Node.js frameworks
- **Next.js** - React framework for documentation and examples

### Documentation & UI

- **Fumadocs** - Documentation system with MDX support
- **Radix UI** - Accessible React components
- **Tailwind CSS** - Utility-first styling
- **Shiki** - Syntax highlighting for code examples
