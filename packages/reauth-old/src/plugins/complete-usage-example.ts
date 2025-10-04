/**
 * Complete ReAuth Library Usage Example
 *
 * This example demonstrates how to properly use the ReAuth library with all plugins
 * including the new test user feature for development and testing.
 *
 * Note: This is a documentation example. Replace the imports and services
 * with your actual implementations.
 */

import { createReAuthEngine } from '../auth-engine';
import emailPasswordAuth from './email-password/email-password.plugin';
import phonePasswordAuth from './phone-password/phone-password.plugin';
import usernamePasswordAuth from './username/username.plugin';
import sessionPlugin from './session/session.plugin';
import { type } from 'arktype';

// Example imports - replace with your actual implementations
// import prisma from "../db"; // Your Prisma client
// import { entityService, sessionService } from "./helpers";
// import { UserType } from "@prisma/client";
// import { sendResetPasswordEmail, sendVerifyEmail } from "./email";

// Mock implementations for example purposes
const prisma = {} as any;
const entityService = {} as any;
const sessionService = {} as any;
const UserType = { CREATOR: 'CREATOR', USER: 'USER' };
const sendResetPasswordEmail = async (
  email: string,
  code: string,
  username?: string,
) => {};
const sendVerifyEmail = async (
  email: string,
  code: string,
  username?: string,
) => {};

// ==================== DEVELOPMENT CONFIG WITH TEST USERS ====================

const reAuthDevelopment = createReAuthEngine({
  plugins: [
    sessionPlugin(
      {
        rootHooks: {
          after: async (output, container, step) => {
            if (step.name === 'getSession' && output.entity && output.success) {
              const user = await prisma.user.findUnique({
                where: {
                  entity_id: output.entity.id as string,
                },
              });
              output.user = user;
            }
            return output;
          },
        },
      },
      [
        {
          name: 'getSession',
          override: {
            outputs: type({
              success: 'boolean',
              message: 'string',
              status: 'string',
              entity: 'object',
              'others?': 'object | undefined',
              user: 'object',
            }),
          },
        },
      ],
    ),

    emailPasswordAuth({
      verifyEmail: true,
      loginOnRegister: false,

      // ========== TEST USERS CONFIGURATION ==========
      testUsers: {
        enabled: true,
        environment: 'development', // Only works in development
        users: [
          {
            email: 'admin@test.com',
            password: 'admin123',
            profile: {
              id: 'test-admin-1',
              role: 'admin',
              email_verified: true,
              // Any additional fields for testing
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
          {
            email: 'developer@test.com',
            password: 'dev123',
            profile: {
              id: 'test-dev-1',
              role: 'developer',
              email_verified: true,
              firstName: 'Test',
              lastName: 'Developer',
              permissions: ['read', 'write', 'admin'],
            },
          },
        ],
      },
      // ===============================================

      sendCode: async (entity, code, email, type) => {
        try {
          let username = entity.username || undefined;

          // Special handling for existing test user (keep this for backward compatibility)
          if (
            email === 'test@famzzing.com' &&
            process.env.TEST_MODE === 'true'
          ) {
            await prisma.entity.update({
              where: {
                email: email as string,
              },
              data: {
                email_verified: true,
                email_verification_code: null,
              },
            });
            return;
          }

          if (!username) {
            const user = await prisma.user.findUnique({
              where: {
                email: email as string,
              },
              select: {
                first_name: true,
                last_name: true,
              },
            });

            if (user) {
              username = `${user.first_name?.toLowerCase()}.${user.last_name?.toLowerCase()}`;
            }
          }

          // Send appropriate email based on type
          if (type === 'verify') {
            await sendVerifyEmail(email, String(code), username);
            console.log(`✅ Verification email sent to ${email}`);
          } else if (type === 'reset') {
            await sendResetPasswordEmail(email, String(code), username);
            console.log(`✅ Password reset email sent to ${email}`);
          } else {
            console.log(`⚠️  Unknown email type: ${type}`);
          }
        } catch (error) {
          console.error('❌ Failed to send email:', error);
          // Don't throw error to avoid breaking the auth flow
        }
      },

      rootHooks: {
        before: async (input, container, step) => {
          if (step.name === 'register') {
            const { others } = input;
            if (
              typeof others !== 'object' ||
              !others.firstName ||
              !others.lastName ||
              !others.username ||
              !others.phone ||
              !others.role ||
              !others
            ) {
              throw new Error(
                'Invalid input, others must be an object with firstName, lastName, username, phone, role',
              );
            }
          }
          return input;
        },
        after: async (output, container, step) => {
          const { others, ...rest } = output;

          if (
            output.entity &&
            output.success &&
            step.name === 'register' &&
            others?.username &&
            others?.phone &&
            others?.firstName &&
            others?.lastName &&
            others?.role
          ) {
            await prisma.user.upsert({
              where: {
                email: output.entity.email as string,
              },
              update: {
                first_name: others.firstName,
                last_name: others.lastName,
                avatar_url: others.avatarUrl || null,
                entity_id: output.entity.id,
              },
              create: {
                email: output.entity.email as string,
                first_name: others.firstName,
                last_name: others.lastName,
                avatar_url: others.avatarUrl || null,
                entity_id: output.entity.id,
                username: others.username,
                phone: others.phone,
                type:
                  others.role === 'creator' ? UserType.CREATOR : UserType.USER,
              },
            });
          }

          return rest;
        },
      },
    }),

    phonePasswordAuth({
      verifyPhone: true,

      // ========== TEST USERS CONFIGURATION ==========
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
          {
            phone: '+0987654321',
            password: 'user123',
            profile: {
              id: 'test-phone-user-1',
              role: 'user',
              phone_verified: true,
              firstName: 'Phone',
              lastName: 'User',
            },
          },
        ],
      },
      // ===============================================

      sendCode: async (entity, code, phone) => {
        console.log('📱 SMS Code sent:', { phone, code });
        // In development, just log the code
        // In production, integrate with SMS service
      },
      rootHooks: {
        after: async (output, container, step) => {
          const { others, ...rest } = output;
          return rest;
        },
      },
    }),

    usernamePasswordAuth({
      loginOnRegister: true,

      // ========== TEST USERS CONFIGURATION ==========
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
          {
            username: 'testuser',
            password: 'user123',
            profile: {
              id: 'test-username-user-1',
              role: 'user',
              firstName: 'Username',
              lastName: 'User',
            },
          },
        ],
      },
      // ===============================================
    }),
  ],
  entity: entityService,
  session: sessionService,
});

// ==================== PRODUCTION CONFIG (NO TEST USERS) ====================

const reAuthProduction = createReAuthEngine({
  plugins: [
    sessionPlugin(
      {
        rootHooks: {
          after: async (output, container, step) => {
            if (step.name === 'getSession' && output.entity && output.success) {
              const user = await prisma.user.findUnique({
                where: {
                  entity_id: output.entity.id as string,
                },
              });
              output.user = user;
            }
            return output;
          },
        },
      },
      [
        {
          name: 'getSession',
          override: {
            outputs: type({
              success: 'boolean',
              message: 'string',
              status: 'string',
              entity: 'object',
              'others?': 'object | undefined',
              user: 'object',
            }),
          },
        },
      ],
    ),

    emailPasswordAuth({
      verifyEmail: true,
      loginOnRegister: false,
      // NO TEST USERS in production
      sendCode: async (entity, code, email, type) => {
        // Production email sending logic
        let username = entity.username || undefined;

        if (!username) {
          const user = await prisma.user.findUnique({
            where: { email: email as string },
            select: { first_name: true, last_name: true },
          });

          if (user) {
            username = `${user.first_name?.toLowerCase()}.${user.last_name?.toLowerCase()}`;
          }
        }

        if (type === 'verify') {
          await sendVerifyEmail(email, String(code), username);
        } else if (type === 'reset') {
          await sendResetPasswordEmail(email, String(code), username);
        }
      },
      // ... other production hooks
    }),

    phonePasswordAuth({
      verifyPhone: true,
      // NO TEST USERS in production
      sendCode: async (entity, code, phone) => {
        // Production SMS service integration
        console.log('Production SMS:', { phone, code });
      },
    }),

    usernamePasswordAuth({
      loginOnRegister: true,
      // NO TEST USERS in production
    }),
  ],
  entity: entityService,
  session: sessionService,
});

// ==================== TESTING CONFIG ====================

const reAuthTesting = createReAuthEngine({
  plugins: [
    sessionPlugin(),

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

    phonePasswordAuth({
      verifyPhone: false,
      testUsers: {
        enabled: true,
        environment: 'test',
        users: [
          {
            phone: '+1111111111',
            password: 'e2e-password',
            profile: {
              id: 'e2e-phone-user-1',
              role: 'user',
              phone_verified: true,
            },
          },
        ],
      },
      sendCode: async () => {}, // No-op for tests
    }),

    usernamePasswordAuth({
      testUsers: {
        enabled: true,
        environment: 'test',
        users: [
          {
            username: 'e2euser',
            password: 'e2e-password',
            profile: {
              id: 'e2e-username-user-1',
              role: 'user',
            },
          },
        ],
      },
    }),
  ],
  entity: entityService,
  session: sessionService,
});

// ==================== EXPORT BASED ON ENVIRONMENT ====================

const getReAuthEngine = () => {
  const env = process.env.NODE_ENV;

  switch (env) {
    case 'production':
      return reAuthProduction;
    case 'test':
      return reAuthTesting;
    case 'development':
    default:
      return reAuthDevelopment;
  }
};

const reAuth = getReAuthEngine();

export default reAuth;

// ==================== USAGE EXAMPLES ====================

/*
// === Development/Testing with Test Users ===

// Login with test user (development only)
const loginResult = await reAuth.executeStep('email', 'login', {
  email: 'admin@test.com',
  password: 'admin123'
});
console.log(loginResult);
// Output:
// {
//   success: true,
//   message: 'Login successful (test user)',
//   token: 'generated-token',
//   entity: { id: 'test-admin-1', role: 'admin', ... }
// }

// Register with test user (development only)
const registerResult = await reAuth.executeStep('email', 'register', {
  email: 'user@test.com',
  password: 'user123'
});

// Phone authentication with test user
const phoneResult = await reAuth.executeStep('phone', 'login', {
  phone: '+1234567890',
  password: 'test123'
});

// Username authentication with test user
const usernameResult = await reAuth.executeStep('username', 'login', {
  username: 'testadmin',
  password: 'admin123'
});

// === Production Usage (no test users) ===

// Normal production login - goes through database
const prodLoginResult = await reAuth.executeStep('email', 'login', {
  email: 'real.user@example.com',
  password: 'realPassword123!'
});

// === Session Management ===

// Get session
const sessionResult = await reAuth.executeStep('session', 'getSession', {
  token: 'session-token'
});

// Logout
const logoutResult = await reAuth.executeStep('session', 'logout', {
  token: 'session-token'
});

// === Testing in Jest/Vitest ===

describe('Authentication Tests', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should login with test user', async () => {
    const result = await reAuth.executeStep('email', 'login', {
      email: 'e2e@test.com',
      password: 'e2e-password'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('test user');
  });
});

// === Cypress E2E Tests ===

cy.visit('/login');
cy.get('[data-cy=email]').type('admin@test.com');
cy.get('[data-cy=password]').type('admin123');
cy.get('[data-cy=submit]').click();
cy.url().should('include', '/dashboard');

*/

export { reAuthDevelopment, reAuthProduction, reAuthTesting };
