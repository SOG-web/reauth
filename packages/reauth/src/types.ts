import type { AwilixContainer } from 'awilix';
import { type, type Type } from 'arktype';
import { InferAbstractQuery } from 'fumadb';
import { JWK, JWTPayload } from 'jose';
import { ReAuthEngine } from './engine';
import { RelationBuilder, column, idColumn, table } from 'fumadb/schema';
import { EnhancedJWKSService, ReAuthJWTPayload } from './services';

// Minimal Fuma client interface used by
// InferFumaDB<typeof ChatDB>
export interface FumaClient {
  version(): Promise<any>;
  orm(version: any): OrmLike;
}

export type JWKSKeys =
  | {
      publicKey: CryptoKey;
      privateKey: CryptoKey;
      new: boolean;
    }
  | {
      publicKey: CryptoKey | Uint8Array<ArrayBufferLike>;
      privateKey: CryptoKey | Uint8Array<ArrayBufferLike>;
      new?: undefined;
    };

export type JWKSTokenParams = {
  payload: JWTPayload;
  privateKey: CryptoKey | Uint8Array<ArrayBufferLike>;
  issuer: string;
  clientId: string;
  expTime: string | number | Date;
};

export type Subject = { id: string; [key: string]: any };

export type Token =
  | {
      accessToken: string;
      refreshToken: string;
    }
  | string
  | null;

export const tokenType = type({
  accessToken: 'string',
  refreshToken: 'string',
}).or(type('string'));

// Shared  input/output shapes (entity removed). Keep names the same for cross-package compatibility.
export interface AuthInput {
  token?: Token;
  [key: string]: any;
}

export interface AuthOutput {
  token?: Token;
  redirect?: string;
  success: boolean;
  message: string;
  status: string;
  subject?: any;
  others?: Record<string, any>;
  [key: string]: any;
}

export type SubjectResolver = {
  getById: (id: string, orm: OrmLike) => Promise<Subject | null>;
  sanitize?: (subject: Subject) => any;
};

export interface SessionResolvers {
  register(subjectType: string, resolver: SubjectResolver): void;
  get(subjectType: string): SubjectResolver | undefined;
}

// Additional session metadata for enhanced session management
export interface SessionMetadata {
  deviceInfo?: {
    fingerprint?: string;
    userAgent?: string;
    ipAddress?: string;
    isTrusted?: boolean;
    deviceName?: string;
  };
  metadata?: Record<string, any>;
}

// Enhanced session creation options
export interface CreateSessionOptions {
  ttlSeconds?: number;
  deviceInfo?: SessionMetadata['deviceInfo'];
  metadata?: Record<string, any>;
}

export interface SessionService {
  enableEnhancedFeatures(): void;
  enableJWKS(options: {
    issuer: string;
    keyRotationIntervalDays: number;
    keyGracePeriodDays: number;
    defaultAccessTokenTtlSeconds: number;
    defaultRefreshTokenTtlSeconds: number;
    enableRefreshTokenRotation: boolean;
  }): void;
  createSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<Token>;
  // Enhanced version for advanced session features
  createSessionWithMetadata?(
    subjectType: string,
    subjectId: string,
    options: CreateSessionOptions,
  ): Promise<Token>;
  verifySession(token: Token): Promise<{
    subject: any | null;
    token: Token | null;
    type?: 'jwt' | 'legacy';
    payload?: ReAuthJWTPayload;
  }>;
  destroySession(token: Token): Promise<void>;
  destroyAllSessions(subjectType: string, subjectId: string): Promise<void>;
  // Enhanced session listing
  listSessionsForSubject?(
    subjectType: string,
    subjectId: string,
  ): Promise<
    Array<{
      sessionId: string;
      token: string;
      createdAt: Date;
      expiresAt: Date | null;
      deviceInfo?: SessionMetadata['deviceInfo'];
      metadata?: Record<string, any>;
    }>
  >;
  getPublicJWKS?(): Promise<{ keys: JWK[] }>;
  getJwkService(): EnhancedJWKSService | null;
}

// ---------------- Step/Plugin Types () ----------------
export type StepStatus = string; // e.g., 'su', 'ip', 'ic', 'unf', 'eq', 'ev'

export interface StepProtocolHttp {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  codes: Record<string, number>; // map semantic status to HTTP code
  auth?: boolean; // whether this step requires authentication
}

export interface StepProtocolMeta {
  http?: StepProtocolHttp;
  [key: string]: any;
}

export interface StepHooks<Cfg, I = AuthInput, O = AuthOutput> {
  before?: (input: I, ctx: StepContext<Cfg>) => Promise<void> | void;
  after?: (output: O, ctx: StepContext<Cfg>) => Promise<void> | void;
  onError?: (error: unknown, ctx: StepContext<Cfg>) => Promise<void> | void;
}

export interface StepContext<Cfg> {
  engine: ReAuthEngine;
  config: Cfg;
}

export interface AuthStep<Cfg, I = AuthInput | any, O = AuthOutput | any> {
  name: string;
  description?: string;
  validationSchema?: Type<any>; // arktype runtime (assert/toJsonSchema)
  outputs?: Type<any>; // arktype runtime for outputs (optional)
  run: (input: I, ctx: StepContext<Cfg>) => Promise<O> | AuthOutput;
  hooks?: StepHooks<Cfg>;
  inputs?: string[];
  protocol?: StepProtocolMeta;
}

export interface RootStepHooks<Cfg> {
  before?: (
    input: AuthInput,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg>,
  ) => Promise<AuthInput> | AuthInput;
  after?: (
    output: AuthOutput,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg>,
  ) => Promise<AuthOutput> | AuthOutput;
  onError?: (
    error: unknown,
    input: AuthInput,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg>,
  ) => Promise<void> | void;
}

// Context passed to plugin-level utility functions (non-HTTP, non-step)
export interface PluginProfileContext {
  engine: ReAuthEngine;
  config?: any;
}

export interface AuthPlugin<Cfg = any> {
  name: string;
  initialize?: (engine: ReAuthEngine, config: Cfg) => Promise<void> | void;
  steps?: Array<AuthStep<Cfg>>;
  getSensitiveFields?: () => string[];
  config: Cfg;
  rootHooks?: RootStepHooks<Cfg>;
  getProfile?: (
    subjectId: string,
    ctx: PluginProfileContext,
  ) => Promise<any> | any;
}

// ---------------- Hook Types () ----------------
export type HooksType = 'before' | 'after' | 'onError';

export interface AuthHook {
  type: HooksType;
  pluginName?: string; // if provided, limits to a specific plugin
  steps?: string[]; // if provided, limits to specific steps
  session?: boolean; // marks this as a session-level hook
  universal?: boolean; // applies to all plugins/steps
  fn: (
    data: AuthInput | AuthOutput,
    container: ReAuthCradle,
    error?: unknown,
  ) => Promise<AuthInput | AuthOutput | void> | AuthInput | AuthOutput | void;
}

export interface ReAuthCradleExtension {
  dbClient: FumaClient;
  sessionService: SessionService;
  sessionResolvers: SessionResolvers;
  engine: ReAuthEngine;
}

export type ReAuthCradle = AwilixContainer<ReAuthCradleExtension>;

// Use the precise FumaDB abstract query type for our ORM alias.
export type OrmLike = InferAbstractQuery<any, any>;

// ---------------- Background Cleanup Scheduler Types ----------------
export interface CleanupTask {
  name: string;
  pluginName: string;
  intervalMs: number; // How often to run the cleanup (in milliseconds)
  enabled: boolean;
  runner: (
    orm: OrmLike,
    config?: any,
  ) => Promise<{ cleaned: number; errors?: string[] }>;
}

export interface CleanupScheduler {
  registerTask(task: CleanupTask): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getRegisteredTasks(): CleanupTask[];
  setPluginConfig(pluginName: string, config: any): void;
}

export type ReauthSchemaPlugin = {
  tables?: Record<string, ReturnType<typeof table>>;
  relations?: Record<
    string,
    (builder: RelationBuilder<any>) => Record<string, unknown>
  >;
  /**
   * Extend columns of existing tables by name. Keys are table names, values are maps of new columns.
   * These columns will be merged into core table column maps before creating the final tables.
   */
  extendTables?: Record<
    string,
    Record<string, ReturnType<typeof column> | ReturnType<typeof idColumn>>
  >;
};
