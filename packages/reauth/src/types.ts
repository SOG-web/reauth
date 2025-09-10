import type { AwilixContainer } from "awilix";
import type { ReAuthEngine } from "./auth-engine";
import type { Type } from "arktype";
import { column, idColumn, RelationBuilder, table } from "fumadb/schema";

export interface ValidationResult {
	isValid: boolean;
	errors?: Record<string, string> | undefined;
}

export type ValidationRule<T = any> = (
	value: T,
	input: AuthInput,
) => string | undefined;

export type ValidationSchema = Record<
	string,
	ValidationRule | ValidationRule[]
>;

export type StepInputHook<T> = (
	input: T,
	container: AwilixContainer<ReAuthCradle>,
) => T | Promise<T>;

export type StepOutputHook<T> = (
	output: T,
	container: AwilixContainer<ReAuthCradle>,
) => T | Promise<T>;

export type StepErrorHook = (
	error: Error,
	input: AuthInput,
	container: AwilixContainer<ReAuthCradle>,
) => Promise<void> | void;

export interface AuthStepHooks {
	before?: StepInputHook<AuthInput>[];
	after?: StepOutputHook<AuthOutput>[];
	onError?: StepErrorHook[];
}

export type RootStepInputHook = (
	input: AuthInput,
	container: AwilixContainer<ReAuthCradle>,
	step: AuthStep<AuthInput>,
) => AuthInput | Promise<AuthInput>;

export type RootStepOutputHook = (
	output: AuthOutput,
	container: AwilixContainer<ReAuthCradle>,
	step: AuthStep<AuthOutput>,
) => AuthOutput | Promise<AuthOutput>;

export type RootStepErrorHook = (
	error: Error,
	input: AuthInput,
	container: AwilixContainer<ReAuthCradle>,
	step: AuthStep<AuthInput>,
) => Promise<void> | void;

export interface RootStepHooks {
	before?: RootStepInputHook;
	after?: RootStepOutputHook;
	onError?: RootStepErrorHook;
}

export interface AuthHooks {
	type: HooksType;
	fn: (
		data: AuthInput | AuthOutput,
		container: AwilixContainer<ReAuthCradle>,
		error?: Error,
	) => Promise<AuthOutput | AuthInput | void>;
	pluginName: string;
	steps: string[];
	session?: boolean;
	universal?: boolean;
}

export type PluginProp<T = any> = {
	pluginName: string;
	container: AwilixContainer<ReAuthCradle>;
	config: T;
};

export interface AuthStep<T> {
	name: string;
	description: string;
	validationSchema?: Type<any>;
	outputs?: Type<any>;
	inputs: string[];
	hooks?: AuthStepHooks;
	registerHook?(
		type: HooksType,
		fn: (
			data: AuthInput | AuthOutput,
			container: AwilixContainer<ReAuthCradle>,
			error?: Error,
		) => Promise<AuthOutput | AuthInput | void>,
	): void;
	run(input: AuthInput, pluginProperties?: PluginProp<T>): Promise<AuthOutput>;
	protocol: {
		http?: {
			method: string;
			auth?: boolean;
			[key: string]: any;
		};
		[key: string]: any;
	};
}

export interface AuthInput {
	entity?: Entity;
	token?: AuthToken;
	[key: string]: any;
}

export type HooksType = "before" | "after" | "onError";

export interface SensitiveFields {
	[pluginName: string]: string[];
}

export interface AuthPlugin<T = any> {
	name: string;
	steps: AuthStep<T>[];
	container?: AwilixContainer<ReAuthCradle>;
	/**
	 * Initialize the plugin with an optional DI container
	 * @param container Optional Awilix container for dependency injection
	 */
	initialize(container: AwilixContainer<ReAuthCradle>): Promise<void> | void;

	/**
	 * Returns an array of field names that should be considered sensitive
	 * and redacted during serialization
	 */
	getSensitiveFields?(): string[];

	migrationConfig?: PluginMigrationConfig;

	config: Partial<T>;

	dependsOn?: string[];

	runStep?(
		step: string,
		input: AuthInput,
		container: AwilixContainer<ReAuthCradle>,
	): Promise<AuthOutput>;

	//TODO: fix the implementation
	rootHooks?: RootStepHooks;
}

export interface AuthOutput {
	entity?: Entity;
	token?: AuthToken;
	redirect?: string;
	success: boolean;
	message: string;
	status: string;
	[key: string]: any;
}

export interface BaseReAuthCradle {
	entityService: EntityService;
	sessionService: SessionService;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface ReAuthCradleExtension {}

export interface ReAuthCradle extends BaseReAuthCradle, ReAuthCradleExtension {
	sensitiveFields: SensitiveFields;
	serializeEntity: <T extends Entity>(entity: T) => T;
	reAuthEngine: ReAuthEngine;
}

// type CradleService<T extends keyof ReAuthCradle> = ReAuthCradle[T];

export interface ColumnDefinition {
	type:
		| "string"
		| "integer"
		| "boolean"
		| "datetime"
		| "timestamp"
		| "text"
		| "json"
		| "decimal"
		| "uuid";
	length?: number;
	nullable?: boolean;
	defaultValue?: any;
	unique?: boolean;
	index?: boolean;
	primary?: boolean;
	references?: {
		table: string;
		column: string;
		onDelete?: "CASCADE" | "SET NULL" | "RESTRICT";
		onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT";
	};
}

export interface TableSchema {
	tableName: string;
	columns: Record<string, ColumnDefinition>;
	timestamps?: boolean;
	indexes?: Array<{
		columns: string[];
		name?: string;
		unique?: boolean;
	}>;
}

export interface PluginMigrationConfig {
	pluginName: string;
	tables?: TableSchema[];
	extendTables?: Array<{
		tableName: string;
		columns: Record<string, ColumnDefinition>;
		indexes?: Array<{
			columns: string[];
			name?: string;
			unique?: boolean;
		}>;
	}>;
}

export interface MigrationConfig {
	migrationName: string;
	outputDir: string;
	plugins: PluginMigrationConfig[];
	baseTables?: TableSchema[];
}

export class ConfigError extends Error {
	constructor(
		message: string,
		public pluginName: string,
		public data?: any,
	) {
		super(message);
		this.name = "ConfigError";
	}
}

export class AuthInputError extends Error {
	constructor(
		message: string,
		public pluginName: string,
		public stepName: string,
		public data?: any,
	) {
		super(message);
		this.name = "AuthInputError";
	}
}

export class StepNotFound extends Error {
	constructor(
		step: string,
		public pluginName: string,
	) {
		super(`Step ${step} not found for plugin ${pluginName}`);
		this.name = "StepNotFound";
	}
}

export class ValidationError extends Error {
	constructor(
		message: string,
		public pluginName: string,
		public stepName: string,
		public hookType?: HooksType,
		public data?: any,
	) {
		super(message);
		this.name = "ValidationError";
	}
}

export class PluginNotFound extends Error {
	constructor(plugin: string) {
		super(`Plugin ${plugin} not found`);
		this.name = "PluginNotFound";
	}
}

export class HooksError extends Error {
	data?: any;

	constructor(
		message: string,
		public pluginName: string,
		public stepName: string,
		public hookType: HooksType,
		data?: any,
	) {
		super(message);
		this.name = "HooksError";
		this.data = data;
	}
}

export class InitializationError extends Error {
	constructor(
		message: string,
		public pluginName: string,
		public data?: any,
	) {
		super(message);
		this.name = "InitializationError";
	}
}

export type BaseEntity = {
	id: string;
	role: string;
	created_at: Date;
	updated_at: Date;
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface EntityExtension {}

// Generic type for custom user fields
export type Entity = BaseEntity & EntityExtension;

export interface BaseSession {
	id: string;
	entity_id: string;
	token: string;
	expires_at: Date;
	created_at: Date;
	updated_at: Date;
}

// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface SessionExtension {}

export interface Session extends BaseSession, SessionExtension {}

export type AuthToken = string | null;

export type EntityService = {
	findEntity(id: string, filed: string): Promise<Entity | null>;
	createEntity(entity: Partial<Entity>): Promise<Entity>;
	updateEntity(
		id: string,
		filed: string,
		entity: Partial<Entity>,
	): Promise<Entity>;
	deleteEntity(id: string, filed: string): Promise<void>;
};

export type SessionService = {
	createSession(entityId: string | number): Promise<AuthToken>;
	verifySession(
		token: string,
	): Promise<{ entity: Entity | null; token: AuthToken }>;
	destroySession(token: string): Promise<void>;
	destroyAllSessions(entityId: string | number): Promise<void>;
};

/**
 * SDK Generation and Introspection Types
 */

export interface FieldSchema {
	type: string;
	format?: string;
	required: boolean;
	description: string;
}

export interface EntitySchema {
	type: "object";
	properties: Record<string, FieldSchema>;
	required: string[];
}

export interface IntrospectionStep {
	name: string;
	description: string;
	inputs: Record<string, any>;
	outputs: Record<string, any>;
	protocol: {
		http?: {
			method: string;
			auth?: boolean;
			[key: string]: any;
		};
		[key: string]: any;
	};
	requiresAuth: boolean;
}

export interface IntrospectionPlugin {
	name: string;
	description: string;
	steps: IntrospectionStep[];
}

export interface IntrospectionResult {
	entity: EntitySchema;
	plugins: IntrospectionPlugin[];
	generatedAt: string;
	version: string;
}


export type ReauthSchemaPlugin = {
	tables?: Record<string, ReturnType<typeof table>>;
	relations?: Record<string, (builder: RelationBuilder<any>) => Record<string, unknown>>;
  /**
   * Extend columns of existing tables by name. Keys are table names, values are maps of new columns.
   * These columns will be merged into core table column maps before creating the final tables.
   */
  extendTables?: Record<
    string,
    Record<string, ReturnType<typeof column> | ReturnType<typeof idColumn>>
  >;
  };