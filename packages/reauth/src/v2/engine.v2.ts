import {
  createContainer,
  InjectionMode,
  AwilixContainer,
  asValue,
} from 'awilix';
import type {
  AuthPluginV2,
  AuthInputV2,
  AuthOutputV2,
  ReAuthEngineV2,
  ReAuthCradleV2,
  EntityServiceV2,
  SessionServiceV2,
  IntrospectionResultV2,
  PluginIntrospectionV2,
  StepIntrospectionV2,
} from './types.v2';
import {
  PluginNotFoundV2,
  StepNotFoundV2,
  ConfigurationErrorV2,
} from './types.v2';
import { baseSchemas } from './base.schema.v2';
import { sessionsSchema } from './session.schema.v2';

export class ReAuthEngineV2Impl implements ReAuthEngineV2 {
  private container: AwilixContainer<ReAuthCradleV2>;
  private plugins = new Map<string, AuthPluginV2>();

  constructor(config: {
    entityService: EntityServiceV2;
    sessionService: SessionServiceV2;
  }) {
    this.container = createContainer<ReAuthCradleV2>({
      injectionMode: InjectionMode.CLASSIC,
      strict: true,
    });

    // Register core services
    this.container.register({
      entityService: asValue(config.entityService),
      sessionService: asValue(config.sessionService),
      reAuthEngine: asValue(this),
    });
  }

  registerPlugin(plugin: AuthPluginV2): void {
    if (plugin.version !== '2.0') {
      throw new ConfigurationErrorV2(
        `Plugin '${plugin.name}' must use version 2.0, got ${plugin.version}`,
      );
    }

    // Validate plugin configuration at initialization time
    this.validatePluginConfig(plugin);

    this.plugins.set(plugin.name, plugin);

    // Initialize plugin if it has an initialize method
    if (plugin.initialize) {
      try {
        const result = plugin.initialize();
        if (result instanceof Promise) {
          result.catch((error) => {
            throw new ConfigurationErrorV2(
              `Failed to initialize plugin '${plugin.name}': ${error.message}`,
            );
          });
        }
      } catch (error) {
        throw new ConfigurationErrorV2(
          `Failed to initialize plugin '${plugin.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  async executeStep(
    pluginName: string,
    stepName: string,
    input: AuthInputV2,
  ): Promise<AuthOutputV2> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new PluginNotFoundV2(pluginName);
    }

    const step = plugin.steps.find((s) => s.name === stepName);
    if (!step) {
      throw new StepNotFoundV2(pluginName, stepName);
    }

    // Validate input against step schema
    const inputValidation = step.inputs(input);
    if (inputValidation instanceof Error) {
      return {
        success: false,
        message: `Invalid input: ${inputValidation.message}`,
      };
    }

    // Execute step
    const context = {
      container: this.container,
      config: plugin.config,
      pluginName,
    };

    try {
      const result = await step.run(inputValidation, context);

      // Validate output against step schema
      const outputValidation = step.outputs(result);
      if (outputValidation instanceof Error) {
        throw new Error(`Invalid output from step '${stepName}': ${outputValidation.message}`);
      }

      return outputValidation;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  introspect(): IntrospectionResultV2 {
    const plugins: PluginIntrospectionV2[] = [];

    for (const [name, plugin] of this.plugins) {
      const steps: StepIntrospectionV2[] = plugin.steps.map((step) => ({
        name: step.name,
        description: step.description,
        inputs: this.extractSchemaFields(step.inputs),
        outputs: this.extractSchemaFields(step.outputs),
        protocol: step.protocol,
      }));

      plugins.push({
        name,
        version: plugin.version,
        config: plugin.config,
        steps,
        schemas: plugin.schemas,
      });
    }

    return {
      plugins,
      baseSchemas: [...baseSchemas, sessionsSchema],
    };
  }

  async initialize(): Promise<void> {
    // Initialize all plugins
    const initPromises = Array.from(this.plugins.values())
      .filter((plugin) => plugin.initialize)
      .map((plugin) => plugin.initialize!());

    await Promise.all(initPromises);
  }

  private validatePluginConfig(plugin: AuthPluginV2): void {
    // Validate that required functions are provided based on config
    if (this.isVerificationEnabled(plugin.config)) {
      if (!this.hasSendCodeFunction(plugin.config)) {
        throw new ConfigurationErrorV2(
          `Plugin '${plugin.name}' requires sendCode function when verification is enabled`,
        );
      }
    }

    // Validate test users configuration
    if (plugin.config.testUsers) {
      const testUsers = plugin.config.testUsers;
      if (testUsers.enabled) {
        if (!testUsers.users || testUsers.users.length === 0) {
          throw new ConfigurationErrorV2(
            `Plugin '${plugin.name}' test users enabled but no users provided`,
          );
        }
        if (testUsers.environmentGating && !testUsers.allowedEnvironments) {
          throw new ConfigurationErrorV2(
            `Plugin '${plugin.name}' environment gating enabled but no allowed environments provided`,
          );
        }
      }
    }

    // Validate session TTL minimum
    if (plugin.config.sessionTtlSeconds && plugin.config.sessionTtlSeconds < 30) {
      throw new ConfigurationErrorV2(
        `Plugin '${plugin.name}' session TTL must be at least 30 seconds`,
      );
    }
  }

  private isVerificationEnabled(config: any): boolean {
    return config.verifyEmail || config.verifyPhone;
  }

  private hasSendCodeFunction(config: any): boolean {
    return typeof config.sendCode === 'function';
  }

  private extractSchemaFields(schema: any): string[] {
    // This is a simplified extraction - in reality would introspect arktype schema
    // For now, return common field names
    return ['email', 'phone', 'username', 'password', 'code', 'others'];
  }
}