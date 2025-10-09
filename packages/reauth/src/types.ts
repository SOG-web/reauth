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
})
  .or(type('string'))
  .or(type('null'))
  .or(type('undefined'));

// Shared  input/output shapes (entity removed). Keep names the same for cross-package compatibility.
export interface AuthInput {
  token?: Token;
  deviceInfo?: Record<string, any>;
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
  deviceInfo?: Record<string, any>; // Flexible device info structure
  metadata?: Record<string, any>;
}

// Enhanced session creation options
export interface CreateSessionOptions {
  ttlSeconds?: number;
  deviceInfo?: SessionMetadata['deviceInfo'];
  metadata?: Record<string, any>;
}

export interface SessionServiceOptions {
  deviceValidator?: (
    storedDeviceInfo: Record<string, any>,
    currentDeviceInfo: Record<string, any>,
  ) => boolean | Promise<boolean>;
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
  verifySession(
    token: Token,
    deviceInfo?: Record<string, any>,
  ): Promise<{
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

export type PluginNames<P extends AuthPlugin[]> = Extract<
  P[number]['name'],
  string
>;

export type PluginByName<
  P extends AuthPlugin[],
  PluginName extends PluginNames<P>,
> = Extract<P[number], { name: PluginName }>;

export type StepsForPlugin<
  P extends AuthPlugin[],
  PluginName extends PluginNames<P>,
> =
  Extract<P[number], { name: PluginName }> extends { steps: Array<infer S> }
    ? S extends { name: infer N }
      ? N
      : never
    : never;

// Extract the step object for a specific plugin and step
type GetStep<
  P extends AuthPlugin[],
  PluginName extends PluginNames<P>,
  StepName extends string,
> =
  Extract<P[number], { name: PluginName }> extends { steps: Array<infer S> }
    ? Extract<S, { name: StepName }>
    : never;

// Extract input type for a specific step
export type StepInput<
  P extends AuthPlugin[],
  PluginName extends PluginNames<P>,
  StepName extends StepsForPlugin<P, PluginName>,
> =
  GetStep<P, PluginName, StepName> extends AuthStep<any, any, infer I, any>
    ? I
    : AuthInput;

// Extract output type for a specific step
export type StepOutput<
  P extends AuthPlugin[],
  PluginName extends PluginNames<P>,
  StepName extends StepsForPlugin<P, PluginName>,
> =
  GetStep<P, PluginName, StepName> extends AuthStep<any, any, any, infer O>
    ? O
    : AuthOutput;

// Typed list of input keys allowed for a step definition
export type StepInputKeys<I = AuthInput> = ReadonlyArray<
  Extract<keyof I, string>
>;

// extract the keys of O (output)
export type StepOutputKeys<O = AuthOutput> = ReadonlyArray<
  Extract<keyof O, string>
>;

export interface AuthPlugin<Cfg = any, Name extends string = string> {
  name: Name;
  initialize?: (engine: ReAuthEngine, config: Cfg) => Promise<void> | void;
  steps: Array<AuthStep<Cfg, any, any, any>>;
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

export interface AuthHook<
  P extends AuthPlugin[] = AuthPlugin[],
  PN extends PluginNames<P> = PluginNames<P>,
  SN extends StepsForPlugin<P, PN> = StepsForPlugin<P, PN>,
> {
  type: HooksType;
  pluginName?: PN; // if provided, limits to a specific plugin
  steps?: SN[]; // if provided, limits to specific steps
  session?: boolean; // marks this as a session-level hook
  universal?: boolean; // applies to all plugins/steps
  fn: (
    data: StepInput<P, PN, SN> | StepOutput<P, PN, SN> | AuthInput | AuthOutput,
    container: ReAuthCradle,
    error?: unknown,
    pluginName?: string,
    stepName?: string,
  ) =>
    | Promise<StepInput<P, PN, SN> | StepOutput<P, PN, SN> | void>
    | StepInput<P, PN, SN>
    | StepOutput<P, PN, SN>
    | void;
}

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

export interface AuthStep<
  Cfg,
  StepName extends string = string,
  I = AuthInput,
  O = AuthOutput,
> {
  name: StepName;
  description?: string;
  validationSchema?: Type<any>; // arktype runtime (assert/toJsonSchema)
  outputs?: Type<any>; // arktype runtime for outputs (optional)
  run: (input: I, ctx: StepContext<Cfg>) => Promise<O>;
  hooks?: StepHooks<Cfg, I, O>;
  inputs?: StepInputKeys<I>; // keys of expected inputs
  protocol?: StepProtocolMeta;
}

export interface RootStepHooks<Cfg> {
  before?: <I = AuthInput, O = AuthOutput>(
    input: I,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg, any, I, O>,
  ) => Promise<I> | I;
  after?: <I = AuthInput, O = AuthOutput>(
    output: O,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg, any, I, O>,
  ) => Promise<O> | O;
  onError?: <I = AuthInput>(
    error: unknown,
    input: I,
    ctx: StepContext<Cfg>,
    step: AuthStep<Cfg>,
  ) => Promise<void> | void;
}

export interface UniversalAuthHook {
  type: HooksType;
  universal: true;
  pluginName?: never;
  steps?: never;
  session?: boolean;
  fn: (
    data: AuthInput | AuthOutput,
    container: ReAuthCradle,
    error?: unknown,
  ) => Promise<AuthInput | AuthOutput | void> | AuthInput | AuthOutput | void;
}

// Context passed to plugin-level utility functions (non-HTTP, non-step)
export interface PluginProfileContext {
  engine: ReAuthEngine;
  config?: any;
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
