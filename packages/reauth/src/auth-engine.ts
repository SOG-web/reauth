import {
  createContainer,
  InjectionMode,
  AwilixContainer,
  asValue,
} from 'awilix';
import { createHookRegisterer, executeStep } from './plugins/utils';
import type {
  AuthInput,
  AuthOutput,
  AuthPlugin,
  AuthToken,
  EntityService,
  HooksType,
  MigrationConfig,
  ReAuthCradle,
  SessionService,
  SensitiveFields,
  Entity,
  AuthHooks,
  IntrospectionResult,
  EntitySchema,
  FieldSchema,
} from './types';
import { PluginNotFound, StepNotFound } from './types';

export class ReAuthEngine {
  private container: AwilixContainer<ReAuthCradle>;
  private plugins: AuthPlugin[] = [];
  private migrationConfig: MigrationConfig;
  private sensitiveFields: SensitiveFields = {};
  private authHooks: AuthHooks[] = [];

  constructor(config: {
    plugins: AuthPlugin[];
    entity: EntityService;
    session: SessionService;
    sensitiveFields?: SensitiveFields;
    authHooks?: AuthHooks[];
  }) {
    this.container = createContainer<ReAuthCradle>({
      injectionMode: InjectionMode.CLASSIC,
      strict: true,
    });

    this.sensitiveFields = config.sensitiveFields || {};
    this.authHooks = config.authHooks || [];

    // Register core services and sensitive fields handling
    this.container.register({
      entityService: asValue(config.entity),
      sessionService: asValue(config.session),
      sensitiveFields: asValue(this.sensitiveFields),
      serializeEntity: asValue(this.serializeEntity.bind(this)),
      reAuthEngine: asValue(this),
    });

    config.plugins.forEach((plugin) => this.registerPlugin(plugin));

    this.migrationConfig = {
      migrationName: 'reauth',
      outputDir: 'migrations',
      baseTables: [
        {
          tableName: 'entities',
          columns: {
            id: {
              type: 'uuid',
              primary: true,
              nullable: false,
              unique: true,
              defaultValue: 'uuid',
            },
            role: {
              type: 'string',
              nullable: false,
              defaultValue: 'user',
            },
          },
          timestamps: true,
        },
        {
          tableName: 'sessions',
          columns: {
            id: {
              type: 'uuid',
              primary: true,
              nullable: false,
              unique: true,
              defaultValue: 'uuid',
            },
            entity_id: {
              type: 'uuid',
              nullable: false,
            },
            token: {
              type: 'string',
              unique: true,
              nullable: false,
            },
            expires_at: {
              type: 'timestamp',
              nullable: true,
            },
          },
          timestamps: true,
        },
      ],
      plugins: config.plugins
        .map((plugin) => plugin.migrationConfig)
        .filter((config) => config !== undefined),
    };
  }

  registerAuthHook(opt: {
    pluginName: string;
    type: HooksType;
    fn: (
      data: AuthInput | AuthOutput,
      container: AwilixContainer<ReAuthCradle>,
      error?: Error,
    ) => Promise<AuthOutput | AuthInput | void>;
    steps?: string[];
    session?: boolean;
    universal?: boolean;
  }) {
    this.authHooks.push({
      pluginName: opt.pluginName,
      steps: opt.steps || [],
      type: opt.type,
      fn: opt.fn,
      session: opt.session || false,
      universal: opt.universal || false,
    });
    return this;
  }

  getMirgrationCongfig(): MigrationConfig {
    return this.migrationConfig;
  }

  /**
   * Get a service from the DI container
   * @param name The name of the service to retrieve
   */
  getService<T extends keyof ReAuthCradle>(
    container: AwilixContainer<ReAuthCradle>,
    serviceName: T,
  ): ReAuthCradle[T] {
    return container.cradle[serviceName];
  }

  /**
   * Register an auth plugin
   * @param auth The auth plugin to register
   */
  private registerPlugin(plugin: AuthPlugin) {
    this.plugins.push(plugin);

    // Register plugin's sensitive fields if defined
    if (plugin.getSensitiveFields) {
      const fields = plugin.getSensitiveFields();
      if (fields && fields.length > 0) {
        this.sensitiveFields[plugin.name] = fields;
      }
    }
    plugin.initialize(this.container);
    return this;
  }

  /**
   * Serializes an entity by redacting sensitive fields
   * @param entity The entity to serialize
   * @returns A new object with sensitive fields redacted
   */
  private serializeEntity<T extends Entity>(entity: T): T {
    if (!entity) return entity;

    // Create a shallow copy of the entity
    const serialized = { ...entity } as Record<string, any>;

    // Get all sensitive fields from all plugins
    const allSensitiveFields = Object.values(this.sensitiveFields).flat();

    // Redact sensitive fields
    allSensitiveFields.forEach((field) => {
      if (field in serialized) {
        serialized[field] = '[REDACTED]';
      }
    });

    return serialized as T;
  }

  /**
   * Get a plugin by name
   * @param name The name of the plugin to retrieve
   */
  getPlugin(name: string) {
    const plugin = this.plugins.find((p) => p.name === name);
    if (!plugin) {
      throw new PluginNotFound(name);
    }
    return plugin;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins() {
    return this.plugins;
  }

  /**
   * Get the DI container
   */
  getContainer(): AwilixContainer<ReAuthCradle> {
    return this.container;
  }

  async executeStep(pluginName: string, stepName: string, input: AuthInput) {
    try {
      const plugin = this.getPlugin(pluginName);
      const step = plugin.steps.find((s) => s.name === stepName);
      if (!step) {
        throw new StepNotFound(stepName, pluginName);
      }

      const processedInput = await this.executeAuthHooks(
        'before',
        input,
        stepName,
        pluginName,
      );

      if (plugin.rootHooks?.before) {
        input = await plugin.rootHooks.before(processedInput, this.container, step);
      } else {
        input = processedInput;
      }

      if (plugin.runStep)
        return plugin.runStep(step.name, input, this.container);

      let output = await executeStep(stepName, input, {
        pluginName,
        step,
        container: this.container,
        config: plugin.config,
      });

      const processedOutput = await this.executeAuthHooks(
        'after',
        output,
        stepName,
        pluginName,
      );

      if (plugin.rootHooks?.after) {
        output = await plugin.rootHooks.after(processedOutput as AuthOutput, this.container, step);
      } else {
        output = processedOutput as AuthOutput;
      }

      return output as AuthOutput;
    } catch (error: any) {
      const plugin = this.getPlugin(pluginName);
      const step = plugin.steps.find((s) => s.name === stepName);
      if (!step) {
        throw new StepNotFound(stepName, pluginName);
      }

      await this.executeAuthHooks(
        'onError',
        input,
        stepName,
        pluginName,
        error,
      );

      if (plugin.rootHooks?.onError) {
        await plugin.rootHooks.onError(error, input, this.container, step);
      }

      throw error;
    }
  }

  registerHook(
    pluginName: string,
    stepName: string,
    type: HooksType,
    fn: (
      data: AuthInput | AuthOutput,
      container: AwilixContainer<ReAuthCradle>,
      error?: Error,
    ) => Promise<AuthOutput | AuthInput | void>,
  ) {
    const plugin = this.getPlugin(pluginName);
    const step = plugin.steps.find((s) => s.name === stepName);
    if (!step) {
      throw new StepNotFound(stepName, pluginName);
    }

    if (step.registerHook) {
      step.registerHook(type, fn);

      return this;
    }

    if (!step.hooks) step.hooks = {};

    const register = createHookRegisterer(step.hooks);
    register(type, fn);
    return this;
  }

  getStepInputs(pluginName: string, stepName: string) {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new PluginNotFound(pluginName);
    }

    const step = plugin.steps.find((s) => s.name === stepName);
    if (!step) {
      throw new StepNotFound(stepName, pluginName);
    }

    return step.inputs;
  }

  /**
   * Get introspection data for SDK generation
   * Returns comprehensive information about entity schema, plugins, steps, and types
   */
  getIntrospectionData(): IntrospectionResult {
    // Get entity schema from migration config
    const migrationConfig = this.getMirgrationCongfig();
    const entitySchema = this.extractEntitySchema(migrationConfig);

    // Get all plugins with their steps and metadata
    const plugins = this.plugins.map((plugin) => ({
      name: plugin.name,
      description: `${plugin.name} authentication plugin`,
      steps: plugin.steps.map((step) => ({
        name: step.name,
        description: step.description,
        inputs: step.validationSchema?.toJsonSchema() || {},
        outputs: step.outputs?.toJsonSchema() || {},
        protocol: step.protocol,
        requiresAuth: step.protocol.http?.auth || false,
      })),
    }));

    return JSON.parse(JSON.stringify({
      entity: entitySchema,
      plugins,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    }));
  }

  /**
   * Extract entity schema from migration config
   */
  private extractEntitySchema(migrationConfig: MigrationConfig): EntitySchema {
    const baseEntityFields: Record<string, FieldSchema> = {
      id: { type: 'string', required: true, description: 'Unique entity identifier' },
      role: { type: 'string', required: true, description: 'Entity role' },
      created_at: { type: 'string', format: 'date-time', required: true, description: 'Creation timestamp' },
      updated_at: { type: 'string', format: 'date-time', required: true, description: 'Last update timestamp' },
    };

    // Collect all fields from plugin extensions
    const extendedFields: Record<string, FieldSchema> = {};

    migrationConfig.plugins.forEach((pluginConfig) => {
      if (pluginConfig.extendTables) {
        pluginConfig.extendTables.forEach((tableExtension) => {
          if (tableExtension.tableName === 'entities') {
            Object.entries(tableExtension.columns).forEach(([fieldName, column]) => {
              extendedFields[fieldName] = {
                type: this.mapColumnTypeToTsType(column.type),
                format: this.getColumnFormat(column.type),
                required: !column.nullable,
                description: `${fieldName} field from ${pluginConfig.pluginName} plugin`,
              };
            });
          }
        });
      }
    });

    return {
      type: 'object',
      properties: { ...baseEntityFields, ...extendedFields },
      required: Object.entries({ ...baseEntityFields, ...extendedFields })
        .filter(([_, field]) => field.required)
        .map(([name]) => name),
    };
  }

  /**
   * Map database column types to TypeScript types
   */
  private mapColumnTypeToTsType(columnType: string): string {
    switch (columnType) {
      case 'string':
      case 'text':
      case 'uuid':
        return 'string';
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'datetime':
      case 'timestamp':
        return 'string';
      case 'json':
        return 'object';
      case 'decimal':
        return 'number';
      default:
        return 'any';
    }
  }

  /**
   * Get format for specific column types
   */
  private getColumnFormat(columnType: string): string | undefined {
    switch (columnType) {
      case 'datetime':
      case 'timestamp':
        return 'date-time';
      case 'uuid':
        return 'uuid';
      default:
        return undefined;
    }
  }

  /**
   * Create a new session for an entity
   * This method runs through session creation hooks to allow plugins to perform additional checks
   * @param entityId The entity ID to create a session for
   * @returns Promise<{ token: AuthToken, success: boolean, error?: string }>
   */
  async createSession(
    entity: Entity,
    stepName: string,
  ): Promise<{
    token: AuthToken;
    success: boolean;
    message?: string;
    error?: Error;
  }> {
    try {
      // Create input for session creation hooks
      const input: AuthInput = {
        entity,
      };

      // Run session creation hooks (before)
      const processedInput = await this.executeSessionHooks(
        'before',
        input,
        stepName,
      );

      if (!processedInput.entity) {
        return {
          token: null,
          success: false,
          message: 'Entity not found',
          error: new Error('Entity not found'),
        };
      }

      // Create the session
      const sessionService = this.container.cradle.sessionService;
      const token = await sessionService.createSession(entity.id);

      // Create output for session creation hooks
      const output: AuthOutput = {
        entity,
        token,
        success: true,
        message: 'Session created successfully',
        status: 'created',
      };

      // Run session creation hooks (after)
      const processedOutput = await this.executeSessionHooks(
        'after',
        output,
        stepName,
      );

      return {
        token: processedOutput.token!,
        success: processedOutput.success ?? true,
        message: processedOutput.message ?? 'Session created successfully',
        error: processedOutput.error,
      };
    } catch (error: any) {
      // Run session creation hooks (onError)
      await this.executeSessionHooks(
        'onError',
        { entity } as AuthInput,
        stepName,
        error,
      );

      return {
        token: null,
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  /**
   * Validate a session token and return the associated entity
   * This method runs through session validation hooks to allow plugins to perform additional checks
   * @param token The session token to validate
   * @returns Promise<{entity: Entity | null, token: AuthToken, valid: boolean}>
   */
  async checkSession(token: string): Promise<{
    entity: Entity | null;
    token: AuthToken;
    valid: boolean;
    message?: string;
    error?: Error;
  }> {
    try {
      // Verify the session with the session service
      const sessionService = this.container.cradle.sessionService;
      const result = await sessionService.verifySession(token);

      if (!result.entity || !result.token) {
        return {
          entity: null,
          token: null,
          valid: false,
          message: 'Invalid or expired session',
          error: new Error('Invalid or expired session'),
        };
      }

      // Create input for session validation hooks
      const input: AuthInput = {
        entity: result.entity,
        token: result.token,
      };

      // Run session validation hooks (before)
      const processedInput = await this.executeSessionHooks(
        'before',
        input,
        '',
      );

      // Create output for session validation hooks
      const output: AuthOutput = {
        entity: processedInput.entity!,
        token: processedInput.token!,
        success: true,
        message: 'Session is valid',
        status: 'valid',
      };

      // Run session validation hooks (after)
      const processedOutput = await this.executeSessionHooks(
        'after',
        output,
        '',
      );

      return {
        entity: processedOutput.entity!,
        token: processedOutput.token!,
        valid: processedOutput.success,
        message: processedOutput.success ? undefined : processedOutput.message,
        error: processedOutput.success ? undefined : processedOutput.error,
      };
    } catch (error: any) {
      console.log('Error checking session:', error);
      // Run session validation hooks (onError)
      await this.executeSessionHooks(
        'onError',
        { token } as AuthInput,
        '',
        error,
      );

      return {
        entity: null,
        token: null,
        valid: false,
        message: error.message,
        error: error,
      };
    }
  }

  /**
   * Execute session-related hooks
   * @private
   */
  private async executeSessionHooks(
    type: HooksType,
    data: AuthInput | AuthOutput,
    stepName: string,
    error?: Error,
  ): Promise<AuthInput | AuthOutput> {
    // Find session-related hooks from registered auth hooks
    const sessionHooks = this.authHooks.filter(
      (hook) =>
        hook.type === type &&
        hook.session &&
        (hook.steps.includes(stepName) || hook.universal),
    );

    if (sessionHooks.length === 0) {
      return data;
    }

    let processedData = data;

    if (type === 'onError' && error) {
      // Execute error hooks in parallel
      await Promise.all(
        sessionHooks.map((hook) =>
          hook.fn(processedData, this.container, error),
        ),
      );
      return processedData;
    }

    // Execute before/after hooks in sequence
    for (const hook of sessionHooks) {
      const result = await hook.fn(processedData, this.container);
      if (result) {
        processedData = result as AuthInput | AuthOutput;
      }
    }

    return processedData;
  }

  /**
   * Register a session hook that will be called during session creation and validation
   * @param type The type of hook (before, after, onError)
   * @param fn The hook function
   * @param universal Whether this hook should run for all session operations
   */
  registerSessionHook(
    type: HooksType,
    fn: (
      data: AuthInput | AuthOutput,
      container: AwilixContainer<ReAuthCradle>,
      error?: Error,
    ) => Promise<AuthOutput | AuthInput | void>,
    universal?: boolean,
  ) {
    this.authHooks.push({
      pluginName: 'session',
      steps: ['session'],
      type,
      fn,
      session: true,
      universal,
    });
    return this;
  }

  /**
   * Execute auth hooks
   * @private
   * @param type The type of hook (before, after, onError)
   * @param data The data to pass to the hook
   * @param stepName The name of the step to execute hooks for
   * @param error The error to pass to the hook
   */
  private async executeAuthHooks(
    type: HooksType,
    data: AuthInput | AuthOutput,
    stepName: string,
    pluginName?: string,
    error?: Error,
  ): Promise<AuthInput | AuthOutput> {
    // Find auth hooks from registered auth hooks
    const authHooks = this.authHooks.filter(
      (hook) =>
        hook.type === type &&
        !hook.session &&
        (hook.steps.includes(stepName) ||
          hook.universal ||
          pluginName === hook.pluginName),
    );

    if (authHooks.length === 0) {
      return data;
    }

    let processedData = data;

    if (type === 'onError' && error) {
      // Execute error hooks in parallel
      await Promise.all(
        authHooks.map((hook) => hook.fn(processedData, this.container, error)),
      );
      return processedData;
    }

    // Execute before/after hooks in sequence
    for (const hook of authHooks) {
      const result = await hook.fn(processedData, this.container);
      if (result) {
        processedData = result as AuthInput | AuthOutput;
      }
    }

    return processedData;
  }
}

export const createReAuthEngine = (config: {
  plugins: AuthPlugin[];
  entity: EntityService;
  session: SessionService;
  sensitiveFields?: SensitiveFields;
  authHooks?: AuthHooks[];
}): ReAuthEngine => {
  return new ReAuthEngine(config);
};
