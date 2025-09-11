import type {
  FumaClient,
  OrmLike,
  SessionResolvers,
  SessionServiceV2,
} from './types.v2';

function defaultTokenFactory(): string {
  const g: any = globalThis as any;
  // Prefer Web Crypto when available (browser/Node 19+).
  if (g?.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  if (g?.crypto?.getRandomValues) {
    const buf = new Uint8Array(32);
    g.crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    // Node fallback.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomBytes } = require('node:crypto');
    return randomBytes(32).toString('hex');
  } catch {
    // Last-resort legacy fallback to preserve current behavior.
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    );
  }
}

export class FumaSessionServiceV2 implements SessionServiceV2 {
  private enhancedMode = false;
  
  constructor(
    private dbClient: FumaClient,
    private resolvers: SessionResolvers,
    private tokenFactory: () => string = defaultTokenFactory,
  ) {}

  // Enable enhanced session features (called by session plugin)
  enableEnhancedFeatures(): void {
    this.enhancedMode = true;
  }

  async createSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<string> {
    return this.createSessionWithMetadata(subjectType, subjectId, { ttlSeconds });
  }

  async createSessionWithMetadata(
    subjectType: string,
    subjectId: string,
    options: import('./types.v2').CreateSessionOptions,
  ): Promise<string> {
    const token = this.tokenFactory();
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    if (options.ttlSeconds && options.ttlSeconds < 30) {
      throw new Error("'ttlSeconds' must be greater than or equal to 30");
    }

    const expiresAt = options.ttlSeconds
      ? new Date(Date.now() + options.ttlSeconds * 1000)
      : null;

    // Create the basic session
    const session = await orm.create('sessions', {
      subject_type: subjectType,
      subject_id: subjectId,
      token,
      expires_at: expiresAt,
    });

    // If enhanced mode is enabled and we have additional data, store it
    if (this.enhancedMode) {
      const sessionId = session.id || token; // Use session ID or token as fallback

      // Store device information if provided
      if (options.deviceInfo) {
        await orm.create('session_devices', {
          session_id: sessionId,
          fingerprint: options.deviceInfo.fingerprint,
          user_agent: options.deviceInfo.userAgent,
          ip_address: options.deviceInfo.ipAddress,
          is_trusted: options.deviceInfo.isTrusted || false,
          device_name: options.deviceInfo.deviceName,
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
        sessionId: session.id || session.token,
        token: session.token,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
      };

      // If enhanced mode, fetch additional data
      if (this.enhancedMode) {
        const sessionId = session.id || session.token;

        // Get device info
        const deviceInfo = await orm.findFirst('session_devices', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        if (deviceInfo) {
          sessionData.deviceInfo = {
            fingerprint: (deviceInfo as any).fingerprint,
            userAgent: (deviceInfo as any).user_agent,
            ipAddress: (deviceInfo as any).ip_address,
            isTrusted: (deviceInfo as any).is_trusted,
            deviceName: (deviceInfo as any).device_name,
          };
        }

        // Get metadata
        const metadataRows = await orm.findMany('session_metadata', {
          where: (b: any) => b('session_id', '=', sessionId),
        });

        if (metadataRows.length > 0) {
          sessionData.metadata = {};
          for (const row of metadataRows) {
            try {
              sessionData.metadata[(row as any).key] = JSON.parse((row as any).value);
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
    token: string,
  ): Promise<{ subject: any | null; token: string | null }> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    const now = new Date();

    const session = await orm.findFirst('sessions', {
      // NOTE: the predicate builder's concrete type depends on the selected adapter.
      // We use 'any' only here to allow calling it. This is intentionally left as 'any'.
      where: (b: any) =>
        b.and(
          b('token', '=', token),
          b.or(b.isNull('expires_at'), b('expires_at', '>', now)),
        ),
    });

    if (!session) {
      return { subject: null, token: null };
    }

    const resolver = this.resolvers.get(
      String((session as Record<string, unknown>).subject_type),
    );
    if (!resolver) {
      return { subject: null, token: token };
    }

    const subject = await resolver.getById(
      String((session as Record<string, unknown>).subject_id),
      orm,
    );
    if (!subject) {
      return { subject: null, token };
    }
    const safeSubject = resolver.sanitize
      ? resolver.sanitize(subject)
      : subject;

    return { subject: safeSubject, token };
  }

  async destroySession(token: string): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // If enhanced mode, cleanup related data first
    if (this.enhancedMode) {
      // Get session ID to cleanup related data
      const session = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', token),
      });

      if (session) {
        const sessionId = (session as any).id || token;

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

    await orm.deleteMany('sessions', {
      // See note above about the adapter-specific predicate builder type.
      where: (b: any) => b('token', '=', token),
    });
  }

  async destroyAllSessions(
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    // If enhanced mode, cleanup related data first
    if (this.enhancedMode) {
      // Get all session IDs for this subject
      const sessions = await orm.findMany('sessions', {
        where: (b: any) =>
          b.and(
            b('subject_type', '=', subjectType),
            b('subject_id', '=', subjectId),
          ),
      });

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

    await orm.deleteMany('sessions', {
      // See note above about the adapter-specific predicate builder type.
      where: (b: any) =>
        b.and(
          b('subject_type', '=', subjectType),
          b('subject_id', '=', subjectId),
        ),
    });
  }
}
