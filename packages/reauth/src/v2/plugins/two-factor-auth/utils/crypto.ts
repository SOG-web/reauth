/**
 * Cross-platform cryptographic utilities for 2FA
 * Works with Web Crypto API (browsers, edge) and Node.js crypto module
 */

// Universal crypto interface that works across all runtimes
interface UniversalCrypto {
  getRandomValues(array: Uint8Array): Uint8Array;
  subtle: {
    digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer>;
    importKey(
      format: string,
      keyData: BufferSource,
      algorithm: any,
      extractable: boolean,
      keyUsages: string[]
    ): Promise<CryptoKey>;
    sign(
      algorithm: any,
      key: CryptoKey,
      data: BufferSource
    ): Promise<ArrayBuffer>;
  };
}

// Get crypto implementation based on runtime
function getCrypto(): UniversalCrypto {
  // Browser/Edge runtime
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto as UniversalCrypto;
  }
  
  // Node.js runtime
  if (typeof require !== 'undefined') {
    try {
      const { webcrypto } = require('crypto');
      return webcrypto as UniversalCrypto;
    } catch {
      // Fallback for older Node.js versions
      const crypto = require('crypto');
      return {
        getRandomValues: (array: Uint8Array) => {
          const buffer = crypto.randomBytes(array.length);
          array.set(buffer);
          return array;
        },
        subtle: {
          digest: async (algorithm: string, data: BufferSource) => {
            const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
            hash.update(Buffer.from(data as ArrayBuffer));
            return hash.digest().buffer;
          },
          importKey: async (format: string, keyData: BufferSource, algorithm: any) => {
            // Mock CryptoKey for Node.js fallback
            return { keyData, algorithm, extractable: false, type: 'secret', usages: ['sign'] } as any as CryptoKey;
          },
          sign: async (algorithm: any, key: any, data: BufferSource) => {
            const hashAlgo = algorithm.hash?.name?.replace('-', '') || 'sha1';
            const hmac = crypto.createHmac(hashAlgo.toLowerCase(), Buffer.from(key.keyData as ArrayBuffer));
            hmac.update(Buffer.from(data as ArrayBuffer));
            return hmac.digest().buffer;
          }
        }
      };
    }
  }
  
  throw new Error('No crypto implementation available');
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateSecureRandom(length: number): Uint8Array {
  const crypto = getCrypto();
  const array = new Uint8Array(length);
  return crypto.getRandomValues(array);
}

/**
 * Generate a random string for backup codes or secrets
 */
export function generateRandomString(length: number, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
  const bytes = generateSecureRandom(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i]! % charset.length];
  }
  return result;
}

/**
 * Generate TOTP secret (base32 encoded)
 */
export function generateTotpSecret(): string {
  const bytes = generateSecureRandom(20); // 160 bits
  return base32Encode(bytes);
}

/**
 * Base32 encoding for TOTP secrets (RFC 3548)
 */
function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let result = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Base32 decoding for TOTP secrets
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const result = new Uint8Array(Math.ceil((encoded.length * 5) / 8));

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i]!.toUpperCase();
    const charIndex = alphabet.indexOf(char);
    if (charIndex === -1) continue;

    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      result[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return result.slice(0, index);
}

/**
 * Generate HMAC hash for TOTP/HOTP
 */
export async function generateHmac(
  algorithm: 'SHA1' | 'SHA256' | 'SHA512',
  key: string,
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  const crypto = getCrypto();
  
  const keyBuffer = base32Decode(key);
  
  // Map algorithm names to Web Crypto API format
  const hashName = algorithm === 'SHA1' ? 'SHA-1' : algorithm === 'SHA256' ? 'SHA-256' : 'SHA-512';
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: hashName } },
    false,
    ['sign']
  );

  return await crypto.subtle.sign('HMAC', cryptoKey, data);
}

/**
 * Generate TOTP code (RFC 6238)
 */
export async function generateTotp(
  secret: string,
  timestamp?: number,
  digits = 6,
  period = 30,
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1'
): Promise<string> {
  const time = Math.floor((timestamp || Date.now()) / 1000);
  const counter = Math.floor(time / period);
  
  // Convert counter to 8-byte big-endian
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(4, counter, false); // Big-endian
  
  const hmac = await generateHmac(algorithm, secret, counterBuffer);
  const hmacArray = new Uint8Array(hmac);
  
  // Dynamic truncation (RFC 4226)
  const offset = hmacArray[hmacArray.length - 1]! & 0x0f;
  const binary = 
    ((hmacArray[offset]! & 0x7f) << 24) |
    ((hmacArray[offset + 1]!) << 16) |
    ((hmacArray[offset + 2]!) << 8) |
    (hmacArray[offset + 3]!);
  
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
export async function verifyTotp(
  code: string,
  secret: string,
  window = 1,
  timestamp?: number,
  digits = 6,
  period = 30,
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1'
): Promise<boolean> {
  const currentTime = timestamp || Date.now();
  
  // Check current time and time windows before/after
  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + (i * period * 1000);
    const expectedCode = await generateTotp(secret, testTime, digits, period, algorithm);
    
    if (constantTimeEqual(code, expectedCode)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate QR code URL for TOTP setup
 */
export function generateTotpQrUrl(
  secret: string,
  issuer: string,
  accountName: string,
  digits = 6,
  period = 30,
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1'
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: digits.toString(),
    period: period.toString(),
  });
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
}

/**
 * Hash a string using SHA-256 (for storing codes securely)
 */
export async function hashString(input: string): Promise<string> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}