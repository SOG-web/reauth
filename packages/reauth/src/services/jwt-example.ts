/**
 * JWT Authentication System Usage Example
 *
 * This example demonstrates how to use the new JWT-based authentication system
 * alongside the existing session-based system.
 */

import { ReAuthEngine } from '../engine';
import { reauthDb } from '../db';
import jwtPlugin from '../plugins/jwt/plugin';
import emailPasswordPlugin from '../plugins/email-password/plugin';
import sessionPlugin from '../plugins/session/plugin';

// Example: Setting up ReAuth with JWT support
export async function createJWTEnabledReAuth() {
  // Create database factory (you would use your actual database adapter)
  const factory = reauthDb([
    // Include JWT schema along with other plugin schemas
  ]);

  // Create database client with your adapter
  // const dbClient = factory.client(yourDatabaseAdapter);

  // For this example, we'll assume dbClient is created
  const dbClient = {} as any; // Replace with actual client

  // Create ReAuth engine with JWT plugin
  const reauth = new ReAuthEngine({
    dbClient,
    plugins: [
      // Core session plugin (for legacy support)
      sessionPlugin({
        maxConcurrentSessions: 5,
        deviceTrackingEnabled: true,
      }),

      // JWT plugin (new JWT-based authentication)
      jwtPlugin({
        issuer: 'my-app',
        defaultAccessTokenTtlSeconds: 900, // 15 minutes
        keyRotationIntervalDays: 10,
        enableBlacklist: true,
        enableLegacyTokenSupport: true, // Support both JWT and legacy tokens
      }),

      // Authentication plugins work with both systems
      emailPasswordPlugin({
        verifyEmail: true,
        sendCode: async (subject, code, email, type) => {
          console.log(`Sending ${type} code ${code} to ${email}`);
          // Your email sending logic here
        },
      }),
    ],
  });

  return reauth;
}

// Example: Using JWT authentication in your application
export async function jwtAuthenticationExample() {
  const reauth = await createJWTEnabledReAuth();

  // 1. User registers/logs in using existing plugins
  const loginResult = await reauth.executeStep('email-password', 'login', {
    email: 'user@example.com',
    password: 'password123',
  });

  if (!loginResult.success) {
    throw new Error('Login failed');
  }

  // 2. Create JWT token for the authenticated user
  const jwtResult = await reauth.executeStep('jwt', 'create-jwt-token', {
    subjectType: 'subject',
    subjectId: loginResult.subject.id,
  });

  if (!jwtResult.success) {
    throw new Error('JWT creation failed');
  }

  console.log('JWT Token:', jwtResult.token);
  console.log('Expires in:', jwtResult.expiresIn, 'seconds');

  // 3. Verify JWT token (e.g., in API middleware)
  const verifyResult = await reauth.executeStep('jwt', 'verify-jwt-token', {
    token: jwtResult.token,
  });

  if (verifyResult.success) {
    console.log('Token is valid for user:', verifyResult.subject);
    console.log('JWT payload:', verifyResult.payload);
  }

  // 4. Get public JWKS keys (for client-side verification)
  const jwksResult = await reauth.executeStep('jwt', 'get-jwks', {});

  if (jwksResult.success) {
    console.log('Public JWKS keys:', jwksResult.keys);
  }

  // 5. Blacklist token (logout)
  const blacklistResult = await reauth.executeStep(
    'jwt',
    'blacklist-jwt-token',
    {
      token: jwtResult.token,
      reason: 'logout',
    },
  );

  if (blacklistResult.success) {
    console.log('Token blacklisted successfully');
  }

  // 6. Hybrid token verification (supports both JWT and legacy tokens)
  const sessionService = reauth.getSessionService() as any;

  if (sessionService.verifyAnyToken) {
    const hybridResult = await sessionService.verifyAnyToken(jwtResult.token);
    console.log('Token type:', hybridResult.type); // 'jwt' or 'legacy'
    console.log('Subject:', hybridResult.subject);
  }
}

// Example: Client registration for JWT verification
export async function clientRegistrationExample() {
  const reauth = await createJWTEnabledReAuth();

  // Clients can register to get access to JWKS endpoint
  // This is useful for microservices that need to verify JWTs

  // Get JWKS for token verification
  const jwksResult = await reauth.executeStep('jwt', 'get-jwks', {});

  if (jwksResult.success) {
    // Clients can use these public keys to verify JWT tokens
    const publicKeys = jwksResult.keys;

    // Example: Save keys for client-side verification
    console.log('Available public keys for verification:', publicKeys.length);

    publicKeys.forEach((key: any) => {
      console.log(`Key ID: ${key.kid}, Algorithm: ${key.alg}`);
    });
  }
}

// Example: Migration from legacy tokens to JWT
export async function migrationExample() {
  const reauth = await createJWTEnabledReAuth();

  // During migration, you can support both token types
  const sessionService = reauth.getSessionService() as any;

  // Function to handle any token type
  async function authenticateRequest(token: string) {
    if (!sessionService.verifyAnyToken) {
      throw new Error('Hybrid token support not available');
    }

    const result = await sessionService.verifyAnyToken(token);

    if (!result.subject) {
      throw new Error('Invalid token');
    }

    console.log(`Authenticated via ${result.type} token`);
    return result.subject;
  }

  // This function works with both JWT and legacy tokens
  // allowing for gradual migration

  return { authenticateRequest };
}

// Example: Key rotation
export async function keyRotationExample() {
  const reauth = await createJWTEnabledReAuth();
  const sessionService = reauth.getSessionService() as any;

  if (sessionService.jwtService) {
    // Manual key rotation
    const newKey = await sessionService.jwtService.rotateKeys('manual');
    console.log('New key generated:', newKey.keyId);

    // Get all active keys (includes old keys in grace period)
    const activeKeys = await sessionService.jwtService.getAllActiveKeys();
    console.log('Active keys:', activeKeys.length);

    // Cleanup expired keys
    const cleanedCount = await sessionService.jwtService.cleanupExpiredKeys();
    console.log('Cleaned up keys:', cleanedCount);
  }
}

// Export examples for testing
export const examples = {
  createJWTEnabledReAuth,
  jwtAuthenticationExample,
  clientRegistrationExample,
  migrationExample,
  keyRotationExample,
};
