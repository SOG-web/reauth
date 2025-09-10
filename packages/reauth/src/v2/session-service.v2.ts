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
  constructor(
    private dbClient: FumaClient,
    private resolvers: SessionResolvers,
    private tokenFactory: () => string = defaultTokenFactory,
  ) {}

  async createSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<string> {
    const token = this.tokenFactory();
    const version = await this.dbClient.version();
    const orm = this.dbClient.orm(version);

    if (ttlSeconds && ttlSeconds < 30) {
      throw new Error("'ttlSeconds' must be greater than or equal to 30");
    }

    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null;

    await orm.create('sessions', {
      subject_type: subjectType,
      subject_id: subjectId,
      token,
      expires_at: expiresAt,
    });

    return token;
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
