import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedJWKSService } from './jwt-service';
import type { FumaClient } from './types';

// Mock FumaClient for testing
const createMockFumaClient = (): FumaClient => {
  const mockData = new Map();
  
  return {
    version: async () => 'v1',
    orm: () => ({
      create: async (table: string, data: any) => {
        const id = Math.random().toString(36).substring(7);
        const record = { id, ...data, created_at: new Date().toISOString() };
        if (!mockData.has(table)) mockData.set(table, []);
        mockData.get(table).push(record);
        return record;
      },
      findFirst: async (table: string, options: any) => {
        const records = mockData.get(table) || [];
        return records.find((r: any) => {
          // Simple mock where clause evaluation
          if (options.where) {
            // This is a simplified mock - in real tests you'd need proper where clause handling
            return true;
          }
          return records[0];
        }) || null;
      },
      findMany: async (table: string, options: any) => {
        return mockData.get(table) || [];
      },
      updateMany: async (table: string, options: any) => {
        const records = mockData.get(table) || [];
        records.forEach((record: any) => {
          Object.assign(record, options.set);
        });
        return records.length;
      },
      deleteMany: async (table: string, options: any) => {
        const records = mockData.get(table) || [];
        mockData.set(table, []);
        return records.length;
      },
      count: async (table: string, options: any) => {
        const records = mockData.get(table) || [];
        return records.length;
      },
    }),
  } as FumaClient;
};

describe('JWT Refresh Token Functionality', () => {
  let jwtService: EnhancedJWKSService;
  let mockClient: FumaClient;

  beforeEach(() => {
    mockClient = createMockFumaClient();
    jwtService = new EnhancedJWKSService(
      mockClient,
      'test-issuer',
      10, // keyRotationIntervalDays
      2,  // keyGracePeriodDays
      900, // defaultAccessTokenTtlSeconds (15 minutes)
      2592000, // defaultRefreshTokenTtlSeconds (30 days)
      true // enableRefreshTokenRotation
    );
  });

  it('should create a token pair with access and refresh tokens', async () => {
    const payload = {
      sub: 'user123',
      subject_type: 'user',
    };

    const deviceInfo = {
      fingerprint: 'device123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    };

    const tokenPair = await jwtService.createTokenPair(payload, deviceInfo);

    expect(tokenPair).toHaveProperty('accessToken');
    expect(tokenPair).toHaveProperty('refreshToken');
    expect(tokenPair).toHaveProperty('tokenType', 'Bearer');
    expect(tokenPair).toHaveProperty('accessTokenExpiresAt');
    expect(tokenPair).toHaveProperty('refreshTokenExpiresAt');
    
    expect(typeof tokenPair.accessToken).toBe('string');
    expect(typeof tokenPair.refreshToken).toBe('string');
    expect(tokenPair.accessToken.length).toBeGreaterThan(0);
    expect(tokenPair.refreshToken.length).toBeGreaterThan(0);
  });

  it('should generate a refresh token', async () => {
    const refreshToken = await jwtService.generateRefreshToken(
      'user',
      'user123',
      {
        fingerprint: 'device123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      }
    );

    expect(typeof refreshToken).toBe('string');
    expect(refreshToken.length).toBeGreaterThan(0);
  });

  it('should validate a refresh token', async () => {
    const refreshToken = await jwtService.generateRefreshToken('user', 'user123');
    
    const validation = await jwtService.validateRefreshToken(refreshToken);
    
    expect(validation.isValid).toBe(true);
    expect(validation.token).toBeDefined();
    expect(validation.token?.subjectType).toBe('user');
    expect(validation.token?.subjectId).toBe('user123');
  });

  it('should reject invalid refresh token', async () => {
    const validation = await jwtService.validateRefreshToken('invalid-token');
    
    expect(validation.isValid).toBe(false);
    expect(validation.error).toBeDefined();
    expect(validation.token).toBeUndefined();
  });

  it('should refresh access token using refresh token', async () => {
    // First create a token pair
    const payload = { sub: 'user123', subject_type: 'user' };
    const originalTokenPair = await jwtService.createTokenPair(payload);
    
    // Then refresh the access token
    const newTokenPair = await jwtService.refreshAccessToken(originalTokenPair.refreshToken);
    
    expect(newTokenPair).toHaveProperty('accessToken');
    expect(newTokenPair).toHaveProperty('refreshToken');
    expect(newTokenPair.accessToken).not.toBe(originalTokenPair.accessToken);
    
    // With rotation enabled, refresh token should also be different
    expect(newTokenPair.refreshToken).not.toBe(originalTokenPair.refreshToken);
  });

  it('should revoke a refresh token', async () => {
    const refreshToken = await jwtService.generateRefreshToken('user', 'user123');
    
    // Verify token is valid before revocation
    let validation = await jwtService.validateRefreshToken(refreshToken);
    expect(validation.isValid).toBe(true);
    
    // Revoke the token
    await jwtService.revokeRefreshToken(refreshToken, 'logout');
    
    // Verify token is invalid after revocation
    validation = await jwtService.validateRefreshToken(refreshToken);
    expect(validation.isValid).toBe(false);
  });

  it('should revoke all refresh tokens for a subject', async () => {
    // Create multiple refresh tokens for the same subject
    const token1 = await jwtService.generateRefreshToken('user', 'user123');
    const token2 = await jwtService.generateRefreshToken('user', 'user123');
    
    // Revoke all tokens for the subject
    const revokedCount = await jwtService.revokeAllRefreshTokens('user', 'user123', 'security');
    
    expect(revokedCount).toBe(2);
    
    // Verify both tokens are now invalid
    const validation1 = await jwtService.validateRefreshToken(token1);
    const validation2 = await jwtService.validateRefreshToken(token2);
    
    expect(validation1.isValid).toBe(false);
    expect(validation2.isValid).toBe(false);
  });
});