/**
 * Cross-Platform Cryptographic Utilities for SSO Plugin V2
 * Protocol-agnostic crypto operations using Web Crypto API with Node.js fallbacks
 */

/**
 * Cross-platform crypto interface
 * Uses Web Crypto API when available, falls back to Node.js crypto
 */
export class CrossPlatformCrypto {
  private static getWebCrypto(): Crypto | null {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto;
    }
    if (typeof self !== 'undefined' && self.crypto) {
      return self.crypto;
    }
    return null;
  }

  private static async getNodeCrypto(): Promise<any> {
    try {
      // Dynamic import to avoid issues in non-Node environments
      const crypto = await import('crypto');
      return crypto;
    } catch {
      return null;
    }
  }

  /**
   * Generate random bytes
   */
  static async randomBytes(length: number): Promise<Uint8Array> {
    const webCrypto = this.getWebCrypto();
    if (webCrypto) {
      return webCrypto.getRandomValues(new Uint8Array(length));
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto) {
      return new Uint8Array(nodeCrypto.randomBytes(length));
    }

    throw new Error('No crypto implementation available');
  }

  /**
   * Generate random string for IDs and nonces
   */
  static async randomString(length: number = 32): Promise<string> {
    const bytes = await this.randomBytes(length);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate random ID with prefix
   */
  static async generateId(prefix: string = 'id'): Promise<string> {
    const randomPart = await this.randomString(16);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  /**
   * Base64 URL encode (without padding)
   */
  static base64UrlEncode(data: Uint8Array): string {
    const webCrypto = this.getWebCrypto();
    if (webCrypto && typeof btoa !== 'undefined') {
      const base64 = btoa(String.fromCharCode(...data));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    // Manual implementation for environments without btoa
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    let i = 0;
    
    while (i < data.length) {
      const a = data[i++] || 0;
      const b = data[i++] || 0;
      const c = data[i++] || 0;
      
      result += chars[a >> 2];
      result += chars[((a & 3) << 4) | (b >> 4)];
      if (i - 2 < data.length) result += chars[((b & 15) << 2) | (c >> 6)];
      if (i - 1 < data.length) result += chars[c & 63];
    }
    
    return result;
  }

  /**
   * Base64 URL decode
   */
  static base64UrlDecode(encoded: string): Uint8Array {
    // Add padding if needed
    const padded = encoded.padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '=');
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');

    if (typeof atob !== 'undefined') {
      const binary = atob(base64);
      return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
    }

    // Manual implementation for environments without atob
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const result: number[] = [];
    let i = 0;

    while (i < base64.length) {
      const a = chars.indexOf(base64[i++]) || 0;
      const b = chars.indexOf(base64[i++]) || 0;
      const c = chars.indexOf(base64[i++]) || 0;
      const d = chars.indexOf(base64[i++]) || 0;

      result.push((a << 2) | (b >> 4));
      if (c !== 64) result.push(((b & 15) << 4) | (c >> 2));
      if (d !== 64) result.push(((c & 3) << 6) | d);
    }

    return new Uint8Array(result);
  }

  /**
   * SHA-256 hash
   */
  static async sha256(data: string | Uint8Array): Promise<Uint8Array> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    
    const webCrypto = this.getWebCrypto();
    if (webCrypto && webCrypto.subtle) {
      const hashBuffer = await webCrypto.subtle.digest('SHA-256', bytes);
      return new Uint8Array(hashBuffer);
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto) {
      const hash = nodeCrypto.createHash('sha256');
      hash.update(bytes);
      return new Uint8Array(hash.digest());
    }

    throw new Error('No crypto implementation available for SHA-256');
  }

  /**
   * SHA-1 hash (for legacy SAML support)
   */
  static async sha1(data: string | Uint8Array): Promise<Uint8Array> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    
    const webCrypto = this.getWebCrypto();
    if (webCrypto && webCrypto.subtle) {
      const hashBuffer = await webCrypto.subtle.digest('SHA-1', bytes);
      return new Uint8Array(hashBuffer);
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto) {
      const hash = nodeCrypto.createHash('sha1');
      hash.update(bytes);
      return new Uint8Array(hash.digest());
    }

    throw new Error('No crypto implementation available for SHA-1');
  }

  /**
   * Import RSA key from PEM string
   */
  static async importRSAKey(
    pemKey: string, 
    usage: 'sign' | 'verify',
    algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
  ): Promise<CryptoKey | any> {
    const webCrypto = this.getWebCrypto();
    if (webCrypto && webCrypto.subtle) {
      // Remove PEM headers and decode
      const pemHeader = pemKey.includes('PRIVATE') ? 
        '-----BEGIN PRIVATE KEY-----' : '-----BEGIN CERTIFICATE-----';
      const pemFooter = pemKey.includes('PRIVATE') ? 
        '-----END PRIVATE KEY-----' : '-----END CERTIFICATE-----';
      
      const pemContents = pemKey
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
      
      const keyData = this.base64UrlDecode(pemContents);
      
      const keyUsages: KeyUsage[] = usage === 'sign' ? ['sign'] : ['verify'];
      const keyFormat = pemKey.includes('PRIVATE') ? 'pkcs8' : 'spki';
      
      return await webCrypto.subtle.importKey(
        keyFormat,
        keyData,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: algorithm === 'SHA-256' ? 'SHA-256' : 'SHA-1',
        },
        false,
        keyUsages
      );
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto) {
      // Return the raw PEM for Node.js crypto
      return pemKey;
    }

    throw new Error('No crypto implementation available for RSA key import');
  }

  /**
   * Sign data with RSA key
   */
  static async rsaSign(
    data: string | Uint8Array, 
    privateKey: CryptoKey | string,
    algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
  ): Promise<Uint8Array> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    
    const webCrypto = this.getWebCrypto();
    if (webCrypto && webCrypto.subtle && typeof privateKey === 'object') {
      const signature = await webCrypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        bytes
      );
      return new Uint8Array(signature);
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto && typeof privateKey === 'string') {
      const sign = nodeCrypto.createSign(algorithm === 'SHA-256' ? 'RSA-SHA256' : 'RSA-SHA1');
      sign.update(bytes);
      return new Uint8Array(sign.sign(privateKey));
    }

    throw new Error('No crypto implementation available for RSA signing');
  }

  /**
   * Verify RSA signature
   */
  static async rsaVerify(
    data: string | Uint8Array,
    signature: Uint8Array,
    publicKey: CryptoKey | string,
    algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256'
  ): Promise<boolean> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    
    const webCrypto = this.getWebCrypto();
    if (webCrypto && webCrypto.subtle && typeof publicKey === 'object') {
      return await webCrypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signature,
        bytes
      );
    }

    const nodeCrypto = await this.getNodeCrypto();
    if (nodeCrypto && typeof publicKey === 'string') {
      const verify = nodeCrypto.createVerify(algorithm === 'SHA-256' ? 'RSA-SHA256' : 'RSA-SHA1');
      verify.update(bytes);
      return verify.verify(publicKey, signature);
    }

    throw new Error('No crypto implementation available for RSA verification');
  }

  /**
   * Generate timestamp for SAML
   */
  static generateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if timestamp is within allowed skew
   */
  static isTimestampValid(
    timestamp: string, 
    maxSkewSeconds: number = 300
  ): boolean {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const skewMs = maxSkewSeconds * 1000;
    
    return Math.abs(now - time) <= skewMs;
  }

  /**
   * Generate UUID v4
   */
  static async generateUUID(): Promise<string> {
    const bytes = await this.randomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }
}