import type { AwilixContainer } from 'awilix';
import type { Type } from 'arktype';
import { InferAbstractQuery } from 'fumadb';

// Minimal Fuma client interface used by V2
export interface FumaClient<OrmT extends OrmLike = OrmLike> {
  version(): Promise<string>;
  orm(version: string): OrmLike;
}

export type Subject = { id: string; [key: string]: any };

// Shared V2 input/output shapes (entity removed). Keep names the same for cross-package compatibility.
export interface AuthInput {
  token?: string | null;
  [key: string]: any;
}

export interface AuthOutput {
  token?: string | null;
  redirect?: string;
  success: boolean;
  message: string;
  status: string;
  subject?: any;
  others?: Record<string, any>;
  [key: string]: any;
}

export type SubjectResolver<OrmT extends OrmLike = OrmLike> = {
  getById: (id: string, orm: OrmT) => Promise<Subject | null>;
  sanitize?: (subject: Subject) => any;
};

export interface SessionResolvers<OrmT extends OrmLike = OrmLike> {
  register(subjectType: string, resolver: SubjectResolver<OrmT>): void;
  get(subjectType: string): SubjectResolver<OrmT> | undefined;
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

export interface SessionServiceV2<OrmT extends OrmLike = OrmLike> {
  createSession(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<string>;
  // Enhanced version for advanced session features
  createSessionWithMetadata?(
    subjectType: string,
    subjectId: string,
    options: CreateSessionOptions,
  ): Promise<string>;
  verifySession(
    token: string,
  ): Promise<{ subject: any | null; token: string | null }>;
  destroySession(token: string): Promise<void>;
  destroyAllSessions(subjectType: string, subjectId: string): Promise<void>;
  // Enhanced session listing
  listSessionsForSubject?(
    subjectType: string,
    subjectId: string,
  ): Promise<Array<{
    sessionId: string;
    token: string;
    createdAt: Date;
    expiresAt: Date | null;
    deviceInfo?: SessionMetadata['deviceInfo'];
    metadata?: Record<string, any>;
  }>>;
}

// ---------------- Step/Plugin Types (V2) ----------------
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

export interface StepHooks<I = unknown, O = unknown, Cfg = unknown> {
  before?: (input: I, ctx: StepContext<Cfg>) => Promise<void> | void;
  after?: (output: O, ctx: StepContext<Cfg>) => Promise<void> | void;
  onError?: (error: unknown, ctx: StepContext<Cfg>) => Promise<void> | void;
}

export interface StepContext<Cfg = unknown, OrmT extends OrmLike = OrmLike> {
  container: AwilixContainer<ReAuthCradleV2Extension<OrmT>>; // DI container with v2 cradle
  engine: EngineApiV2<OrmT>; // narrow engine API to avoid circular import
  config: Cfg;
}

export interface AuthStepV2<
  I = unknown,
  O = unknown,
  Cfg = unknown,
  OrmT extends OrmLike = OrmLike,
> {
  name: string;
  description?: string;
  validationSchema?: Type<any>; // arktype runtime (assert/toJsonSchema)
  outputs?: Type<any>; // arktype runtime for outputs (optional)
  run: (input: I, ctx: StepContext<Cfg, OrmT>) => Promise<O> | O;
  hooks?: StepHooks<I, O, Cfg>;
  inputs?: string[];
  protocol?: StepProtocolMeta;
}

export interface RootStepHooksV2<
  Cfg = unknown,
  OrmT extends OrmLike = OrmLike,
> {
  before?: (
    input: unknown,
    ctx: StepContext<Cfg, OrmT>,
    step: AuthStepV2<unknown, unknown, Cfg, OrmT>,
  ) => Promise<unknown | void> | unknown | void;
  after?: (
    output: unknown,
    ctx: StepContext<Cfg, OrmT>,
    step: AuthStepV2<unknown, unknown, Cfg, OrmT>,
  ) => Promise<unknown | void> | unknown | void;
  onError?: (
    error: unknown,
    input: unknown,
    ctx: StepContext<Cfg, OrmT>,
    step: AuthStepV2<unknown, unknown, Cfg, OrmT>,
  ) => Promise<void> | void;
}

// Context passed to plugin-level utility functions (non-HTTP, non-step)
export interface PluginProfileContext<OrmT extends OrmLike = OrmLike> {
  orm: OrmT;
  engine: EngineApiV2<OrmT>;
  container: AwilixContainer<ReAuthCradleV2Extension<OrmT>>;
  config?: any;
}

export interface EngineInitApiV2<OrmT extends OrmLike = OrmLike>
  extends EngineApiV2<OrmT> {
  registerSessionResolver(
    subjectType: string,
    resolver: SubjectResolver<OrmT>,
  ): this;
  registerCleanupTask(task: CleanupTask): this;
  enableEnhancedSessions(): this;
  // Plugin introspection APIs available during initialization (backed by ReAuthEngineV2)
  getPlugin(name: string): AuthPluginV2 | undefined;
  getAllPlugins(): AuthPluginV2[];
}

export interface AuthPluginV2<Cfg = unknown, OrmT extends OrmLike = OrmLike> {
  name: string;
  initialize?: (engine: EngineInitApiV2<OrmT>) => Promise<void> | void;
  // Allow plugins to provide strongly-typed steps without conflicting with the interface
  steps?: Array<AuthStepV2<any, any, Cfg, OrmT>>;
  getSensitiveFields?: () => string[];
  config?: Cfg;
  rootHooks?: RootStepHooksV2<Cfg, OrmT>;
  // Optional, non-HTTP function to fetch plugin-specific profile details for a subject
  getProfile?: (subjectId: string, ctx: PluginProfileContext<OrmT>) => Promise<any> | any;
}

// ---------------- Hook Types (V2) ----------------
export type HooksTypeV2 = 'before' | 'after' | 'onError';

export interface AuthHookV2 {
  type: HooksTypeV2;
  pluginName?: string; // if provided, limits to a specific plugin
  steps?: string[]; // if provided, limits to specific steps
  session?: boolean; // marks this as a session-level hook
  universal?: boolean; // applies to all plugins/steps
  fn: (
    data: AuthInput | AuthOutput,
    container: AwilixContainer<any>,
    error?: unknown,
  ) => Promise<AuthInput | AuthOutput | void> | AuthInput | AuthOutput | void;
}

// narrow engine API exposed to steps to avoid circular type dep
export interface EngineApiV2<OrmT extends OrmLike = OrmLike> {
  getOrm(): Promise<OrmT>;
  createSessionFor(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<string>;
  checkSession(token: string): Promise<{
    subject: any | null;
    token: string | null;
    valid: boolean;
  }>;
  getSessionService?(): SessionServiceV2<OrmT>;
  // Allow steps to orchestrate other plugin steps when appropriate (e.g., conversions)
  executeStep(
    pluginName: string,
    stepName: string,
    input: unknown,
  ): Promise<unknown>;
  // Optional convenience to check plugin presence
  getPlugin?(name: string): AuthPluginV2 | undefined;
  // Optional universal profile aggregator
  getUnifiedProfile?(
    subjectId: string,
  ): Promise<{ subjectId: string; plugins: Record<string, any>; generatedAt: string }>;
}

export interface ReAuthCradleV2Extension<OrmT extends OrmLike = OrmLike> {
  dbClient: FumaClient<OrmT>;
  sessionServiceV2: SessionServiceV2<OrmT>;
  sessionResolvers: SessionResolvers<OrmT>;
}

export type ReAuthCradleV2<OrmT extends OrmLike = OrmLike> = AwilixContainer<
  ReAuthCradleV2Extension<OrmT>
> & {
  cradle: ReAuthCradleV2Extension<OrmT> & Record<string, unknown>;
};

// Use the precise FumaDB abstract query type for our ORM alias.
export type OrmLike = InferAbstractQuery<any, any>;

// ---------------- Background Cleanup Scheduler Types ----------------
export interface CleanupTask {
  name: string;
  pluginName: string;
  intervalMs: number; // How often to run the cleanup (in milliseconds)
  enabled: boolean;
  runner: (orm: OrmLike, config?: any) => Promise<{ cleaned: number; errors?: string[] }>;
}

export interface CleanupScheduler {
  registerTask(task: CleanupTask): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getRegisteredTasks(): CleanupTask[];
  setPluginConfig(pluginName: string, config: any): void;
}
