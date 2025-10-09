import type {
  CreateSessionOptions,
  FumaClient,
  OrmLike,
  SessionResolvers,
  SessionService,
  SessionServiceOptions,
  Subject,
  Token,
} from '../types';
import type { ReAuthJWTPayload, TokenPair } from './jwt.types';
import { EnhancedJWKSService } from './jwt-service';
import { JWK } from 'jose';
import { generateSessionToken } from '../lib';

export class FumaSessionService implements SessionService {
  private enhancedMode = false;
  private jwtService: EnhancedJWKSService | null = null;
  private useJwks: boolean = false;

  constructor(
    private dbClient: FumaClient,
    private resolvers: SessionResolvers,
    private tokenFactory: () => string = generateSessionToken,
    private getUserData?: (
      subjectId: string,
      orm: OrmLike,
    ) => Promise<Record<string, any>>,
    private options: SessionServiceOptions = {},
  ) {}

  // Enable JWKS functionality
  enableJWKS(options: {
    issuer: string;
    keyRotationIntervalDays: number;
    keyGracePeriodDays: number;
    defaultAccessTokenTtlSeconds: number;
    defaultRefreshTokenTtlSeconds: number;
    enableRefreshTokenRotation: boolean;
  }): void {
    this.jwtService = new EnhancedJWKSService(
      this.dbClient,
      options.issuer,
      options.keyRotationIntervalDays,
      options.keyGracePeriodDays,
      options.defaultAccessTokenTtlSeconds,
      options.defaultRefreshTokenTtlSeconds,
      options.enableRefreshTokenRotation,
    );
    this.useJwks = true;
    this.jwtService.generateKeyPair();
  }

  // Enable enhanced session features (called by session plugin)
  enableEnhancedFeatures(): void {
    this.enhancedMode = true;
  }

  getJwkService(): EnhancedJWKSService | null {
    return this.jwtService;
  }

  // Hybrid token verification - supports both JWT and legacy tokens
  async verifyToken(
    token: Token,
    deviceInfo?: Record<string, any>,
  ): Promise<{
    subject: any | null;
    token: Token | null;
    type: 'jwt' | 'legacy';
    payload?: ReAuthJWTPayload;
  }> {
    const result = await this.verifySession(token, deviceInfo);
    return {
      subject: result.subject,
      token: result.token,
      type: result.type || 'legacy',
      payload: result.payload,
    };
  }

  // Legacy session methods
  async createSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<Token> {
    const result = await this.createSessionWithMetadata(
      subjectType,
      subjectId,
      {
        ttlSeconds,
      },
    );

    return result;
  }

  // JWT-enhanced session creation - returns Token when JWT is enabled
  async createJWTSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<Token> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    return this.createSessionWithMetadata(subjectType, subjectId, {
      ttlSeconds,
    });
  }

  async createSessionWithMetadata(
    subjectType: string,
    subjectId: string,
    options: CreateSessionOptions,
  ): Promise<Token> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    if (options.ttlSeconds && options.ttlSeconds < 30) {
      throw new Error("'ttlSeconds' must be greater than or equal to 30");
    }

    let expiresAt = options.ttlSeconds
      ? new Date(Date.now() + options.ttlSeconds * 1000)
      : null;

    let token: string;
    let refreshToken: string | undefined;

    const userData = this.getUserData
      ? await this.getUserData(subjectId, orm)
      : {};

    // Generate token based on mode
    if (this.useJwks && this.jwtService) {
      const payload: ReAuthJWTPayload = {
        sub: subjectId,
        subject_type: subjectType,
        userData,
      };

      const tokenPair = await this.jwtService.createTokenPair(
        payload,
        options.deviceInfo, //TODO: complete this with full parity on the jwt side
        options.ttlSeconds,
      );
      token = tokenPair.accessToken;
      refreshToken = tokenPair.refreshToken;

      // Sync session expires_at with JWT expiration for unified management
      if (!options.ttlSeconds) {
        try {
          const jwtPayload = await this.jwtService.verifyJWT(token);
          if (jwtPayload.exp) {
            const jwtExpiresAt = new Date(jwtPayload.exp * 1000);
            // Use JWT expiration time instead of default session expiration
            expiresAt = jwtExpiresAt;
          }
        } catch {
          // If we can't verify the JWT, keep the original expiresAt
        }
      }
    } else {
      token = this.tokenFactory();
    }

    // Create the basic session (always store in sessions table for unified management)
    const session = await orm.create('sessions', {
      subject_type: subjectType,
      subject_id: subjectId,
      token,
      expires_at: expiresAt,
    });

    // If enhanced mode is enabled and we have additional data, store it
    if (this.enhancedMode) {
      const sessionId = session.id; // Use session ID or token as fallback

      // Store device information if provided
      if (options.deviceInfo) {
        await orm.create('session_devices', {
          session_id: sessionId,
          device_info: JSON.stringify(options.deviceInfo), // Store as JSON
          // ... other fields can be removed or kept for compatibility
        });
      }

      // Store metadata if provided
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          await orm.create('session_metadata', {
            session_id: sessionId,
            key,
            value: JSON.stringify(value),
          });
        }
      }
    }

    // Return token in appropriate format
    if (this.useJwks && refreshToken) {
      return { accessToken: token, refreshToken };
    }
    return token;
  }

  async listSessionsForSubject(
    subjectType: string,
    subjectId: string,
  ): Promise<any[]> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const now = new Date();

    // Get all active sessions for the subject
    const sessions = await orm.findMany('sessions', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
          b.or(b.isNull('expires_at'), b('expires_at', '>', now)),
        ),
    });

    const result: any[] = [];

    for (const session of sessions) {
      const sessionData: any = {
        sessionId: session.id,
        token: session.token,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
      };

      // If enhanced mode, fetch additional data
      if (this.enhancedMode) {
        const sessionId = session.id;

        // Get device info
        const deviceInfo = await orm.findFirst('session_devices', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        if (deviceInfo) {
          try {
            sessionData.deviceInfo = JSON.parse(
              (deviceInfo as any).device_info,
            );
          } catch {
            sessionData.deviceInfo = {}; // fallback if JSON invalid
          }
        }

        // Get metadata
        const metadataRows = await orm.findMany('session_metadata', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        if (metadataRows.length > 0) {
          sessionData.metadata = {};
          for (const row of metadataRows) {
            try {
              sessionData.metadata[(row as any).key] = JSON.parse(
                (row as any).value,
              );
            } catch {
              sessionData.metadata[(row as any).key] = (row as any).value;
            }
          }
        }
      }

      result.push(sessionData);
    }

    return result;
  }

  async verifySession(
    token: Token,
    deviceInfo?: Record<string, any>,
  ): Promise<{
    subject: any | null;
    token: Token | null;
    type?: 'jwt' | 'legacy';
    payload?: ReAuthJWTPayload;
  }> {
    if (!token) {
      return { subject: null, token: null };
    }

    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const now = new Date();
    let payload: ReAuthJWTPayload | undefined;
    let isJWT = false;
    let needsRefresh = false;
    let sessionExpired = false;
    const accessToken = typeof token === 'string' ? token : token.accessToken;
    const refreshToken = typeof token === 'string' ? null : token.refreshToken;

    console.log('accessToken', accessToken);

    // Always check session table first for unified management
    let session = await orm.findFirst('sessions', {
      where: (b: any) => b('token', '=', accessToken),
    });

    console.log('session- from db', session);

    if (!session) {
      return { subject: null, token: null };
    }

    // Get stored device info for validation
    let storedDeviceInfo: Record<string, any> | null = null;
    if (this.enhancedMode && deviceInfo && this.options.deviceValidator) {
      const sessionId = (session as any).id;
      if (sessionId) {
        const deviceData = await orm.findFirst('session_devices', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        if (deviceData) {
          try {
            storedDeviceInfo = JSON.parse((deviceData as any).device_info);
          } catch {
            storedDeviceInfo = {}; // fallback if JSON invalid
          }
        }
      }
    }

    // Check session expiration and if it's about to expire (within 1 minute)
    const currentNow = new Date();
    const sessionExpiresAt = (session as any).expires_at;
    if (sessionExpiresAt) {
      const expirationDate = new Date(sessionExpiresAt);
      const oneMinuteFromNow = new Date(currentNow.getTime() + 1 * 60 * 1000);

      if (expirationDate <= currentNow) {
        sessionExpired = true;
      } else if (expirationDate <= oneMinuteFromNow) {
        needsRefresh = true;
      }
    }

    console.log('session- after db', {
      needsRefresh,
      sessionExpired,
      isJWT,
      payload,
      storedDeviceInfo: storedDeviceInfo ? 'present' : 'none',
    });

    // Try JWT verification first (for optimization)
    if (this.jwtService && accessToken) {
      try {
        payload = await this.jwtService.verifyJWT(accessToken);
        isJWT = true;
      } catch (jwtError: any) {
        // JWT verification failed, could be expired
        // check if it is expired
        isJWT = false;
      }
    }

    console.log('session- after jwt', {
      needsRefresh,
      sessionExpired,
      isJWT,
      payload,
    });

    // Device validation for all token types (JWT uses payload, legacy uses stored device info)
    if (deviceInfo && this.options.deviceValidator) {
      let deviceToValidate: Record<string, any> | null = null;

      if (isJWT && payload?.deviceInfo) {
        // JWT tokens store device info in payload
        deviceToValidate = payload.deviceInfo;
      } else if (storedDeviceInfo) {
        // Legacy tokens store device info in session_devices table
        deviceToValidate = storedDeviceInfo;
      }

      if (deviceToValidate) {
        if (
          !(await this.options.deviceValidator(deviceToValidate, deviceInfo))
        ) {
          console.log(
            `Device validation failed for ${isJWT ? 'JWT' : 'legacy'} token`,
          );
          return { subject: null, token: null };
        }
      }
    }

    // Handle expired session or token that needs refresh
    if ((sessionExpired || needsRefresh) && refreshToken && this.jwtService) {
      try {
        // Attempt to refresh the token pair
        const newTokenPair =
          await this.jwtService.refreshAccessToken(refreshToken);

        // Verify the new access token to get payload and expiration
        const newPayload = await this.jwtService.verifyJWT(
          newTokenPair.accessToken,
        );
        const newExpiresAt = newPayload.exp
          ? new Date(newPayload.exp * 1000)
          : null;

        // Delete old session record
        await orm.deleteMany('sessions', {
          where: (b: any) => b('token', '=', accessToken),
        });

        // Create new session record with new access token
        const newSession = await orm.create('sessions', {
          subject_type: (session as any).subject_type,
          subject_id: (session as any).subject_id,
          token: newTokenPair.accessToken,
          expires_at: newExpiresAt,
        });

        // If enhanced mode, transfer session metadata to new session
        if (this.enhancedMode) {
          const oldSessionId = (session as any).id;
          const newSessionId = newSession.id || newTokenPair.accessToken;

          // Transfer device info
          const deviceInfo = await orm.findFirst('session_devices', {
            where: (b: any) => b('session_id', '=', oldSessionId),
          });

          if (deviceInfo) {
            await orm.deleteMany('session_devices', {
              where: (b: any) => b('session_id', '=', oldSessionId),
            });

            await orm.create('session_devices', {
              session_id: newSessionId,
              device_info: (deviceInfo as any).device_info, // Copy JSON as-is
            });
          }

          // Transfer metadata
          const metadataRows = await orm.findMany('session_metadata', {
            where: (b: any) => b('session_id', '=', oldSessionId),
          });

          if (metadataRows.length > 0) {
            await orm.deleteMany('session_metadata', {
              where: (b: any) => b('session_id', '=', oldSessionId),
            });

            for (const row of metadataRows) {
              await orm.create('session_metadata', {
                session_id: newSessionId,
                key: (row as any).key,
                value: (row as any).value,
              });
            }
          }
        }

        // Update variables for the rest of the flow
        payload = newPayload;
        isJWT = true;
        session = newSession;

        // Create the updated token for return
        const updatedToken =
          typeof token === 'string'
            ? newTokenPair.accessToken
            : {
                accessToken: newTokenPair.accessToken,
                refreshToken: newTokenPair.refreshToken,
              };

        // Continue with subject resolution using refreshed token
        const finalSubjectType = payload.subject_type;
        const finalSubjectId = payload.sub;

        const resolver = this.resolvers.get(finalSubjectType);
        if (!resolver) {
          console.log('resolver not found', finalSubjectType);
          return {
            subject: null,
            token: updatedToken,
            type: 'jwt',
            payload,
          };
        }

        const subject = await resolver.getById(finalSubjectId, orm);
        if (!subject) {
          return {
            subject: null,
            token: updatedToken,
            type: 'jwt',
            payload,
          };
        }

        const safeSubject = resolver.sanitize
          ? resolver.sanitize(subject)
          : subject;
        return {
          subject: safeSubject,
          token: updatedToken,
          type: 'jwt',
          payload,
        };
      } catch (refreshError) {
        console.log('refresh failed', refreshError);
        await orm.deleteMany('sessions', {
          where: (b: any) => b('token', '=', accessToken),
        });
        await this.jwtService.revokeRefreshToken(refreshToken, 'security');
        // Refresh failed, return null (session invalid)
        return { subject: null, token: null };
      }
    }

    // Normal flow - session is valid and not expiring soon
    if (sessionExpired) {
      // delete the expired session
      await orm.deleteMany('sessions', {
        where: (b: any) => b('token', '=', accessToken),
      });
      return { subject: null, token: null };
    }

    const subjectType = String(
      (session as Record<string, unknown>).subject_type,
    );
    const subjectId = String((session as Record<string, unknown>).subject_id);

    // For JWT tokens, use payload data if available, otherwise use session data
    const finalSubjectType =
      isJWT && payload ? payload.subject_type : subjectType;
    const finalSubjectId = isJWT && payload ? payload.sub : subjectId;

    const resolver = this.resolvers.get(finalSubjectType);
    if (!resolver) {
      console.log(
        'resolver not found - after not exp and not ref',
        finalSubjectType,
      );
      return {
        subject: null,
        token: token,
        type: isJWT ? 'jwt' : 'legacy',
        payload,
      };
    }

    const subject = await resolver.getById(finalSubjectId, orm);
    console.log('subject', subject);
    if (!subject) {
      console.log('subject not found - after not exp and not ref', subject);
      return { subject: null, token, type: isJWT ? 'jwt' : 'legacy', payload };
    }

    const safeSubject = resolver.sanitize
      ? resolver.sanitize(subject)
      : subject;
    return {
      subject: safeSubject,
      token,
      type: isJWT ? 'jwt' : 'legacy',
      payload,
    };
  }

  async destroySession(token: Token): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    if (!token) return;

    const accessToken = typeof token === 'string' ? token : token.accessToken;
    const refreshToken = typeof token === 'string' ? null : token.refreshToken;

    // If JWT service is enabled, blacklist the token
    if (this.jwtService) {
      try {
        if (refreshToken)
          await this.jwtService.blacklistToken(refreshToken, 'logout');
      } catch {
        // Token might not be JWT, continue with session cleanup
      }
    }

    // If enhanced mode, cleanup related data first
    if (this.enhancedMode) {
      // Get session ID to cleanup related data
      const session = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', accessToken),
      });

      if (session) {
        const sessionId = (session as any).id;

        // Cleanup device info
        await orm.deleteMany('session_devices', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        // Cleanup metadata
        await orm.deleteMany('session_metadata', {
          where: (b: any) => b('session_id', '=', sessionId),
        });
      }
    }

    // Always cleanup from sessions table for unified management
    await orm.deleteMany('sessions', {
      // See note above about the adapter-specific predicate builder type.
      where: (b: any) => b('token', '=', accessToken),
    });
  }

  async destroyAllSessions(
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // Get all sessions for cleanup
    const sessions = await orm.findMany('sessions', {
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
        ),
    });

    // If JWT service is enabled, blacklist all tokens
    if (this.jwtService) {
      await this.jwtService.revokeAllRefreshTokens(
        subjectType,
        subjectId,
        'logout',
      );
    }

    // If enhanced mode, cleanup related data first
    if (this.enhancedMode) {
      const sessionIds = sessions.map((s: any) => s.id || s.token);

      if (sessionIds.length > 0) {
        // Cleanup device info for all sessions
        await orm.deleteMany('session_devices', {
          where: (b: any) => b('session_id', 'in', sessionIds),
        });

        // Cleanup metadata for all sessions
        await orm.deleteMany('session_metadata', {
          where: (b: any) => b('session_id', 'in', sessionIds),
        });
      }
    }

    // Always cleanup from sessions table for unified management
    await orm.deleteMany('sessions', {
      // See note above about the adapter-specific predicate builder type.
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
        ),
    });
  }

  // JWT-specific token management methods
  async blacklistJWTToken(
    token: string,
    reason: 'logout' | 'revocation' | 'security' = 'logout',
  ): Promise<void> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    await this.jwtService.blacklistToken(token, reason);
  }

  async refreshJWTTokenPair(refreshToken: string): Promise<TokenPair> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    return await this.jwtService.refreshAccessToken(refreshToken);
  }

  async revokeRefreshToken(
    refreshToken: string,
    reason: 'logout' | 'rotation' | 'security' | 'expired' = 'logout',
  ): Promise<void> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    await this.jwtService.revokeRefreshToken(refreshToken, reason);
  }

  async revokeAllRefreshTokens(
    subjectType: string,
    subjectId: string,
    reason: 'logout' | 'rotation' | 'security' | 'expired' = 'logout',
  ): Promise<number> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    return await this.jwtService.revokeAllRefreshTokens(
      subjectType,
      subjectId,
      reason,
    );
  }

  // JWKS endpoint support
  async getPublicJWKS(): Promise<{ keys: JWK[] }> {
    if (!this.jwtService) {
      throw new Error(
        'JWT features not enabled. Call enableJWTFeatures() first.',
      );
    }

    return await this.jwtService.getPublicJWKS();
  }
}
