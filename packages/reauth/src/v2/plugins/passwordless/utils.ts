import { randomBytes, createHash } from 'crypto';
import type { OrmLike } from '../../types.v2';

/**
 * Generate a secure random token for magic links
 */
export function generateMagicLinkToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a magic link token for secure storage
 */
export function hashMagicLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify if a magic link token matches the stored hash
 */
export function verifyMagicLinkToken(token: string, hash: string): boolean {
  const tokenHash = hashMagicLinkToken(token);
  return tokenHash === hash;
}

/**
 * Check if a magic link has expired
 */
export function isMagicLinkExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Generate expiration date for magic link
 */
export function getMagicLinkExpiration(ttlMinutes: number = 30): Date {
  const now = new Date();
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

/**
 * Clean up expired magic links (best effort, non-blocking)
 */
export async function cleanupExpiredMagicLinks(orm: OrmLike): Promise<void> {
  try {
    const now = new Date();
    await orm.deleteMany('magic_links', {
      where: (b: any) => b('expires_at', '<', now),
    });
  } catch (_) {
    // Best effort cleanup; never block auth flows
  }
}

/**
 * WebAuthn helper: Generate credential options for registration
 */
export function generateWebAuthnRegistrationOptions(
  userId: string,
  username: string,
  rpId: string,
  rpName: string,
) {
  return {
    challenge: randomBytes(32),
    rp: {
      id: rpId,
      name: rpName,
    },
    user: {
      id: Buffer.from(userId),
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };
}

/**
 * WebAuthn helper: Generate credential options for authentication
 */
export function generateWebAuthnAuthenticationOptions(
  allowCredentials: Array<{ id: string; type: 'public-key' }>,
  rpId: string,
) {
  return {
    challenge: randomBytes(32),
    allowCredentials,
    userVerification: 'preferred',
    rpId,
    timeout: 60000,
  };
}

/**
 * Validate WebAuthn credential ID format
 */
export function isValidCredentialId(credentialId: string): boolean {
  try {
    // Basic validation - should be base64-encoded
    const decoded = Buffer.from(credentialId, 'base64');
    return decoded.length >= 16; // Minimum reasonable credential ID length
  } catch {
    return false;
  }
}

/**
 * Generate a user-friendly name for a WebAuthn credential
 */
export function generateCredentialName(authenticatorType?: string): string {
  const timestamp = new Date().toLocaleDateString();
  const type = authenticatorType || 'Security Key';
  return `${type} (${timestamp})`;
}