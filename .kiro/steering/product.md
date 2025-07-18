# Product Overview

ReAuth is a runtime, framework, and protocol-independent authentication engine for TypeScript/JavaScript applications. It provides a universal authentication solution that works across all JS runtimes and frameworks through a plugin-based architecture with protocol-specific adapters.

## Core Features

- **Protocol Independence**: Core engine works with any protocol through adapters
- **Runtime Agnostic**: Works in Node.js, Deno, Bun, browsers, and edge runtimes
- **Framework Universal**: Integrates with any framework through adapter pattern
- **Plugin Architecture**: Extensible authentication flows through plugins
- **Multiple Auth Methods**: Email/password, passwordless, OAuth, custom plugins
- **Session Management**: Protocol-agnostic session handling with token support
- **TypeScript-First**: Comprehensive type safety throughout
- **Dependency Injection**: Clean architecture using Awilix container
- **Standard Schema**: Validation using Standard Schema specification
- **Auto-Introspection**: Automatic SDK generation and API discovery

## Key Components

- **ReAuth Core**: Protocol-agnostic authentication engine and plugin system
- **HTTP Adapters**: HTTP protocol implementation with Express, Fastify, and Hono support
- **SDK Generator**: Automatic client SDK generation from engine introspection
- **Plugin System**: Extensible authentication methods and flows

## Architecture Principles

- **Separation of Concerns**: Core engine separate from protocol implementations
- **Adapter Pattern**: Protocol-specific adapters handle communication details
- **Plugin System**: Authentication logic encapsulated in reusable plugins
- **Universal Compatibility**: Works across all JS environments and frameworks

## Target Use Cases

- Universal authentication across multiple runtimes and frameworks
- Multi-protocol applications (HTTP, WebSocket, gRPC, etc.)
- Multi-tenant systems with varying authentication requirements
- Microservices requiring consistent authentication across different frameworks
- Edge computing applications needing lightweight authentication
- Applications requiring custom authentication protocols or methods
