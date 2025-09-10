import { randomBytes } from 'crypto';
import { hashPassword, verifyPasswordHash } from '../../../lib/password';
import type { ApiKeyConfigV2 } from './types';

/**
 * Generate a cryptographically secure API key
 */
export function generateApiKey(config: ApiKeyConfigV2 = {}): string {
  const keyLength = config.keyLength || 32;
  const keyPrefix = config.keyPrefix || 'ak_';
  
  // Generate random bytes and convert to base64url (URL-safe)
  const randomKey = randomBytes(keyLength)
    .toString('base64url')
    .slice(0, keyLength);
    
  return `${keyPrefix}${randomKey}`;
}

/**
 * Hash an API key for secure storage (same security as passwords)
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return hashPassword(apiKey);
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return verifyPasswordHash(hash, apiKey);
}

/**
 * Check if an API key is expired
 */
export function isApiKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

/**
 * Calculate expiration date from TTL days
 */
export function calculateExpirationDate(ttlDays?: number, defaultTtlDays = 365): Date {
  const days = ttlDays || defaultTtlDays;
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  return expirationDate;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string, prefix = 'ak_'): boolean {
  if (!apiKey.startsWith(prefix)) return false;
  
  const keyPart = apiKey.slice(prefix.length);
  // Should be base64url characters only
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(keyPart) && keyPart.length >= 20; // Minimum 20 chars
}

/**
 * Validate scopes against allowed scopes
 */
export function validateScopes(
  scopes: string[] | undefined,
  allowedScopes: string[] | undefined
): string[] {
  const errors: string[] = [];
  
  if (!scopes) return errors;
  if (!allowedScopes) return errors; // No restrictions
  
  for (const scope of scopes) {
    if (!allowedScopes.includes(scope)) {
      errors.push(`Invalid scope: ${scope}. Allowed scopes: ${allowedScopes.join(', ')}`);
    }
  }
  
  return errors;
}

/**
 * Sanitize API key metadata for public consumption (never include hash)
 */
export function sanitizeApiKeyMetadata(apiKey: any): any {
  const { key_hash, ...metadata } = apiKey;
  return {
    ...metadata,
    // Convert database timestamps to Date objects if needed
    last_used_at: metadata.last_used_at ? new Date(metadata.last_used_at) : null,
    expires_at: metadata.expires_at ? new Date(metadata.expires_at) : null,
    created_at: new Date(metadata.created_at),
    updated_at: new Date(metadata.updated_at),
  };
}

/**
 * Check if a subject has reached their API key limit
 */
export async function checkApiKeyLimit(
  orm: any,
  subjectId: string,
  maxKeys: number | undefined
): Promise<boolean> {
  if (!maxKeys) return false; // No limit
  
  const count = await orm.count('api_keys', {
    where: (b: any) => b.and(
      b('subject_id', '=', subjectId),
      b('is_active', '=', true)
    ),
  });
  
  return count >= maxKeys;
}

/**
 * Clean up expired API keys
 */
export async function cleanupExpiredApiKeys(orm: any): Promise<number> {
  const now = new Date();
  
  const result = await orm.updateMany('api_keys', {
    where: (b: any) => b.and(
      b('expires_at', '!=', null),
      b('expires_at', '<', now),
      b('is_active', '=', true)
    ),
    data: {
      is_active: false,
      updated_at: now,
    },
  });
  
  return result.count || 0;
}

/**
 * Clean up old usage logs
 */
export async function cleanupOldUsageLogs(
  orm: any,
  olderThanDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  const result = await orm.deleteMany('api_key_usage', {
    where: (b: any) => b('used_at', '<', cutoffDate),
  });
  
  return result.count || 0;
}