# ReAuth

ReAuth is a **runtime, framework, and protocol-independent** authentication engine for TypeScript/JavaScript applications. It provides a universal authentication solution that works across all JS runtimes and frameworks through a plugin-based architecture with protocol-specific adapters.

## 🚀 Getting Started

Choose your integration approach based on your needs:

### For HTTP-based Applications

```bash
# Install core engine and HTTP adapters
npm install @re-auth/reauth @re-auth/http-adapters

# Or with your preferred package manager
pnpm add @re-auth/reauth @re-auth/http-adapters
yarn add @re-auth/reauth @re-auth/http-adapters
```

### For Custom Protocol Integration

```bash
# Install only the core engine
npm install @re-auth/reauth

# Build your own protocol adapter using the core engine
```

### Development Setup (Monorepo)

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm dev

# Build all packages
pnpm build
```

## 📍 Next Steps

### For HTTP Web Applications

1. **Start with the Core + HTTP Adapters**: Install `@re-auth/reauth` and `@re-auth/http-adapters`
2. **Choose Your Framework**: Use Express, Fastify, or Hono adapters (or create a custom one)
3. **Configure Plugins**: Set up authentication methods (email/password, OAuth, etc.)
4. **Generate Client SDK**: Use `@re-auth/sdk-generator` for type-safe client integration
5. **See Example**: Check out `apps/hono-test` for a complete HTTP integration example

### For Custom Protocol Integration

1. **Start with Core Engine**: Install only `@re-auth/reauth`
2. **Implement Protocol Adapter**: Create your own adapter following the `FrameworkAdapter` interface
3. **Use Abstract Services**: Leverage `EntityService` and `SessionService` abstractions
4. **Configure Plugins**: Set up authentication methods that work across protocols
5. **Build Tooling**: Create protocol-specific tooling as needed

### For Learning and Exploration

1. **Explore Examples**: Start with `apps/hono-test` (backend) and `apps/web` (frontend)
2. **Read Documentation**: Check individual package READMEs for detailed usage
3. **Understand Architecture**: Review the architecture overview above
4. **Try Different Runtimes**: Test the same code in Node.js, Deno, or Bun

## 🏗️ Architecture Overview

ReAuth follows a clean separation of concerns with three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAuth Core Engine                       │
│              (@re-auth/reauth package)                     │
│                                                             │
│  • Plugin System (OAuth, Email/Password, Custom)           │
│  • Session Management (Protocol-Agnostic)                  │
│  • Entity Services (Abstract Interfaces)                   │
│  • Dependency Injection (Awilix Container)                 │
│  • Introspection & Validation (Standard Schema)            │
├─────────────────────────────────────────────────────────────┤
│                   Protocol Adapters                        │
│              (@re-auth/http-adapters package)              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ HTTP        │  │ gRPC        │  │ Custom Protocol     │ │
│  │ Adapters    │  │ Adapters    │  │ Adapters            │ │
│  │ (Available) │  │ (Future)    │  │ (Build Your Own)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                Framework Integrations                      │
│              (Within HTTP Adapters)                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Express     │  │ Fastify     │  │ Hono / Custom       │ │
│  │ Adapter     │  │ Adapter     │  │ Framework Adapter   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

- **Core Engine Independence**: The authentication logic is completely separate from protocol and framework concerns
- **Protocol Adapter Pattern**: Different protocols (HTTP, WebSocket, gRPC) can be supported through dedicated adapter packages
- **Framework Abstraction**: Within each protocol, multiple frameworks are supported through a common adapter interface
- **Plugin Extensibility**: Authentication methods are implemented as plugins that work across all protocols and frameworks
- **Universal Compatibility**: The same authentication logic works in any JavaScript runtime or framework

## 📦 Packages

### Core Engine

- **`@re-auth/reauth`** - The core protocol-agnostic authentication engine
  - Plugin-based architecture for extensible authentication methods
  - Runtime-independent (Node.js, Deno, Bun, browsers, edge runtimes)
  - Framework-independent with abstract service interfaces
  - Session management and introspection capabilities

### Protocol Adapters

- **`@re-auth/http-adapters`** - HTTP protocol implementation for web frameworks
  - Express.js, Fastify, and Hono framework adapters
  - Auto-route generation and introspection endpoints
  - HTTP-specific context handling and middleware integration
  - Custom adapter creation utilities

### Development Tools

- **`@re-auth/sdk-generator`** - Client SDK generation from HTTP protocol introspection
  - Automatic TypeScript client generation
  - Support for multiple HTTP clients (axios, fetch)
  - Type-safe API interfaces from runtime introspection

### Shared Configurations

- **`@repo/eslint-config`** - Shared ESLint configurations for monorepo consistency
- **`@repo/typescript-config`** - Shared TypeScript configurations for universal compatibility
- **`@repo/ui`** - Shared React components for example applications

### Example Applications

- **`hono-test`** - HTTP protocol integration demonstration with Hono framework
  - Shows core engine + HTTP adapter integration
  - SQLite database setup and plugin configuration
  - Authentication flow examples

- **`web`** - Next.js client application with generated SDK
  - Demonstrates client-side integration patterns
  - Generated SDK usage examples
  - Frontend authentication flows

All packages support dual ESM/CJS builds for universal compatibility across JavaScript environments.

## ✨ Key Features

- **🌐 Universal Compatibility** - Works across Node.js, Deno, Bun, browsers, and edge runtimes
- **🔌 Protocol Agnostic** - Core engine works with HTTP, WebSocket, gRPC, or any custom protocol
- **🎯 Framework Independent** - Integrates with Express, Fastify, Hono, or any framework through adapters
- **🧩 Plugin Architecture** - Extensible authentication methods (email/password, OAuth, passwordless, custom)
- **🔒 Session Management** - Protocol-agnostic session handling with token support
- **📡 Auto-Introspection** - Automatic SDK generation and API discovery
- **💉 Dependency Injection** - Clean architecture using Awilix container
- **✅ Type Safety** - Full TypeScript support with comprehensive type definitions
- **📋 Standard Schema** - Universal validation using Standard Schema specification
- **🔄 Schema Versioning** - Built-in support for incremental schema evolution and migrations

## 📚 Schema Versioning

ReAuth supports incremental schema versioning, allowing you to gradually add authentication methods over time without breaking existing implementations.

### Quick Example

```typescript
import { reauthDb, extendSchemaVersion, reauthDbVersions } from '@re-auth/reauth';
import { emailPasswordSchema } from '@re-auth/reauth/plugins/email-password';
import { jwtSchema } from '@re-auth/reauth/services';
import { sessionSchema } from '@re-auth/reauth/plugins/session';
import { usernamePasswordSchema } from '@re-auth/reauth/plugins/username';

// Version 1.0.1 - Initial release with email authentication
const { schema: v1, plugins: v1Plugins } = reauthDb('1.0.1', [emailPasswordSchema, jwtSchema, sessionSchema]);

// Version 1.0.2 - Add username authentication
// Only specify NEW schemas, existing ones are inherited
const { schema: v2, plugins: v2Plugins } = extendSchemaVersion(
  v1Plugins, // Pass the plugins array from v1
  '1.0.2',
  [usernamePasswordSchema],
);

// Register all versions for automatic migration
export const factory = reauthDbVersions([v1, v2]);
```

### Running Migrations

ReAuth includes a CLI tool to run database migrations:

```bash
# Run migrations using the CLI
npx reauth-migrate --client ./src/reauth/auth.ts

# Or add to your package.json scripts
{
  "scripts": {
    "migrate": "reauth-migrate --client ./src/reauth/auth.ts"
  }
}

# Then run
npm run migrate
```

The CLI will:

1. Dynamically import your client configuration
2. Detect the current database version
3. Run any pending migrations automatically

### Benefits

- **Incremental Changes**: Add new authentication methods without redefining existing ones
- **Clear History**: Each version shows exactly what was added
- **Type Safe**: Full TypeScript support for schema definitions
- **Automatic Migrations**: FumaDB handles database migrations between versions
- **CLI Integration**: Simple command-line tool for running migrations

For detailed documentation, see:

- [Schema Versioning Guide](./packages/reauth/SCHEMA_VERSIONING.md)
- [CLI Migration Documentation](./packages/reauth/CLI_MIGRATION.md)

## 🛠️ Development

### Prerequisites

- Node.js >= 18 (for development, but ReAuth works in all JS runtimes)
- pnpm (package manager)

### Commands

```bash
# Install dependencies
pnpm install

# Start development mode (all packages)
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Type checking
pnpm check-types
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd reauth
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
