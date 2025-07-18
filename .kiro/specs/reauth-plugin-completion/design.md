# Design Document

## Overview

This design document outlines the architecture and implementation approach for completing all incomplete ReAuth authentication plugins. The solution focuses on systematic completion of six plugins (Username, API Key, Anonymous, Organization, Passwordless, and Phone Password) while maintaining consistency with the existing ReAuth architecture.

The design follows ReAuth's plugin-based architecture, dependency injection patterns, and protocol-agnostic approach. Each plugin will be completed with proper initialization, comprehensive security measures, and full functionality while maintaining backward compatibility.

## Architecture

### Plugin Architecture Pattern

All plugins follow the established ReAuth plugin architecture:

```typescript
interface AuthPlugin<T> {
  name: string;
  steps: AuthStep<T>[];
  initialize(container: AwilixContainer<ReAuthCradle>): Promise<void>;
  getSensitiveFields?(): string[];
  migrationConfig?: PluginMigrationConfig;
  config: Partial<T>;
  dependsOn?: string[];
}
```

### Initialization Flow

The plugin initialization process will be standardized across all plugins:

1. **Configuration Validation**: Validate required configuration parameters
2. **Dependency Checking**: Verify dependent plugins are available
3. **Service Registration**: Register plugin services in DI container
4. **Hook Registration**: Register authentication and session hooks
5. **Migration Setup**: Ensure database schema is properly configured

### Security Architecture

All plugins will implement a layered security approach:

- **Input Validation Layer**: ArkType schemas for all inputs
- **Authentication Layer**: Proper session and token validation
- **Authorization Layer**: Permission and role-based access control
- **Audit Layer**: Security event logging and monitoring

## Components and Interfaces

### Core Plugin Components

#### 1. Plugin Factory Pattern

```typescript
const createPlugin = <T>(
  basePlugin: AuthPlugin<T>,
  config: T,
  overrides?: StepOverride<T>[]
): AuthPlugin<T>
```

#### 2. Security Service Interface

```typescript
interface SecurityService {
  validateInput(schema: Type, input: any): ValidationResult;
  logSecurityEvent(event: SecurityEvent): Promise<void>;
  hashSensitiveData(data: string): Promise<string>;
  sanitizeInput(input: any): any;
  generateSecureToken(length?: number): Promise<string>;
}
```

#### 3. Plugin Configuration Interface

```typescript
interface BasePluginConfig {
  security?: SecurityConfig;
  logging?: LoggingConfig;
  hooks?: PluginHooks;
}
```

### Plugin-Specific Components

#### Username Plugin Components

- **UsernameValidator**: Validates username format and uniqueness
- **PasswordPolicyEnforcer**: Enforces configurable password policies
- **BruteForceProtector**: Implements account lockout protection
- **SecurityAuditor**: Logs authentication events

#### API Key Plugin Components

- **ApiKeyGenerator**: Generates cryptographically secure API keys
- **ApiKeyManager**: Handles CRUD operations for API keys
- **UsageTracker**: Tracks API key usage statistics
- **KeyRotationService**: Handles secure key rotation

#### Anonymous Plugin Components

- **AnonymousUserManager**: Manages anonymous user lifecycle
- **DataTransferService**: Handles data transfer during account linking
- **RetentionPolicyEnforcer**: Implements data cleanup policies
- **PrivacyComplianceService**: Ensures GDPR compliance

#### Organization Plugin Components

- **OrganizationManager**: Handles organization CRUD operations
- **PermissionResolver**: Resolves user permissions within organizations
- **TenantIsolationService**: Ensures proper data isolation
- **MembershipManager**: Manages organization membership

#### Passwordless Plugin Components

- **TokenGenerator**: Generates secure magic link and OTP tokens
- **DeliveryService**: Handles token delivery via email/SMS
- **TokenValidator**: Validates and expires tokens
- **LinkAuthenticator**: Handles magic link authentication

#### Phone Password Plugin Components

- **PhoneValidator**: Validates international phone numbers
- **SMSService**: Handles SMS delivery for verification codes
- **VerificationManager**: Manages phone verification workflow
- **PhoneChangeService**: Handles secure phone number changes

## Data Models

### Enhanced Entity Extensions

Each plugin extends the base Entity interface:

```typescript
// Username Plugin
interface UsernameEntityExtension {
  username?: string | null;
  password_hash?: string | null;
  failed_login_attempts?: number;
  locked_until?: Date | null;
  last_login_attempt?: Date | null;
}

// API Key Plugin
interface ApiKeyEntityExtension {
  api_keys?: ApiKey[] | null;
}

interface ApiKey {
  id: string;
  key_hash: string; // Store hash, not actual key
  name: string;
  permissions: string[];
  active: boolean;
  created_at: Date;
  last_used_at: Date | null;
  usage_count: number;
  expires_at: Date | null;
}

// Anonymous Plugin
interface AnonymousEntityExtension {
  anonymous_id?: string | null;
  is_anonymous?: boolean | null;
  linked_to_entity_id?: string | null;
  linked_at?: Date | null;
  converted_at?: Date | null;
  anonymous_data?: Record<string, any> | null;
  data_retention_expires_at?: Date | null;
}

// Organization Plugin
interface OrganizationEntityExtension {
  organizations?: OrganizationMembership[] | null;
  default_organization_id?: string | null;
}

interface OrganizationMembership {
  organization_id: string;
  role: string;
  permissions: string[];
  teams: string[];
  joined_at: Date;
  status: 'active' | 'suspended' | 'pending';
}

// Phone Password Plugin
interface PhoneEntityExtension {
  phone?: string | null;
  phone_verified?: boolean;
  phone_verification_code?: string | null;
  phone_verification_expires_at?: Date | null;
  phone_change_token?: string | null;
  phone_change_expires_at?: Date | null;
}
```

### Configuration Models

```typescript
interface SecurityConfig {
  enableAuditLogging: boolean;
  sensitiveFieldRedaction: boolean;
  timingAttackProtection: boolean;
  inputSanitization: boolean;
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  includeRequestData: boolean;
  includeSensitiveData: boolean;
}
```

## Error Handling

### Standardized Error Types

```typescript
class PluginInitializationError extends Error {
  constructor(pluginName: string, reason: string) {
    super(`Plugin ${pluginName} failed to initialize: ${reason}`);
  }
}

class SecurityViolationError extends Error {
  constructor(violation: string, context?: any) {
    super(`Security violation: ${violation}`);
  }
}
```

### Error Handling Strategy

1. **Graceful Degradation**: Plugins should handle errors without breaking the entire system
2. **Detailed Logging**: All errors should be logged with sufficient context
3. **User-Friendly Messages**: Error messages should not expose sensitive system information
4. **Recovery Mechanisms**: Implement retry logic where appropriate

## Testing Strategy

### Testing Architecture

#### Unit Testing

- **Test Coverage**: Minimum 90% code coverage for all plugins
- **Test Framework**: Vitest for consistency with existing codebase
- **Mock Strategy**: Mock external dependencies (SMS services, email services)
- **Test Data**: Use factory pattern for generating test data

#### Integration Testing

- **Plugin Interaction**: Test interactions between plugins
- **Database Integration**: Test with real database connections
- **Container Testing**: Test dependency injection container setup
- **Hook Testing**: Test plugin hooks and event handling

#### Security Testing

- **Input Validation**: Test all input validation scenarios
- **Authentication Bypass**: Test for authentication bypass vulnerabilities
- **Data Exposure**: Test for sensitive data exposure

### Test Structure

```typescript
describe('Plugin Name', () => {
  describe('Initialization', () => {
    // Test plugin initialization scenarios
  });

  describe('Authentication Steps', () => {
    // Test each authentication step
  });

  describe('Security Features', () => {
    // Test security mechanisms
  });

  describe('Error Handling', () => {
    // Test error scenarios
  });

  describe('Integration', () => {
    // Test integration with other plugins
  });
});
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

1. Create shared security services
2. Implement standardized error handling
3. Create testing utilities and fixtures
4. Set up plugin factory patterns

### Phase 2: Plugin Initialization (Week 3)

1. Fix initialization methods for all plugins
2. Implement proper dependency injection
3. Add configuration validation
4. Enable basic plugin functionality

### Phase 3: Passwordless Plugin Restoration (Week 4)

1. Uncomment and restore passwordless plugin
2. Update to current ReAuth patterns
3. Implement magic link functionality
4. Implement OTP functionality

### Phase 4: Security Features (Week 5-6)

1. Add brute force protection
2. Implement audit logging
3. Add input validation and sanitization

### Phase 5: Advanced Features (Week 7-8)

1. Complete plugin-specific advanced features
2. Implement data retention policies
3. Complete organization multi-tenancy
4. Add comprehensive security measures

### Phase 6: Testing and Documentation (Week 9-10)

1. Complete comprehensive test suites
2. Write plugin documentation
3. Create integration examples
4. Security testing and validation

## Migration Strategy

### Database Migrations

- All plugins will use ReAuth's migration system
- Migrations will be backward compatible
- New columns will be nullable to support existing data

### Configuration Migration

- Existing plugin configurations will remain compatible
- New configuration options will have sensible defaults
- Migration guides will be provided for breaking changes

### API Compatibility

- All existing plugin APIs will remain functional
- New features will be additive
- Deprecation notices will be provided for any changes

This design provides a comprehensive approach to completing all incomplete ReAuth plugins while maintaining system integrity and security.
