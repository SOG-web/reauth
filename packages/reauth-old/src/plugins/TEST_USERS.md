# Test User Feature Documentation

The test user feature allows developers to configure predefined credentials that bypass normal authentication flows for development and testing purposes.

## Overview

Test users provide a way to:

- Bypass password validation, hashing, and database lookups
- Return predefined user profiles/entities
- Enable consistent testing across different environments
- Simplify development workflows

## Configuration

### Email-Password Plugin

```typescript
import emailPasswordAuth from './email-password/email-password.plugin';

const plugin = emailPasswordAuth({
  verifyEmail: false,
  testUsers: {
    enabled: true,
    environment: 'development', // 'development' | 'test' | 'all'
    users: [
      {
        email: 'test@example.com',
        password: 'test123',
        profile: {
          id: 'test-user-1',
          role: 'admin',
          name: 'Test Admin User',
          // Any additional profile fields
        },
      },
      {
        email: 'demo@example.com',
        password: 'demo123',
        profile: {
          id: 'demo-user-1',
          role: 'user',
          plan: 'premium',
        },
      },
    ],
  },
});
```

### Phone-Password Plugin

```typescript
import phonePasswordAuth from './phone-password/phone-password.plugin';

const plugin = phonePasswordAuth({
  verifyPhone: false,
  sendCode: async (entity, code, phone) => {
    console.log(`SMS to ${phone}: Code ${code}`);
  },
  testUsers: {
    enabled: true,
    environment: 'development',
    users: [
      {
        phone: '+1234567890',
        password: 'test123',
        profile: {
          id: 'test-phone-user-1',
          role: 'admin',
          name: 'Test Phone Admin',
        },
      },
    ],
  },
});
```

### Username-Password Plugin

```typescript
import usernamePasswordAuth from './username/username.plugin';

const plugin = usernamePasswordAuth({
  loginOnRegister: true,
  testUsers: {
    enabled: true,
    environment: 'development',
    users: [
      {
        username: 'testuser',
        password: 'test123',
        profile: {
          id: 'test-username-user-1',
          role: 'admin',
          permissions: ['read', 'write', 'admin'],
        },
      },
    ],
  },
});
```

## Environment Controls

Test users are environment-aware for security:

- **`development`** (default): Only works when `NODE_ENV` is undefined, 'development', or not set
- **`test`**: Only works when `NODE_ENV` is 'test'
- **`all`**: Works in any environment (⚠️ use with caution!)

```typescript
// Production-safe configuration
const plugin = emailPasswordAuth({
  testUsers: {
    enabled: true,
    environment: 'test', // Only works in NODE_ENV=test
    users: [
      {
        email: 'e2e@test.com',
        password: 'e2e-test-password',
        profile: {
          id: 'e2e-user',
          role: 'user',
        },
      },
    ],
  },
});
```

## Usage Examples

### Login with Test User

```javascript
// This will bypass normal authentication when test users are enabled
const response = await authEngine.execute('email', 'login', {
  email: 'test@example.com',
  password: 'test123',
});

console.log(response);
// Output:
// {
//   success: true,
//   message: 'Login successful (test user)',
//   token: 'generated-session-token',
//   entity: {
//     id: 'test-user-1',
//     role: 'admin',
//     name: 'Test Admin User',
//     // ... other profile fields
//   }
// }
```

### Register with Test User

```javascript
// Registration also works with test users
const response = await authEngine.execute('email', 'register', {
  email: 'demo@example.com',
  password: 'demo123',
});

console.log(response);
// Output:
// {
//   success: true,
//   message: 'Register successful (test user)',
//   token: 'generated-session-token',
//   entity: {
//     id: 'demo-user-1',
//     role: 'user',
//     plan: 'premium'
//   }
// }
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **Never enable test users in production** - Use environment controls
2. **Test users bypass all security checks** - Password validation, hashing, verification, etc.
3. **Test users don't interact with the database** - They return mock entities
4. **Always use environment restrictions** - Prevent accidental production use

## Testing Integration

### Unit Tests

```javascript
describe('Authentication with Test Users', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should authenticate test user', async () => {
    const response = await authEngine.execute('email', 'login', {
      email: 'test@example.com',
      password: 'test123',
    });

    expect(response.success).toBe(true);
    expect(response.message).toContain('test user');
    expect(response.entity.role).toBe('admin');
  });
});
```

### E2E Tests

```javascript
// cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
  it('should login with test credentials', () => {
    cy.visit('/login');
    cy.get('[data-cy=email]').type('test@example.com');
    cy.get('[data-cy=password]').type('test123');
    cy.get('[data-cy=submit]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## How It Works

1. **Credential Check**: When login/register is attempted, the plugin first checks if the credentials match any configured test users
2. **Environment Validation**: Ensures the current environment allows test users
3. **Mock Entity Creation**: Creates a mock entity with the predefined profile
4. **Session Generation**: Generates a real session token for the mock entity
5. **Response**: Returns success with the mock entity and token

## Fallback Behavior

If credentials don't match test users or test users are disabled/not allowed in current environment, the plugin falls back to normal authentication flow:

```javascript
// Normal user - goes through database lookup and password verification
const response = await authEngine.execute('email', 'login', {
  email: 'real.user@example.com',
  password: 'realPassword123!',
});
```

## Migration Guide

### Existing Implementations

If you have existing authentication plugins, you can add test user support by:

1. Adding the `testUsers` configuration to your plugin config interface
2. Adding helper functions for environment checking and test user lookup
3. Modifying login/register steps to check for test users first
4. Ensuring fallback to normal authentication flow

### Backward Compatibility

The test user feature is completely opt-in and backward compatible:

- Existing configurations continue to work unchanged
- No breaking changes to existing APIs
- Test users are disabled by default

## API Reference

### TestUserConfig Interface

```typescript
interface TestUserConfig {
  enabled: boolean; // Enable/disable test users
  users: TestUser[]; // Array of test user configurations
  environment?: 'development' | 'test' | 'all'; // Environment restriction
}
```

### TestUser Interface

```typescript
interface TestUser {
  email: string; // For email-password plugin
  phone: string; // For phone-password plugin
  username: string; // For username-password plugin
  password: string; // Test password
  profile: Record<string, any>; // User profile/entity fields
}
```

## Best Practices

1. **Use environment restrictions** - Never allow test users in production
2. **Document test credentials** - Make it clear which credentials are for testing
3. **Use realistic test data** - Mirror production user structure in test profiles
4. **Separate test configs** - Keep test user configurations in separate files
5. **Regular cleanup** - Remove unused test users periodically
6. **Consistent naming** - Use clear, descriptive names for test users

## Troubleshooting

### Common Issues

**Test users not working:**

- Check `enabled: true` in configuration
- Verify environment settings match current NODE_ENV
- Ensure credentials match exactly (case-sensitive)

**Falling back to normal authentication:**

- Test users are working correctly - this is the expected fallback behavior
- Check if credentials match any configured test users

**TypeScript errors:**

- Ensure profile fields match your Entity type extensions
- Use `Record<string, any>` for flexible profile typing
