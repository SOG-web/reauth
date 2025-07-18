# Requirements Document

## Introduction

This specification outlines the requirements for updating ReAuth documentation and steering rules to accurately reflect the true architecture. ReAuth is a runtime, framework, and protocol-independent authentication engine that works across all TypeScript/JavaScript frameworks and JavaScript runtimes through a plugin-based architecture. The HTTP adapters are specifically designed for the HTTP protocol, but the core engine is protocol-agnostic and could support other protocols through different adapter implementations.

## Requirements

### Requirement 1: Update Steering Rules

**User Story:** As a developer using Kiro with ReAuth, I want accurate steering rules that reflect the true architecture, so that AI assistants provide correct guidance about the system.

#### Acceptance Criteria

1. WHEN reviewing product.md THEN it SHALL accurately describe ReAuth as a runtime, framework, and protocol-independent authentication engine
2. WHEN reviewing tech.md THEN it SHALL correctly identify the core technologies and architecture patterns used
3. WHEN reviewing structure.md THEN it SHALL accurately represent the monorepo organization and package relationships
4. WHEN steering rules are applied THEN they SHALL guide AI assistants to understand the plugin-based architecture with HTTP adapters
5. IF a steering rule contains outdated information THEN it SHALL be corrected to match the actual codebase

### Requirement 2: Update Core Package README

**User Story:** As a developer evaluating ReAuth, I want accurate documentation in the core package README, so that I understand the true capabilities and architecture.

#### Acceptance Criteria

1. WHEN reading packages/reauth/README.md THEN it SHALL accurately describe ReAuth as runtime, framework, and protocol-independent
2. WHEN reviewing the features section THEN it SHALL highlight the plugin-based architecture and protocol adapter system (with HTTP adapters as one implementation)
3. WHEN examining code examples THEN they SHALL demonstrate the correct usage patterns with EntityService and SessionService abstractions
4. WHEN reviewing installation instructions THEN they SHALL be accurate for the current package structure
5. IF the README contains framework-specific assumptions THEN they SHALL be removed or clarified as adapter-specific

### Requirement 3: Update HTTP Adapters README

**User Story:** As a developer integrating ReAuth with a web framework, I want clear documentation about HTTP adapters, so that I understand how to use ReAuth with my chosen framework.

#### Acceptance Criteria

1. WHEN reading packages/http-adapters/README.md THEN it SHALL explain the adapter pattern and framework independence
2. WHEN reviewing adapter examples THEN they SHALL show Express, Fastify, and Hono integrations
3. WHEN examining the factory pattern THEN it SHALL be clearly documented with usage examples
4. WHEN reviewing configuration options THEN they SHALL include context rules, route overrides, and auto-introspection
5. IF adapter documentation is missing THEN it SHALL be created with comprehensive examples

### Requirement 4: Update Root Project README

**User Story:** As a developer discovering ReAuth, I want an accurate project overview in the root README, so that I understand what ReAuth is and how to get started.

#### Acceptance Criteria

1. WHEN reading the root README.md THEN it SHALL accurately describe ReAuth's purpose and architecture
2. WHEN reviewing the package descriptions THEN they SHALL correctly identify each package's role
3. WHEN examining getting started instructions THEN they SHALL provide accurate setup steps
4. WHEN reviewing the monorepo structure THEN it SHALL be correctly documented
5. IF the README contains incorrect package descriptions THEN they SHALL be updated to match actual functionality

### Requirement 5: Create Architecture Documentation

**User Story:** As a developer working with ReAuth, I want comprehensive architecture documentation, so that I understand the system design and can contribute effectively.

#### Acceptance Criteria

1. WHEN reviewing architecture documentation THEN it SHALL explain the plugin system design
2. WHEN examining the HTTP adapter pattern THEN it SHALL be clearly documented with diagrams
3. WHEN reviewing the dependency injection system THEN it SHALL explain Awilix integration
4. WHEN examining entity and session abstractions THEN they SHALL be documented with interfaces
5. IF architecture documentation is missing THEN it SHALL be created in packages/http-adapters/ARCHITECTURE.md

### Requirement 6: Update Example Applications

**User Story:** As a developer learning ReAuth, I want accurate example applications, so that I can see real-world usage patterns.

#### Acceptance Criteria

1. WHEN reviewing apps/hono-test THEN it SHALL demonstrate correct ReAuth integration with Hono
2. WHEN examining apps/web THEN it SHALL show proper client-side integration patterns
3. WHEN reviewing example code THEN it SHALL use current API patterns and best practices
4. WHEN examining configuration THEN it SHALL reflect the actual package structure
5. IF examples contain outdated patterns THEN they SHALL be updated to current standards

### Requirement 7: Update API Documentation

**User Story:** As a developer integrating ReAuth, I want accurate API documentation, so that I can understand all available methods and configuration options.

#### Acceptance Criteria

1. WHEN reviewing API documentation THEN it SHALL cover all public interfaces and methods
2. WHEN examining plugin interfaces THEN they SHALL be documented with examples
3. WHEN reviewing HTTP adapter APIs THEN they SHALL include all configuration options
4. WHEN examining introspection capabilities THEN they SHALL be documented for SDK generation
5. IF API documentation is incomplete THEN it SHALL be expanded to cover all public APIs
