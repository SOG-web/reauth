import type { Type } from 'arktype';
import type { AwilixContainer } from 'awilix';

// Base types for V2 architecture
export interface AuthInputV2 {
  [key: string]: any;
}

export interface AuthOutputV2 {
  success: boolean;
  message?: string;
  session?: SessionV2;
  subject?: string;
  others?: Record<string, any>;
}

export interface SessionV2 {
  id: string;
  subject_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Shared credentials model - password hash per subject
export interface CredentialsV2 {
  id: string;
  subject_id: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

// Provider-specific identities linking to subjects
export interface IdentityV2 {
  id: string;
  subject_id: string;
  provider: string;
  identifier: string;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

// Subject - central entity
export interface SubjectV2 {
  id: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

// Plugin configuration for test users
export interface TestUsersConfigV2 {
  enabled: boolean;
  environmentGating: boolean;
  allowedEnvironments?: string[];
  users: string[];
}

// Base plugin configuration
export interface BasePluginConfigV2 {
  loginOnRegister?: boolean;
  sessionTtlSeconds?: number;
  testUsers?: TestUsersConfigV2;
}

// Protocol metadata for introspection
export interface StepProtocolV2 {
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  path: string;
  auth: boolean;
  statusCodes: {
    success: number;
    error: number;
    validation?: number;
  };
}

// V2 step definition with outputs schema and protocol
export interface AuthStepV2<TInput = AuthInputV2, TOutput = AuthOutputV2> {
  name: string;
  description: string;
  inputs: Type<TInput>;
  outputs: Type<TOutput>;
  protocol: StepProtocolV2;
  run: (input: TInput, context: StepContextV2) => Promise<TOutput>;
}

// Step execution context
export interface StepContextV2 {
  container: AwilixContainer<ReAuthCradleV2>;
  config: any;
  pluginName: string;
}

// V2 Plugin definition
export interface AuthPluginV2<TConfig = BasePluginConfigV2> {
  name: string;
  version: '2.0';
  config: TConfig;
  steps: AuthStepV2[];
  schemas: PluginSchemasV2;
  sessionResolver?: (subject_id: string) => Promise<SessionV2 | null>;
  initialize?: () => Promise<void> | void;
}

// Plugin database schemas
export interface PluginSchemasV2 {
  tables: TableSchemaV2[];
  indexes?: IndexSchemaV2[];
}

export interface TableSchemaV2 {
  name: string;
  columns: Record<string, ColumnSchemaV2>;
  constraints?: ConstraintSchemaV2[];
}

export interface ColumnSchemaV2 {
  type: 'uuid' | 'string' | 'text' | 'timestamp' | 'boolean' | 'integer';
  nullable?: boolean;
  unique?: boolean;
  primary?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface ConstraintSchemaV2 {
  type: 'unique' | 'check' | 'foreign_key';
  columns: string[];
  condition?: string;
}

export interface IndexSchemaV2 {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

// V2 services
export interface EntityServiceV2 {
  findSubject(id: string): Promise<SubjectV2 | null>;
  createSubject(data: Partial<SubjectV2>): Promise<SubjectV2>;
  findIdentity(provider: string, identifier: string): Promise<IdentityV2 | null>;
  createIdentity(data: Omit<IdentityV2, 'id' | 'created_at' | 'updated_at'>): Promise<IdentityV2>;
  updateIdentity(id: string, data: Partial<IdentityV2>): Promise<IdentityV2>;
  getCredentials(subject_id: string): Promise<CredentialsV2 | null>;
  setCredentials(subject_id: string, password_hash: string): Promise<CredentialsV2>;
}

export interface SessionServiceV2 {
  createSession(subject_id: string, ttlSeconds: number): Promise<SessionV2>;
  getSession(token: string): Promise<SessionV2 | null>;
  deleteSession(token: string): Promise<void>;
  refreshSession(token: string, ttlSeconds: number): Promise<SessionV2>;
}

// V2 container dependencies
export interface ReAuthCradleV2 {
  entityService: EntityServiceV2;
  sessionService: SessionServiceV2;
  reAuthEngine: ReAuthEngineV2;
}

// Engine introspection result
export interface IntrospectionResultV2 {
  plugins: PluginIntrospectionV2[];
  baseSchemas: TableSchemaV2[];
}

export interface PluginIntrospectionV2 {
  name: string;
  version: string;
  config: any;
  steps: StepIntrospectionV2[];
  schemas: PluginSchemasV2;
}

export interface StepIntrospectionV2 {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  protocol: StepProtocolV2;
}

// Main V2 engine interface
export interface ReAuthEngineV2 {
  registerPlugin(plugin: AuthPluginV2): void;
  executeStep(pluginName: string, stepName: string, input: AuthInputV2): Promise<AuthOutputV2>;
  introspect(): IntrospectionResultV2;
  initialize(): Promise<void>;
}

// Error types
export class PluginNotFoundV2 extends Error {
  constructor(pluginName: string) {
    super(`Plugin '${pluginName}' not found`);
    this.name = 'PluginNotFoundV2';
  }
}

export class StepNotFoundV2 extends Error {
  constructor(pluginName: string, stepName: string) {
    super(`Step '${stepName}' not found in plugin '${pluginName}'`);
    this.name = 'StepNotFoundV2';
  }
}

export class ConfigurationErrorV2 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationErrorV2';
  }
}