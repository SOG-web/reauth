# Test User Feature

The ReAuth library now includes a **Test User** feature across all authentication plugins (`email-password`, `phone-password`, and `username-password`). This feature allows developers to specify predefined test accounts that bypass normal authentication flows for development and testing purposes.

## 🔐 Security

- **Environment-aware**: Test users only work in specified environments (`development`, `test`)
- **Disabled by default**: Must be explicitly enabled
- **Production safe**: Automatically disabled in production environments
- **Fallback authentication**: If no test user matches, normal authentication is used

## 📋 Configuration

### Email-Password Plugin

```typescript
import { emailPasswordAuth } from '@re-auth/reauth/plugins';

const emailAuth = emailPasswordAuth({
  verifyEmail: true,
  loginOnRegister: false,

  testUsers: {
    enabled: true, // Enable test users
    environment: 'development', // Only works in development
    users: [
      {
        email: 'admin@test.com',
        password: 'admin123',
        profile: {
          id: 'test-admin-1',
          role: 'admin',
          email_verified: true,
          firstName: 'Test',
          lastName: 'Admin',
          plan: 'premium',
        },
      },
      {
        email: 'user@test.com',
        password: 'user123',
        profile: {
          id: 'test-user-1',
          role: 'user',
          email_verified: true,
          firstName: 'Test',
          lastName: 'User',
          plan: 'basic',
        },
      },
    ],
  },

  sendCode: async (entity, code, email, type) => {
    // Your email sending logic
    console.log(`Sending ${type} code ${code} to ${email}`);
  },
});
```

### Phone-Password Plugin

```typescript
import { phonePasswordAuth } from '@re-auth/reauth/plugins';

const phoneAuth = phonePasswordAuth({
  verifyPhone: true,

  testUsers: {
    enabled: true,
    environment: 'development',
    users: [
      {
        phone: '+1234567890',
        password: 'test123',
        profile: {
          id: 'test-phone-admin-1',
          role: 'admin',
          phone_verified: true,
          firstName: 'Phone',
          lastName: 'Admin',
        },
      },
    ],
  },

  sendCode: async (entity, code, phone) => {
    console.log(`SMS Code sent to ${phone}: ${code}`);
  },
});
```

### Username-Password Plugin

```typescript
import { usernamePasswordAuth } from '@re-auth/reauth/plugins';

const usernameAuth = usernamePasswordAuth({
  loginOnRegister: true,

  testUsers: {
    enabled: true,
    environment: 'development',
    users: [
      {
        username: 'testadmin',
        password: 'admin123',
        profile: {
          id: 'test-username-admin-1',
          role: 'admin',
          firstName: 'Username',
          lastName: 'Admin',
        },
      },
    ],
  },
});
```

## 🌍 Environment Configuration

### Available Environments

- **`development`** (default): Only works when `NODE_ENV` is `'development'`
- **`test`**: Only works when `NODE_ENV` is `'test'`
- **`all`**: Works in any environment ⚠️ **NOT recommended for production**

### Examples

```typescript
// Development only
testUsers: {
  enabled: true,
  environment: 'development',  // Only works in dev
  users: [...]
}

// Testing only (for E2E tests)
testUsers: {
  enabled: true,
  environment: 'test',  // Only works in test env
  users: [...]
}

// Production - NO TEST USERS
emailPasswordAuth({
  verifyEmail: true,
  // No testUsers config - disabled by default
  sendCode: async (entity, code, email, type) => {
    // Production email logic
  }
});
```

## 🚀 Usage Examples

### Basic Login

```typescript
// Using test user credentials in development
const result = await reAuth.executeStep('email', 'login', {
  email: 'admin@test.com',
  password: 'admin123',
});

console.log(result);
// Output:
// {
//   success: true,
//   message: 'Login successful (test user)',
//   token: 'generated-token',
//   entity: { id: 'test-admin-1', role: 'admin', ... }
// }
```

### Registration Flow

```typescript
// Test user registration returns existing profile
const result = await reAuth.executeStep('email', 'register', {
  email: 'user@test.com',
  password: 'user123',
});

// Returns test user profile without creating database entries
```

### Phone Authentication

```typescript
const phoneResult = await reAuth.executeStep('phone', 'login', {
  phone: '+1234567890',
  password: 'test123',
});
```

### Username Authentication

```typescript
const usernameResult = await reAuth.executeStep('username', 'login', {
  username: 'testadmin',
  password: 'admin123',
});
```

## 🧪 Testing Integration

### Jest/Vitest

```typescript
describe('Authentication Tests', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should login with test user', async () => {
    const result = await reAuth.executeStep('email', 'login', {
      email: 'admin@test.com',
      password: 'admin123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('test user');
    expect(result.entity.role).toBe('admin');
  });

  test('should fallback to normal auth for non-test users', async () => {
    const result = await reAuth.executeStep('email', 'login', {
      email: 'real.user@example.com',
      password: 'realPassword',
    });

    // This would use normal database authentication
    expect(result.message).not.toContain('test user');
  });
});
```

### Cypress E2E

```typescript
// Test user login in E2E tests
cy.visit('/login');
cy.get('[data-cy=email]').type('user@test.com');
cy.get('[data-cy=password]').type('user123');
cy.get('[data-cy=submit]').click();
cy.url().should('include', '/dashboard');
```

### Test Environment Configuration

```typescript
const reAuthTesting = createReAuthEngine({
  plugins: [
    emailPasswordAuth({
      verifyEmail: false, // Disable verification in tests
      loginOnRegister: true,
      testUsers: {
        enabled: true,
        environment: 'test', // Only works when NODE_ENV=test
        users: [
          {
            email: 'e2e@test.com',
            password: 'e2e-password',
            profile: {
              id: 'e2e-user-1',
              role: 'user',
              email_verified: true,
            },
          },
        ],
      },
      sendCode: async () => {}, // No-op for tests
    }),
  ],
  entity: entityService,
  session: sessionService,
});
```

## 🔧 Helper Functions

The plugins export helper functions for testing and external use:

```typescript
import { isTestEnvironmentAllowed, findTestUser, createTestEntity } from '@re-auth/reauth/plugins/email-password';

// Check if test users are allowed in current environment
const allowed = isTestEnvironmentAllowed(config);

// Find a test user by credentials
const testUser = findTestUser(config, 'admin@test.com', 'admin123');

// Create test entity object
const entity = createTestEntity(testUser, 'test-token-123');
```

## 🔄 Authentication Flow

### Test User Flow

1. User attempts login with credentials
2. Plugin checks if test users are enabled and environment matches
3. If enabled, searches test users array for matching credentials
4. If found, returns success with test profile data (skips database)
5. If not found, proceeds with normal database authentication

### Message Identification

Test user authentication includes `"(test user)"` in the response message:

```typescript
// Test user response
{
  success: true,
  message: 'Login successful (test user)',
  entity: { ... }
}

// Normal user response
{
  success: true,
  message: 'Login successful',
  entity: { ... }
}
```

## 📝 Configuration Schema

### TestUserConfig Interface

```typescript
interface TestUserConfig {
  enabled: boolean;
  environment?: 'development' | 'test' | 'all';
  users: TestUser[];
}
```

### TestUser Interfaces

```typescript
// Email-Password
interface TestUser {
  email: string;
  password: string;
  profile: Record<string, any>;
}

// Phone-Password
interface PhoneTestUser {
  phone: string;
  password: string;
  profile: Record<string, any>;
}

// Username-Password
interface UsernameTestUser {
  username: string;
  password: string;
  profile: Record<string, any>;
}
```

## ⚠️ Important Notes

1. **Security**: Never use test users in production environments
2. **Environment**: Always specify the correct environment setting
3. **Fallback**: Test users don't replace normal authentication - they supplement it
4. **Profile Data**: The `profile` object can contain any data your application needs
5. **Verification**: Test users bypass email/phone verification when configured
6. **Database**: Test users don't create or modify database entries

## 🔍 Troubleshooting

### Test Users Not Working

1. Check `enabled: true` is set
2. Verify environment matches (development/test)
3. Ensure credentials match exactly
4. Check NODE_ENV value

### Still Using Database

1. Verify test user configuration is correct
2. Check that credentials match a test user exactly
3. Ensure environment setting allows test users

### Production Issues

1. Remove or disable test user configuration in production
2. Verify NODE_ENV is set to 'production'
3. Test users are automatically disabled in production

For more examples, see the complete usage documentation in the source code.
