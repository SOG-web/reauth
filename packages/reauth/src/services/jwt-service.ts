import {
  generateKeyPair,
  SignJWT,
  jwtVerify,
  importJWK,
  exportJWK,
  JWK,
} from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import type { FumaClient } from '../types';
import type {
  EnhancedJWKSServiceType as JWTServiceType,
  JWKSKey,
  ReAuthJWTPayload,
  RotationReason,
  BlacklistReason,
  RefreshToken,
  RefreshTokenRevocationReason,
  RefreshTokenValidationResult,
  TokenPair,
  ReAuthClient,
  ClientType,
} from './jwt.types';
import { generateApiKey } from '../plugins/api-key';
import { hashPassword } from '../lib';

export class EnhancedJWKSService implements JWTServiceType {
  private keyCache = new Map<string, JWKSKey>();
  private activeKeyCache: JWKSKey | null = null;
  private publicJWKSCache: { keys: JWK[] } | null = null;
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
    const { publicKey, privateKey } = await generateKeyPair(algorithm, {
      extractable: true,
    });
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
      console.log('jwt-service- active key found in cache');
      return this.activeKeyCache;
    }

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const keyRecord = await orm.findFirst('jwks_keys', {
      where: (b: any) => b('is_active', '=', true),
      orderBy: [['created_at', 'desc']],
    });

    if (!keyRecord) {
      console.log('jwt-service- no active key found, generating one');
      // No active key found, generate one
      return await this.generateKeyPair();
    }

    const jwksKey = await this.recordToJWKSKey(keyRecord);

    // Check if key needs rotation
    if (jwksKey.expiresAt && jwksKey.expiresAt <= new Date()) {
      console.log('jwt-service- key needs rotation, rotating');
      return await this.rotateKeys('scheduled');
    }

    // Update cache
    console.log('jwt-service- updating active key cache');
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

  async signJWT(
    payload: ReAuthJWTPayload,
    keyId?: string,
    ttlSeconds?: number,
  ): Promise<string> {
    const key = keyId
      ? await this.getKeyById(keyId)
      : await this.getActiveKey();

    const ttlSecondsToUse = ttlSeconds || this.defaultAccessTokenTtlSeconds;
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = now + ttlSecondsToUse;

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

  async getPublicJWKS(): Promise<{ keys: JWK[] }> {
    // Check cache first
    if (this.publicJWKSCache && Date.now() < this.cacheExpiry) {
      return this.publicJWKSCache;
    }

    const activeKeys = await this.getAllActiveKeys();
    const keys: JWK[] = [];

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

  async getPublicJWK(): Promise<JWK> {
    const key = await this.getActiveKey();
    const publicJWK = await exportJWK(key.publicKey);
    return {
      ...publicJWK,
      kid: key.keyId,
      alg: key.algorithm,
      use: 'sig',
    };
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
  async createTokenPair(
    payload: ReAuthJWTPayload,
    deviceInfo?: Record<string, any>,
    ttlSeconds?: number,
  ): Promise<TokenPair> {
    // Embed device info in payload
    if (deviceInfo) {
      payload.deviceInfo = deviceInfo;
    }

    // Generate access token with custom TTL if provided
    const accessToken = await this.signJWT(payload, undefined, ttlSeconds);

    // Generate refresh token
    const refreshToken = await this.generateRefreshToken(
      payload.subject_type,
      payload.sub,
      deviceInfo,
    );

    const effectiveTtl = ttlSeconds || this.defaultAccessTokenTtlSeconds;
    const accessTokenExpiresAt = new Date(Date.now() + effectiveTtl * 1000);
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.defaultRefreshTokenTtlSeconds * 1000,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenType: 'Bearer',
    };
  }

  // Refresh token operations
  async generateRefreshToken(
    subjectType: string,
    subjectId: string,
    deviceInfo?: {
      fingerprint?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<string> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');
    const tokenId = randomBytes(16).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(
      Date.now() + this.defaultRefreshTokenTtlSeconds * 1000,
    );

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

  async validateRefreshToken(
    token: string,
  ): Promise<RefreshTokenValidationResult> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const refreshTokenRecord = await orm.findFirst('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('token_hash', '=', tokenHash),
          b('is_revoked', '=', false),
          b('expires_at', '>', now),
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
      lastUsedAt: refreshTokenRecord.last_used_at
        ? new Date(refreshTokenRecord.last_used_at as string)
        : undefined,
      isRevoked: refreshTokenRecord.is_revoked as boolean,
      revokedAt: refreshTokenRecord.revoked_at
        ? new Date(refreshTokenRecord.revoked_at as string)
        : undefined,
      revocationReason: refreshTokenRecord.revocation_reason as
        | RefreshTokenRevocationReason
        | undefined,
      deviceFingerprint: refreshTokenRecord.device_fingerprint as
        | string
        | undefined,
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
    const accessTokenExpiresAt = new Date(
      Date.now() + this.defaultAccessTokenTtlSeconds * 1000,
    );

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
        },
      );
      refreshTokenExpiresAt = new Date(
        Date.now() + this.defaultRefreshTokenTtlSeconds * 1000,
      );
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenType: 'Bearer',
    };
  }

  async revokeRefreshToken(
    token: string,
    reason: RefreshTokenRevocationReason = 'logout',
  ): Promise<void> {
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

  async revokeAllRefreshTokens(
    subjectType: string,
    subjectId: string,
    reason: RefreshTokenRevocationReason = 'logout',
  ): Promise<number> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const count = await orm.count('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
          b('is_revoked', '=', false),
        ),
    });

    await orm.updateMany('refresh_tokens', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
          b('is_revoked', '=', false),
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

  async registerClient(
    client: Partial<ReAuthClient>,
  ): Promise<{ client: ReAuthClient; apiKey: string }> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const apiKey = generateApiKey();

    const hashedApiKey = await hashPassword(apiKey);

    const clientRecord = await orm.create('reauth_clients', {
      subject_id: client.subjectId,
      client_secret_hash: hashedApiKey,
      client_type: client.clientType,
      name: client.name,
      description: client.description,
      is_active: client.isActive,
      created_at: client.createdAt,
      updated_at: client.updatedAt,
    });

    return {
      client: {
        id: clientRecord.id as string,
        clientSecretHash: '[REDACTED]',
        clientType: clientRecord.client_type as ClientType,
        subjectId: clientRecord.subject_id as string,
        name: clientRecord.name as string,
        description: clientRecord.description as string,
        isActive: clientRecord.is_active as boolean,
        createdAt: clientRecord.created_at as Date,
        updatedAt: clientRecord.updated_at as Date,
      },
      apiKey,
    };
  }

  async getClientById(id: string): Promise<ReAuthClient> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const clientRecord = await orm.findFirst('reauth_clients', {
      where: (b: any) => b('id', '=', id),
    });

    if (!clientRecord) {
      throw new Error(`Client not found: ${id}`);
    }

    return {
      id: clientRecord.id as string,
      clientSecretHash: clientRecord.client_secret_hash as string,
      clientType: clientRecord.client_type as ClientType,
      name: clientRecord.name as string,
      subjectId: clientRecord.subject_id as string,
      description: clientRecord.description as string,
      isActive: clientRecord.is_active as boolean,
      createdAt: clientRecord.created_at as Date,
      updatedAt: clientRecord.updated_at as Date,
    };
  }

  async getAllClients(): Promise<ReAuthClient[]> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const clientRecords = await orm.findMany('reauth_clients');

    return clientRecords.map((record) => ({
      id: record.id as string,
      clientSecretHash: record.client_secret_hash as string,
      clientType: record.client_type as ClientType,
      name: record.name as string,
      subjectId: record.subject_id as string,
      description: record.description as string,
      isActive: record.is_active as boolean,
      createdAt: record.created_at as Date,
      updatedAt: record.updated_at as Date,
    }));
  }

  async getClientByApiKey(apiKey: string): Promise<ReAuthClient> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const apiKeyHash = await hashPassword(apiKey);

    const clientRecord = await orm.findFirst('reauth_clients', {
      where: (b: any) => b('client_secret_hash', '=', apiKeyHash),
    });

    if (!clientRecord) {
      throw new Error(`Client not found: ${apiKey}`);
    }

    return {
      id: clientRecord.id as string,
      clientSecretHash: clientRecord.client_secret_hash as string,
      clientType: clientRecord.client_type as ClientType,
      name: clientRecord.name as string,
      subjectId: clientRecord.subject_id as string,
      description: clientRecord.description as string,
      isActive: clientRecord.is_active as boolean,
      createdAt: clientRecord.created_at as Date,
      updatedAt: clientRecord.updated_at as Date,
    };
  }

  async getClientBySubjectId(subjectId: string): Promise<ReAuthClient> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const clientRecord = await orm.findFirst('reauth_clients', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    if (!clientRecord) {
      throw new Error(`Client not found: ${subjectId}`);
    }

    return {
      id: clientRecord.id as string,
      clientSecretHash: clientRecord.client_secret_hash as string,
      clientType: clientRecord.client_type as ClientType,
      name: clientRecord.name as string,
      subjectId: clientRecord.subject_id as string,
      description: clientRecord.description as string,
      isActive: clientRecord.is_active as boolean,
      createdAt: clientRecord.created_at as Date,
      updatedAt: clientRecord.updated_at as Date,
    };
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

    const keyRecord = await orm.findFirst('jwks_keys', {
      where: (b: any) => b('key_id', '=', keyId),
    });

    if (!keyRecord) {
      throw new Error(`Key not found: ${keyId}`);
    }

    await orm.updateMany('jwks_keys', {
      where: (b: any) => b('key_id', '=', keyId),
      set: {
        usage_count: (keyRecord.usage_count as any) + 1,
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
