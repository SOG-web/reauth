/**
 * Example usage of the passwordless plugin V2
 * This demonstrates how to configure and use magic links and WebAuthn authentication
 */

import passwordlessPluginV2, { type PasswordlessConfigV2 } from './plugin.v2';
import { ReAuthEngineV2 } from '../../engine.v2';

// Example 1: Magic Links Only
const magicLinksConfig: PasswordlessConfigV2 = {
  magicLinks: true,
  sendMagicLink: async (email: string, token: string, subject: any) => {
    console.log(`Sending magic link to ${email}`);
    console.log(
      `Magic link: https://example.com/auth/magic-link?token=${token}`,
    );
    console.log(`Subject:`, subject);
  },
  sessionTtlSeconds: 3600, // 1 hour
  magicLinkTtlMinutes: 30, // 30 minutes
};

// Example 2: WebAuthn Only
const webAuthnConfig: PasswordlessConfigV2 = {
  webauthn: true,
  rpId: 'example.com',
  rpName: 'Example App',
  sessionTtlSeconds: 7200, // 2 hours
};

// Example 3: Both Magic Links and WebAuthn
const hybridConfig: PasswordlessConfigV2 = {
  magicLinks: true,
  sendMagicLink: async (email: string, token: string, subject: any) => {
    // In a real app, you'd send an email via your email service
    console.log(
      `📧 Magic link sent to ${email}: https://example.com/auth?token=${token}`,
    );
  },
  webauthn: true,
  rpId: 'example.com',
  rpName: 'Example App',
  sessionTtlSeconds: 3600,
  magicLinkTtlMinutes: 15,
};

// Example usage with ReAuth Engine V2
export async function examplePasswordlessUsage() {
  // This would be your actual database client
  const mockDbClient = {
    version: async () => '1.0.0',
    orm: () => ({}) as any, // Mock ORM
  };

  const engine = new ReAuthEngineV2({
    dbClient: mockDbClient,
    plugins: [
      passwordlessPluginV2 as any, // Type assertion to bypass complex generic constraints
    ],
  });

  console.log('✅ Passwordless plugin loaded successfully');

  // Example flows:
  console.log('\n📋 Available passwordless authentication flows:');
  console.log('1. Send Magic Link: POST /auth/passwordless/send-magic-link');
  console.log(
    '2. Verify Magic Link: POST /auth/passwordless/verify-magic-link',
  );
  console.log(
    '3. Register WebAuthn: POST /auth/passwordless/register-webauthn',
  );
  console.log(
    '4. Authenticate WebAuthn: POST /auth/passwordless/authenticate-webauthn',
  );
  console.log('5. List Credentials: GET /auth/passwordless/list-credentials');
  console.log(
    '6. Revoke Credential: DELETE /auth/passwordless/revoke-credential',
  );

  return engine;
}

// Example step execution (would be called by HTTP adapters)
export async function exampleStepExecution() {
  const engine = await examplePasswordlessUsage();

  try {
    // Example: Send magic link
    const sendResult = await engine.executeStep(
      'passwordless',
      'send-magic-link',
      {
        email: 'user@example.com',
      },
    );
    console.log('\n📧 Send Magic Link Result:', sendResult);

    // Example: Register WebAuthn credential
    const registerResult = await engine.executeStep(
      'passwordless',
      'register-webauthn',
      {
        subject_id: 'user123',
        credential_id: 'base64-encoded-credential-id',
        public_key: 'base64-encoded-public-key',
        name: 'My Security Key',
      },
    );
    console.log('\n🔐 WebAuthn Registration Result:', registerResult);
  } catch (error) {
    console.error('❌ Error executing passwordless steps:', error);
  }
}

// Configuration examples
export const passwordlessConfigExamples = {
  magicLinksOnly: magicLinksConfig,
  webAuthnOnly: webAuthnConfig,
  hybrid: hybridConfig,
};

console.log('\n🔧 Passwordless Plugin V2 Examples');
console.log('Available configurations:');
console.log('- Magic Links Only: Simple email-based passwordless auth');
console.log('- WebAuthn Only: Hardware security key / biometric auth');
console.log('- Hybrid: Both magic links and WebAuthn support');
