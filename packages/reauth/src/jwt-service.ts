import {
  generateKeyPair,
  SignJWT,
  jwtVerify,
  importJWK,
  exportJWK,
} from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import type { FumaClient } from './types';
import type {
  EnhancedJWKSService as JWTServiceType,
  JWKSKey,
  ReAuthJWTPayload,
  RotationReason,
  BlacklistReason,
  RefreshToken,
  RefreshTokenRevocationReason,
  RefreshTokenValidationResult,
  TokenPair,
} from './jwt.types';

export class EnhancedJWKSService implements JWTServiceType {
  private keyCache = new Map<string, JWKSKey>();
  private activeKeyCache: JWKSKey | null = null;
  private publicJWKSCache: { keys: any[] } | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private dbClient: FumaClient,
    private issuer: string = 'reauth',
    private keyRotationIntervalDays: number = 10,
    private keyGracePeriodDays: number = 2,
    private defaultAccessTokenTtlSeconds: number = 15 * 60, // 15 minutes
    private defaultRefreshTokenTtlSeconds: number = 30 * 24 * 60 * 60, // 30 days
    private enableRefreshTokenRotation: boolean = true,
  ) {}

  async generateKeyPair(algorithm: string = 'RS256'): Promise<JWKSKey> {
    const { publicKey, privateKey } = await generateKeyPair(algorithm);
    const keyId = this.generateKeyId();

    const publicJWK = JSON.stringify(await exportJWK(publicKey));
    const privateJWK = JSON.stringify(await exportJWK(privateKey));

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const keyRecord = await orm.create('jwks_keys', {
      key_id: keyId,
      algorithm,
      public_key: publicJWK,
      private_key: privateJWK,
      is_active: true,
      expires_at: new Date(
        Date.now() + this.keyRotationIntervalDays * 24 * 60 * 60 * 1000,
      ),
    });

    const jwksKey: JWKSKey = {
      id: keyRecord.id as string,
      keyId,
      algorithm,
      publicKey,
      privateKey,
      isActive: true,
      createdAt: new Date(keyRecord.created_at as string),
      expiresAt: keyRecord.expires_at
        ? new Date(keyRecord.expires_at as string)
        : undefined,
      usageCount: 0,
    };

    // Update cache
    this.keyCache.set(keyId, jwksKey);
    this.clearPublicJWKSCache();

    return jwksKey;
  }

  async getActiveKey(): Promise<JWKSKey> {
    // Check cache first
    if (this.activeKeyCache && Date.now() < this.cacheExpiry) {
      return this.activeKeyCache;
    }

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const keyRecord = await orm.findFirst('jwks_keys', {
      where: (b: any) => b('is_active', '=', true),
      orderBy: [['created_at', 'desc']],
    });

    if (!keyRecord) {
      // No active key found, generate one
      return await this.generateKeyPair();
    }

    const jwksKey = await this.recordToJWKSKey(keyRecord);

    // Check if key needs rotation
    if (jwksKey.expiresAt && jwksKey.expiresAt <= new Date()) {
      return await this.rotateKeys('scheduled');
    }

    // Update cache
    this.activeKeyCache = jwksKey;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return jwksKey;
  }

  async getAllActiveKeys(): Promise<JWKSKey[]> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const keyRecords = await orm.findMany('jwks_keys', {
      where: (b: any) => b('is_active', '=', true),
      orderBy: [['created_at', 'desc']],
    });

    const keys: JWKSKey[] = [];
    for (const record of keyRecords) {
      keys.push(await this.recordToJWKSKey(record));
    }

    return keys;
  }

  async rotateKeys(reason: RotationReason = 'scheduled'): Promise<JWKSKey> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Get current active key
    const currentKey = await orm.findFirst('jwks_keys', {
      where: (b: any) => b('is_active', '=', true),
      orderBy: [['created_at', 'desc']],
    });

    // Generate new key
    const newKey = await this.generateKeyPair();

    // Record rotation
    await orm.create('jwks_key_rotations', {
      old_key_id: currentKey?.key_id || null,
      new_key_id: newKey.keyId,
      rotation_reason: reason,
    });

    // Keep old key active for grace period if it exists
    if (currentKey) {
      const gracePeriodEnd = new Date(
        Date.now() + this.keyGracePeriodDays * 24 * 60 * 60 * 1000,
      );
      await orm.updateMany('jwks_keys', {
        where: (b: any) => b('key_id', '=', currentKey.key_id),
        set: { expires_at: gracePeriodEnd },
      });
    }

    // Clear caches
    this.activeKeyCache = null;
    this.keyCache.clear();
    this.clearPublicJWKSCache();

    return newKey;
  }

  async signJWT(payload: ReAuthJWTPayload, keyId?: string, ttlSeconds?: number): Promise<string> {
    const key = keyId
      ? await this.getKeyById(keyId)
      : await this.getActiveKey();

    const expirationTime = ttlSeconds || this.defaultAccessTokenTtlSeconds;

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({
        alg: key.algorithm,
        kid: key.keyId,
      })
      .setIssuer(this.issuer)
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(key.privateKey);

    // Update usage count
    await this.incrementKeyUsage(key.keyId);

    return jwt;
  }

  async verifyJWT(token: string): Promise<ReAuthJWTPayload> {
    // Check blacklist first
    if (await this.isTokenBlacklisted(token)) {
      throw new Error('Token is blacklisted');
    }

    // Extract kid from header without verification
    const [headerB64] = token.split('.');

    if (!headerB64) {
      throw new Error('Token missing header');
    }

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const kid = header.kid;

    if (!kid) {
      throw new Error('Token missing key ID');
    }

    const key = await this.getKeyById(kid);

    const { payload } = await jwtVerify(token, key.publicKey, {
      issuer: this.issuer,
    });

    return payload as ReAuthJWTPayload;
  }

  async getPublicJWKS(): Promise<{ keys: any[] }> {
    // Check cache first
    if (this.publicJWKSCache && Date.now() < this.cacheExpiry) {
      return this.publicJWKSCache;
    }

    const activeKeys = await this.getAllActiveKeys();
    const keys = [];

    for (const key of activeKeys) {
      const publicJWK = await exportJWK(key.publicKey);
      keys.push({
        ...publicJWK,
        kid: key.keyId,
        alg: key.algorithm,
        use: 'sig',
      });
    }

    this.publicJWKSCache = { keys };
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return this.publicJWKSCache;
  }

  async blacklistToken(token: string, reason: BlacklistReason): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    await orm.create('jwt_blacklist', {
      token,
      reason,
    });
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const blacklistEntry = await orm.findFirst('jwt_blacklist', {
      where: (b: any) => b('token', '=', token),
    });

    return !!blacklistEntry;
  }

  async cleanupExpiredKeys(): Promise<number> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const now = new Date();
    const expiredKeys = await orm.findMany('jwks_keys', {
      where: (b: any) =>
        b.and(b('is_active', '=', false), b('expires_at', '<', now)),
    });

    if (expiredKeys.length === 0) {
      return 0;
    }

    const expiredKeyIds = expiredKeys.map((k: any) => k.key_id);

    await orm.deleteMany('jwks_keys', {
      where: (b: any) => b('key_id', 'in', expiredKeyIds),
    });

    return expiredKeys.length;
  }

  async cleanupBlacklistedTokens(): Promise<number> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Remove blacklisted tokens older than 24 hours (they would have expired anyway)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await orm.count('jwt_blacklist', {
      where: (b: any) => b('blacklisted_at', '<', cutoff),
    });

    await orm.deleteMany('jwt_blacklist', {
      where: (b: any) => b('blacklisted_at', '<', cutoff),
    });

    return count;
  }

  // Token pair operations
  async createTokenPair(payload: ReAuthJWTPayload, deviceInfo?: {
    fingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TokenPair> {
    // Generate access token
    const accessToken = await this.signJWT(payload);
    
    // Generate refresh token
    const refreshToken = await this.generateRefreshToken(
      payload.subject_type,
      payload.sub,
      deviceInfo
    );

    const accessTokenExpiresAt = new Date(Date.now() + this.defaultAccessTokenTtlSeconds * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + this.defaultRefreshTokenTtlSeconds * 1000);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenType: 'Bearer',
    };
  }

  // Refresh token operations
  async generateRefreshToken(subjectType: string, subjectId: string, deviceInfo?: {
    fingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');
    const tokenId = randomBytes(16).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(Date.now() + this.defaultRefreshTokenTtlSeconds * 1000);

    await orm.create('refresh_tokens', {
      token_id: tokenId,
      subject_type: subjectType,
      subject_id: subjectId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      device_fingerprint: deviceInfo?.fingerprint || null,
      ip_address: deviceInfo?.ipAddress || null,
      user_agent: deviceInfo?.userAgent || null,
    });

    return token;
  }

  async validateRefreshToken(token: string): Promise<RefreshTokenValidationResult> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const refreshTokenRecord = await orm.findFirst('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('token_hash', '=', tokenHash),
          b('is_revoked', '=', false),
          b('expires_at', '>', now)
        ),
    });

    if (!refreshTokenRecord) {
      return {
        isValid: false,
        error: 'Invalid or expired refresh token',
      };
    }

    const refreshToken: RefreshToken = {
      id: refreshTokenRecord.id as string,
      tokenId: refreshTokenRecord.token_id as string,
      subjectType: refreshTokenRecord.subject_type as string,
      subjectId: refreshTokenRecord.subject_id as string,
      tokenHash: refreshTokenRecord.token_hash as string,
      expiresAt: new Date(refreshTokenRecord.expires_at as string),
      createdAt: new Date(refreshTokenRecord.created_at as string),
      lastUsedAt: refreshTokenRecord.last_used_at ? new Date(refreshTokenRecord.last_used_at as string) : undefined,
      isRevoked: refreshTokenRecord.is_revoked as boolean,
      revokedAt: refreshTokenRecord.revoked_at ? new Date(refreshTokenRecord.revoked_at as string) : undefined,
      revocationReason: refreshTokenRecord.revocation_reason as RefreshTokenRevocationReason | undefined,
      deviceFingerprint: refreshTokenRecord.device_fingerprint as string | undefined,
      ipAddress: refreshTokenRecord.ip_address as string | undefined,
      userAgent: refreshTokenRecord.user_agent as string | undefined,
    };

    return {
      isValid: true,
      token: refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const validation = await this.validateRefreshToken(refreshToken);
    
    if (!validation.isValid || !validation.token) {
      throw new Error(validation.error || 'Invalid refresh token');
    }

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Update last used timestamp
    await orm.updateMany('refresh_tokens', {
      where: (b: any) => b('token_hash', '=', validation.token!.tokenHash),
      set: { last_used_at: new Date() },
    });

    // Create new access token
    const payload: ReAuthJWTPayload = {
      sub: validation.token.subjectId,
      subject_type: validation.token.subjectType,
    };

    const accessToken = await this.signJWT(payload);
    const accessTokenExpiresAt = new Date(Date.now() + this.defaultAccessTokenTtlSeconds * 1000);

    let newRefreshToken = refreshToken;
    let refreshTokenExpiresAt = validation.token.expiresAt;

    // Optionally rotate refresh token
    if (this.enableRefreshTokenRotation) {
      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken, 'rotation');
      
      // Generate new refresh token
      newRefreshToken = await this.generateRefreshToken(
        validation.token.subjectType,
        validation.token.subjectId,
        {
          fingerprint: validation.token.deviceFingerprint,
          ipAddress: validation.token.ipAddress,
          userAgent: validation.token.userAgent,
        }
      );
      refreshTokenExpiresAt = new Date(Date.now() + this.defaultRefreshTokenTtlSeconds * 1000);
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenType: 'Bearer',
    };
  }

  async revokeRefreshToken(token: string, reason: RefreshTokenRevocationReason = 'logout'): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const tokenHash = createHash('sha256').update(token).digest('hex');

    await orm.updateMany('refresh_tokens', {
      where: (b: any) => b('token_hash', '=', tokenHash),
      set: {
        is_revoked: true,
        revoked_at: new Date(),
        revocation_reason: reason,
      },
    });
  }

  async revokeAllRefreshTokens(subjectType: string, subjectId: string, reason: RefreshTokenRevocationReason = 'logout'): Promise<number> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const count = await orm.count('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
          b('is_revoked', '=', false)
        ),
    });

    await orm.updateMany('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
          b('is_revoked', '=', false)
        ),
      set: {
        is_revoked: true,
        revoked_at: new Date(),
        revocation_reason: reason,
      },
    });

    return count;
  }

  async cleanupExpiredRefreshTokens(): Promise<number> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const now = new Date();
    const count = await orm.count('refresh_tokens', {
      where: (b: any) => b('expires_at', '<', now),
    });

    await orm.deleteMany('refresh_tokens', {
      where: (b: any) => b('expires_at', '<', now),
    });

    return count;
  }

  // Private helper methods
  private generateKeyId(): string {
    return randomBytes(16).toString('hex');
  }

  private async recordToJWKSKey(record: any): Promise<JWKSKey> {
    const publicKey = (await importJWK(
      JSON.parse(record.public_key),
      record.algorithm,
    )) as CryptoKey;
    const privateKey = (await importJWK(
      JSON.parse(record.private_key),
      record.algorithm,
    )) as CryptoKey;

    return {
      id: record.id,
      keyId: record.key_id,
      algorithm: record.algorithm,
      publicKey,
      privateKey,
      isActive: record.is_active,
      createdAt: new Date(record.created_at),
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
      lastUsedAt: record.last_used_at
        ? new Date(record.last_used_at)
        : undefined,
      usageCount: record.usage_count || 0,
    };
  }

  private async getKeyById(keyId: string): Promise<JWKSKey> {
    // Check cache first
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const keyRecord = await orm.findFirst('jwks_keys', {
      where: (b: any) => b('key_id', '=', keyId),
    });

    if (!keyRecord) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const jwksKey = await this.recordToJWKSKey(keyRecord);
    this.keyCache.set(keyId, jwksKey);

    return jwksKey;
  }

  private async incrementKeyUsage(keyId: string): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    await orm.updateMany('jwks_keys', {
      where: (b: any) => b('key_id', '=', keyId),
      set: {
        usage_count: (b: any) => b.increment('usage_count', 1),
        last_used_at: new Date(),
      },
    });

    // Update cache if key exists
    if (this.keyCache.has(keyId)) {
      const cachedKey = this.keyCache.get(keyId)!;
      cachedKey.usageCount += 1;
      cachedKey.lastUsedAt = new Date();
    }
  }

  private clearPublicJWKSCache(): void {
    this.publicJWKSCache = null;
    this.cacheExpiry = 0;
  }
}
