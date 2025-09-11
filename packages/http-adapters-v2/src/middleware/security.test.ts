import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
  createSecurityMiddleware,
  createValidationMiddleware,
  createSecurityMiddlewares,
} from './security.js';

describe('Security Middleware', () => {
  const mockReq = {
    headers: {
      origin: 'https://example.com',
      'content-type': 'application/json',
    },
    ip: '127.0.0.1',
    body: { field: 'value' },
  };

  const mockRes = {
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCorsMiddleware', () => {
    it('should set default CORS headers', () => {
      const middleware = createCorsMiddleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle specific origin', () => {
      const middleware = createCorsMiddleware({
        origin: 'https://example.com',
      });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should handle array of origins', () => {
      const middleware = createCorsMiddleware({
        origin: ['https://example.com', 'https://test.com'],
      });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should handle credentials', () => {
      const middleware = createCorsMiddleware({
        credentials: true,
      });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should handle custom headers', () => {
      const middleware = createCorsMiddleware({
        allowedHeaders: ['Custom-Header'],
        exposedHeaders: ['X-Custom'],
      });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Custom-Header');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom');
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should create rate limiting middleware with defaults', () => {
      const middleware = createRateLimitMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should track requests by IP', () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        max: 10,
      });

      // First request should pass
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use custom key generator', () => {
      const customKeyGen = vi.fn().mockReturnValue('custom-key');
      const middleware = createRateLimitMiddleware({
        keyGenerator: customKeyGen,
      });

      middleware(mockReq, mockRes, mockNext);
      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
    });
  });

  describe('createSecurityMiddleware', () => {
    it('should set security headers by default', () => {
      const middleware = createSecurityMiddleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip security headers when disabled', () => {
      const middleware = createSecurityMiddleware({
        helmet: false,
      });
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.header).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createValidationMiddleware', () => {
    it('should validate input by default', () => {
      const middleware = createValidationMiddleware();
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip validation when disabled', () => {
      const middleware = createValidationMiddleware({
        validateInput: false,
      });
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle payload size limit', () => {
      const largeReq = {
        ...mockReq,
        body: { data: 'x'.repeat(2000000) }, // 2MB of data
      };

      const middleware = createValidationMiddleware({
        maxPayloadSize: 1024 * 1024, // 1MB limit
      });

      middleware(largeReq, mockRes, mockNext);
      
      // Should call next with error or handle oversized payload
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createSecurityMiddlewares', () => {
    it('should create array of middlewares', () => {
      const middlewares = createSecurityMiddlewares({
        cors: { origin: 'https://example.com' },
        security: { helmet: true },
        rateLimit: { max: 100 },
        validation: { validateInput: true },
      });

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(4);
      middlewares.forEach(middleware => {
        expect(typeof middleware).toBe('function');
      });
    });

    it('should create only specified middlewares', () => {
      const middlewares = createSecurityMiddlewares({
        cors: { origin: 'https://example.com' },
        security: { helmet: true },
      });

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(2);
    });

    it('should return empty array when no config provided', () => {
      const middlewares = createSecurityMiddlewares({});
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(0);
    });
  });
});