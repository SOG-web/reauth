# Email-or-Username Plugin (V2)

A ReAuth V2 plugin that provides flexible authentication by automatically detecting whether the user input is an email or username and handling authentication accordingly.

## Overview

The email-or-username plugin demonstrates V2's plugin composition capabilities by providing a unified authentication interface that works with both email and username inputs. Instead of requiring users to specify whether they're using an email or username, the plugin automatically detects the input type and handles authentication appropriately.

## Features

- **Auto-Detection**: Automatically detects whether input is email or username using regex validation
- **Unified Interface**: Single authentication flow regardless of input type
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Test Users**: Supports test users for both email and username formats
- **Email Verification**: Supports email verification when configured
- **Session Management**: Consistent session handling across input types

## Architecture

This plugin demonstrates plugin composition through:
1. **Input Detection**: Smart detection of email vs username formats
2. **Unified Database Schema**: Uses existing `identities` table with provider field
3. **Consistent API**: Same input/output interface regardless of underlying type
4. **Configuration Composition**: Combines email and username plugin configurations

## Configuration

```typescript
import { EmailOrUsernameConfigV2 } from '@re-auth/reauth/v2';

const config: EmailOrUsernameConfigV2 = {
  // Detection strategy
  detectionStrategy: 'auto', // 'auto' | 'explicit'
  
  // Session configuration
  sessionTtlSeconds: 3600,
  loginOnRegister: true,
  
  // Email plugin configuration
  emailConfig: {
    verifyEmail: false,
    sessionTtlSeconds: 3600,
    // ... other email-password config options
  },
  
  // Username plugin configuration  
  usernameConfig: {
    sessionTtlSeconds: 3600,
    // ... other username config options
  },
  
  // Test users supporting both formats
  testUsers: {
    enabled: true,
    users: [
      {
        email: 'test@example.com',
        password: 'password123',
        profile: { name: 'Test Email User' }
      },
      {
        username: 'testuser',
        password: 'password123', 
        profile: { name: 'Test Username User' }
      }
    ],
    environment: 'development'
  }
};
```

## Usage

### Basic Setup

```typescript
import { ReAuthEngineV2, baseEmailOrUsernamePluginV2, emailPasswordSchemaV2, usernamePasswordSchemaV2 } from '@re-auth/reauth/v2';

const engine = new ReAuthEngineV2({
  plugins: [baseEmailOrUsernamePluginV2],
  schemas: [emailPasswordSchemaV2, usernamePasswordSchemaV2]
});
```

### Authentication Examples

```typescript
// Login with email - automatically detected
const emailResult = await engine.run('login', {
  emailOrUsername: 'user@example.com',
  password: 'password123'
});

// Login with username - automatically detected  
const usernameResult = await engine.run('login', {
  emailOrUsername: 'johndoe',
  password: 'password123'
});

// Registration with email
const registerResult = await engine.run('register', {
  emailOrUsername: 'newuser@example.com',
  password: 'securepass123',
  others: { firstName: 'John', lastName: 'Doe' }
});

// Change password (works for both types)
const changeResult = await engine.run('change-password', {
  currentPassword: 'oldpass',
  newPassword: 'newpass123',
  token: userToken
});
```

## API Reference

### Steps

#### `login`
- **Input**: `{ emailOrUsername: string, password: string, others?: object }`
- **Output**: `{ success: boolean, message: string, token?: string, subject?: object, status: string }`
- **Description**: Authenticates user with email or username

#### `register`  
- **Input**: `{ emailOrUsername: string, password: string, others?: object }`
- **Output**: `{ success: boolean, message: string, token?: string, subject?: object, status: string }`
- **Description**: Registers new user with email or username

#### `change-password`
- **Input**: `{ currentPassword: string, newPassword: string, token?: string, others?: object }`
- **Output**: `{ success: boolean, message: string, token?: string, subject?: object, status: string }`
- **Description**: Changes user password (requires authentication)

### Utility Functions

#### `detectInputType(input: string): 'email' | 'username'`
Detects whether input string is an email or username format.

#### `isValidEmail(email: string): boolean`  
Validates email format using regex.

#### `findTestUser(emailOrUsername: string, password: string, config: EmailOrUsernameConfigV2)`
Finds matching test user from configuration.

## Schema

This plugin doesn't define its own schema - instead it uses the schemas from the underlying email-password and username plugins. When setting up the engine, include both underlying schemas:

- `emailPasswordSchemaV2` - Provides email authentication tables
- `usernamePasswordSchemaV2` - Provides username authentication tables

The combined schemas provide these tables:
- `subjects` - User subjects  
- `credentials` - Password hashes
- `identities` - Provider identities (email/username)
- `email_identities` - Email-specific metadata
- `username_identities` - Username-specific metadata

## Security Considerations

- Input validation prevents injection attacks
- Password hashing using secure algorithms
- Session management with configurable TTL
- Email verification support when enabled
- Test users only work in development/test environments

## Performance

- Fast regex-based input detection
- Minimal overhead for type detection
- Efficient database queries using provider-based indexing
- No duplicate validation logic

## Example Outputs

### Successful Login (Email)
```json
{
  "success": true,
  "message": "Login successful",
  "status": "su",
  "token": "session_token_here",
  "subject": {
    "id": "user_id",
    "email": "user@example.com", 
    "provider": "email",
    "verified": true
  }
}
```

### Successful Login (Username)
```json
{
  "success": true,
  "message": "Login successful", 
  "status": "su",
  "token": "session_token_here",
  "subject": {
    "id": "user_id",
    "username": "johndoe",
    "provider": "username", 
    "verified": true
  }
}
```

### Registration with Email Verification Required
```json
{
  "success": false,
  "message": "Registration successful. Please verify your email.",
  "status": "eq",
  "token": null,
  "subject": {
    "id": "user_id",
    "email": "user@example.com",
    "provider": "email",
    "verified": false
  }
}
```

## Testing

The plugin includes comprehensive tests covering:
- Plugin structure and exports
- Input detection logic  
- Configuration validation
- Step functionality
- Schema composition
- Usage examples

Run tests with:
```bash
pnpm test src/v2/plugins/email-or-username/
```

## Implementation Notes

This plugin demonstrates several V2 architecture patterns:
- **Plugin Composition**: Combines functionality from multiple authentication methods
- **Smart Detection**: Automatic input type detection without user specification  
- **Unified Schema**: Reuses existing database structures with provider differentiation
- **Type Safety**: Comprehensive TypeScript interfaces and validation
- **Test Support**: Built-in test user functionality for development

The implementation focuses on simplicity and maintainability while providing a flexible authentication experience for end users.