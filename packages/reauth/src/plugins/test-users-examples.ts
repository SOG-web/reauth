/**
 * Test User Feature Examples
 *
 * This file demonstrates how to configure and use test users across all authentication plugins.
 * Test users allow developers to bypass normal authentication flows for development and testing.
 */

import emailPasswordAuth from './email-password/email-password.plugin';
import phonePasswordAuth from './phone-password/phone-password.plugin';
import usernamePasswordAuth from './username/username.plugin';

// ==================== EMAIL-PASSWORD PLUGIN EXAMPLE ====================

const emailPasswordPlugin = emailPasswordAuth({
  verifyEmail: false,
  loginOnRegister: true,
  testUsers: {
    enabled: true,
    environment: 'development', // Only works in development environment
    users: [
      {
        email: 'test@example.com',
        password: 'test123',
        profile: {
          id: 'test-user-1',
          role: 'admin',
          name: 'Test Admin User',
          // Add any other profile fields you want
        },
      },
      {
        email: 'demo@example.com',
        password: 'demo123',
        profile: {
          id: 'demo-user-1',
          role: 'user',
          name: 'Demo Regular User',
          plan: 'premium',
        },
      },
      {
        email: 'developer@example.com',
        password: 'dev123',
        profile: {
          id: 'dev-user-1',
          role: 'developer',
          name: 'Developer User',
          permissions: ['read', 'write', 'admin'],
        },
      },
    ],
  },
  // Other configuration...
});

// ==================== PHONE-PASSWORD PLUGIN EXAMPLE ====================

const phonePasswordPlugin = phonePasswordAuth({
  verifyPhone: false,
  loginOnRegister: true,
  sendCode: async (entity, code, phone) => {
    // Your SMS implementation here
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
      {
        phone: '+0987654321',
        password: 'demo123',
        profile: {
          id: 'demo-phone-user-1',
          role: 'user',
          name: 'Demo Phone User',
        },
      },
    ],
  },
});

// ==================== USERNAME-PASSWORD PLUGIN EXAMPLE ====================

const usernamePasswordPlugin = usernamePasswordAuth({
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
          name: 'Test Username Admin',
        },
      },
      {
        username: 'demouser',
        password: 'demo123',
        profile: {
          id: 'demo-username-user-1',
          role: 'user',
          name: 'Demo Username User',
        },
      },
    ],
  },
});

// ==================== MULTI-ENVIRONMENT CONFIGURATION ====================

const productionSafeConfig = emailPasswordAuth({
  verifyEmail: true,
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

// ==================== USAGE IN TESTS ====================

/* 
// In your test files:

describe('Authentication Tests', () => {
  test('should login with test user credentials', async () => {
    const response = await authEngine.execute('email', 'login', {
      email: 'test@example.com',
      password: 'test123'
    });
    
    expect(response.success).toBe(true);
    expect(response.message).toContain('test user');
    expect(response.entity.role).toBe('admin');
  });

  test('should register with test user credentials', async () => {
    const response = await authEngine.execute('email', 'register', {
      email: 'demo@example.com',
      password: 'demo123'
    });
    
    expect(response.success).toBe(true);
    expect(response.entity.name).toBe('Demo Regular User');
  });
});
*/

// ==================== ENVIRONMENT CONTROL ====================

/*
Test users are environment-aware:

1. environment: 'development' (default)
   - Only works when NODE_ENV is undefined, 'development', or not set

2. environment: 'test' 
   - Only works when NODE_ENV is 'test'

3. environment: 'all'
   - Works in any environment (be careful with this!)

Security considerations:
- Test users completely bypass password validation, hashing, and verification
- Test users don't interact with the database
- Test users should NEVER be enabled in production
- Always use environment controls to prevent accidental production use
*/

export {
  emailPasswordPlugin,
  phonePasswordPlugin,
  usernamePasswordPlugin,
  productionSafeConfig,
};
