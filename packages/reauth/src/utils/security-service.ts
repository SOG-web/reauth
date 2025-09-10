import { declare, type Type } from 'arktype';
import type { AwilixContainer } from 'awilix';
import type { ReAuthCradle, ValidationResult } from '../types';

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  type:
    | 'authentication'
    | 'authorization'
    | 'rate_limit'
    | 'validation'
    | 'suspicious_activity';
  pluginName: string;
  stepName?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Security configuration for plugins
 */
export interface SecurityConfig {
  enableAuditLogging: boolean;
  sensitiveFieldRedaction: boolean;
  timingAttackProtection: boolean;
  inputSanitization: boolean;
}

/**
 * Core security service interface
 */
export interface SecurityService {
  /**
   * Validate input using ArkType schema
   */
  validateInput<T>(schema: Type<T>, input: any): Promise<ValidationResult>;

  /**
   * Log security event for audit trail
   */
  logSecurityEvent(event: SecurityEvent): Promise<void>;

  /**
   * Hash sensitive data securely
   */
  hashSensitiveData(data: string, salt?: string): Promise<string>;

  /**
   * Verify hashed data
   */
  verifySensitiveData(data: string, hash: string): Promise<boolean>;

  /**
   * Sanitize input to prevent injection attacks
   */
  sanitizeInput(input: any): any;

  /**
   * Generate cryptographically secure random string
   */
  generateSecureToken(length?: number): Promise<string>;

  /**
   * Implement timing-safe string comparison
   */
  timingSafeEqual(a: string, b: string): boolean;

  /**
   * Redact sensitive fields from object
   */
  redactSensitiveFields(obj: any, sensitiveFields: string[]): any;
}

/**
 * Base implementation of SecurityService
 */
export class BaseSecurityService implements SecurityService {
  async validateInput<T>(
    schema: Type<T>,
    input: any,
  ): Promise<ValidationResult> {
    try {
      const result = schema(input);
      if (result instanceof schema.errors) {
        return {
          isValid: false,
          errors: result.summary,
        };
      }
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errors: { validation: 'Schema validation failed' },
      };
    }
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    // Base implementation logs to console
    // Production implementations should use proper logging service
    const logLevel =
      event.severity === 'critical' || event.severity === 'high'
        ? 'error'
        : 'warn';
    console[logLevel](
      `[SECURITY] ${event.type.toUpperCase()}: ${event.message}`,
      {
        plugin: event.pluginName,
        step: event.stepName,
        entityId: event.entityId,
        timestamp: event.timestamp.toISOString(),
        metadata: event.metadata,
      },
    );
  }

  async hashSensitiveData(data: string, salt?: string): Promise<string> {
    // Basic implementation - production should use bcrypt or similar
    const crypto = await import('node:crypto');
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 600000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  async verifySensitiveData(data: string, hash: string): Promise<boolean> {
    try {
      const [salt, storedHash] = hash.split(':');
      if (!salt || !storedHash) return false;

      const newHash = await this.hashSensitiveData(data, salt);
      const [, newHashValue] = newHash.split(':');

      return this.timingSafeEqual(storedHash, newHashValue || '');
    } catch {
      return false;
    }
  }

  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Basic HTML/script tag removal
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeInput(item));
    }

    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  async generateSecureToken(length = 32): Promise<string> {
    const crypto = await import('node:crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  redactSensitiveFields(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const redacted = { ...obj };
    for (const field of sensitiveFields) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
    }

    return redacted;
  }
}

/**
 * Factory function to create security service
 */
export function createSecurityService(
  config?: Partial<SecurityConfig>,
): SecurityService {
  return new BaseSecurityService();
}

/**
 * Register security service in DI container
 */
export function registerSecurityService(
  container: AwilixContainer<ReAuthCradle>,
  config?: Partial<SecurityConfig>,
): void {
  container.register({
    securityService: {
      resolve: () => createSecurityService(config),
      lifetime: 'SINGLETON',
    },
  });
}

declare module '../types' {
  interface ReAuthCradleExtension {
    securityService: SecurityService;
  }
}
