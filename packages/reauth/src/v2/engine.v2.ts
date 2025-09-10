import {
  createContainer,
  InjectionMode,
  asValue,
  type AwilixContainer,
} from 'awilix';
import { InMemorySessionResolvers } from './session-resolvers.v2';
import { FumaSessionServiceV2 } from './session-service.v2';
import type {
  FumaClient,
  ReAuthCradleV2,
  ReAuthCradleV2Extension,
  SessionResolvers,
  SessionServiceV2,
  SubjectResolver,
  AuthPluginV2,
  AuthStepV2,
  AuthHookV2,
  HooksTypeV2,
  OrmLike,
  AuthInput,
  AuthOutput,
} from './types.v2';

export class ReAuthEngineV2 {
  private container: AwilixContainer<ReAuthCradleV2Extension>;
  private sessionResolvers: SessionResolvers;
  private sessionService: SessionServiceV2;
  private plugins: AuthPluginV2[] = [];
  private pluginMap = new Map<string, AuthPluginV2>();
  private authHooks: AuthHookV2[] = [];
  private sessionHooks: AuthHookV2[] = [];

  constructor(config: {
    dbClient: FumaClient;
    plugins?: AuthPluginV2[];
    tokenFactory?: () => string;
    authHooks?: AuthHookV2[];
    sessionHooks?: AuthHookV2[];
  }) {
    this.container = createContainer({
      injectionMode: InjectionMode.CLASSIC,
      strict: true,
    });

    this.sessionResolvers = new InMemorySessionResolvers();
    this.sessionService = new FumaSessionServiceV2(
      config.dbClient,
      this.sessionResolvers,
      config.tokenFactory,
    );

    this.container.register({
      dbClient: asValue(config.dbClient),
      sessionResolvers: asValue(this.sessionResolvers),
      sessionServiceV2: asValue(this.sessionService),
    });

    for (const plugin of config.plugins || []) this.registerPlugin(plugin);
    if (config.authHooks) this.authHooks.push(...config.authHooks);
    if (config.sessionHooks) this.sessionHooks.push(...config.sessionHooks);
  }

  private registerPlugin(plugin: AuthPluginV2) {
    this.plugins.push(plugin);
    this.pluginMap.set(plugin.name, plugin);
    plugin.initialize?.(this);
  }

  getContainer(): AwilixContainer<ReAuthCradleV2Extension> {
    return this.container;
  }

  registerSessionResolver(subjectType: string, resolver: SubjectResolver) {
    this.sessionResolvers.register(subjectType, resolver);
    return this;
  }

  // Provide ORM instance for plugin steps
  async getOrm(): Promise<OrmLike> {
    const version = await this.container.cradle.dbClient.version();
    return this.container.cradle.dbClient.orm(version);
  }

  async createSessionFor(
    subjectType: string,
    subjectId: string,
    ttlSeconds?: number,
  ): Promise<string> {
    await this.executeSessionHooks('before', {
      subjectType,
      subjectId,
      ttlSeconds,
    });
    try {
      const token = await this.sessionService.createSession(
        subjectType,
        subjectId,
        ttlSeconds,
      );
      await this.executeSessionHooks('after', {
        token,
        subjectType,
        subjectId,
        ttlSeconds,
      });
      return token;
    } catch (error) {
      await this.executeSessionHooks(
        'onError',
        { subjectType, subjectId, ttlSeconds },
        error,
      );
      throw error;
    }
  }

  async checkSession(token: string): Promise<{
    subject: any | null;
    token: string | null;
    valid: boolean;
  }> {
    await this.executeSessionHooks('before', { token });
    const { subject, token: verified } =
      await this.sessionService.verifySession(token);
    await this.executeSessionHooks('after', { subject, token: verified });
    return {
      subject,
      token: verified,
      valid: Boolean(subject && verified),
    };
  }

  // ---------------- Step Runner (V2) ----------------
  // V1-compatible signature
  async executeStep(
    pluginName: string,
    stepName: string,
    input: AuthInput,
  ): Promise<AuthOutput>;
  // Generic signature
  async executeStep<I = unknown, O = unknown>(
    pluginName: string,
    stepName: string,
    input: I,
  ): Promise<O> {
    const plugin = this.pluginMap.get(pluginName);
    if (!plugin) throw new Error(`Plugin not found: ${pluginName}`);
    const step = (plugin.steps || []).find((s) => s.name === stepName) as
      | AuthStepV2<I, O, unknown>
      | undefined;
    if (!step) throw new Error(`Step not found: ${pluginName}.${stepName}`);

    // Validate input if arktype schema provided (Type.assert)
    if (step.validationSchema) {
      try {
        step.validationSchema.assert(input as unknown);
      } catch (e) {
        throw new Error(
          `Validation failed for ${pluginName}.${stepName}: ${String(e)}`,
        );
      }
    }

    const ctx = {
      container: this.container,
      engine: {
        getOrm: () => this.getOrm(),
        createSessionFor: (
          subjectType: string,
          subjectId: string,
          ttlSeconds?: number,
        ) => this.createSessionFor(subjectType, subjectId, ttlSeconds),
        checkSession: (token: string) => this.checkSession(token),
      },
      config: plugin.config as unknown,
    };

    try {
      // Engine-level before hooks (root hooks)
      input = (await this.executeAuthHooks(
        'before',
        pluginName,
        stepName,
        input as unknown as AuthInput,
      )) as unknown as I;

      // Plugin root-level before hook
      if (plugin.rootHooks?.before) {
        const maybeNewInput = await plugin.rootHooks.before(
          input,
          ctx as any,
          step as any,
        );
        if (typeof maybeNewInput !== 'undefined') input = maybeNewInput as I;
      }

      await step.hooks?.before?.(input, ctx);
      const output = await step.run(input, ctx);

      await step.hooks?.after?.(output, ctx);
      // Plugin root-level after hook
      let postRootOutput: O = output as O;
      if (plugin.rootHooks?.after) {
        const maybeNewOutput = await plugin.rootHooks.after(
          output,
          ctx as any,
          step as any,
        );
        if (typeof maybeNewOutput !== 'undefined')
          postRootOutput = maybeNewOutput as O;
      }

      const finalOutput = (await this.executeAuthHooks(
        'after',
        pluginName,
        stepName,
        postRootOutput as unknown as AuthOutput,
      )) as unknown as O;

      // Optional output validation (Type.assert)
      if (step.outputs) {
        try {
          step.outputs.assert(finalOutput as unknown);
        } catch (e) {
          throw new Error(
            `Output validation failed for ${pluginName}.${stepName}: ${String(e)}`,
          );
        }
      }

      return finalOutput;
    } catch (err) {
      await step.hooks?.onError?.(err, ctx);
      if (plugin.rootHooks?.onError) {
        await plugin.rootHooks.onError(err, input, ctx as any, step as any);
      }
      await this.executeAuthHooks(
        'onError',
        pluginName,
        stepName,
        input as unknown as AuthInput,
        err,
      );
      throw err;
    }
  }

  // ---------------- Engine-level Hooks APIs ----------------
  registerAuthHook(hook: AuthHookV2): this {
    this.authHooks.push(hook);
    return this;
  }

  // Alias for compatibility
  registerHook(hook: AuthHookV2): this {
    return this.registerAuthHook(hook);
  }

  registerSessionHookV2(hook: AuthHookV2): this {
    this.sessionHooks.push(hook);
    return this;
  }

  async executeAuthHooks(
    type: HooksTypeV2,
    pluginName: string,
    stepName: string,
    data: AuthInput | AuthOutput,
    error?: unknown,
  ): Promise<AuthInput | AuthOutput> {
    let current: AuthInput | AuthOutput = data;
    for (const h of this.authHooks) {
      const matchesType = h.type === type;
      const matchesPlugin =
        h.universal || !h.pluginName || h.pluginName === pluginName;
      const matchesStep = h.universal || !h.steps || h.steps.includes(stepName);
      if (matchesType && matchesPlugin && matchesStep) {
        const res = await h.fn(current, this.container, error);
        if (typeof res !== 'undefined') current = res;
      }
    }
    return current;
  }

  async executeSessionHooks(
    type: HooksTypeV2,
    data: AuthInput | AuthOutput,
    error?: unknown,
  ): Promise<AuthInput | AuthOutput> {
    let current: AuthInput | AuthOutput = data;
    const hooks = this.sessionHooks.filter((h) => h.type === type);
    if (type === 'onError' && error) {
      await Promise.all(hooks.map((h) => h.fn(current, this.container, error)));
      return current;
    }
    for (const h of hooks) {
      const res = await h.fn(current, this.container);
      if (typeof res !== 'undefined') current = res;
    }
    return current;
  }

  // Legacy-style helper to register session hooks with a simpler signature
  registerSessionHook(
    type: HooksTypeV2,
    fn: (
      data: AuthInput | AuthOutput,
      container: AwilixContainer<ReAuthCradleV2Extension>,
      error?: unknown,
    ) => Promise<AuthInput | AuthOutput | void> | AuthInput | AuthOutput | void,
    universal?: boolean,
  ): this {
    this.registerSessionHookV2({
      type,
      fn,
      session: true,
      universal: Boolean(universal),
    });
    return this;
  }

  // ---------------- Introspection & Utilities ----------------
  getStepInputs(pluginName: string, stepName: string): string[] {
    const plugin = this.pluginMap.get(pluginName);
    const step = plugin?.steps?.find((s) => s.name === stepName);
    return step?.inputs ?? [];
  }

  getAllPlugins(): AuthPluginV2[] {
    return [...this.plugins];
  }

  getPlugin(name: string): AuthPluginV2 | undefined {
    return this.pluginMap.get(name);
  }

  // The DI container may store heterogeneous services; unknown is the safest accurate return type.
  getService<T = unknown>(name: string): T {
    // Awilix resolve is string-keyed; casting the key is necessary.
    return this.container.resolve(name as unknown as never) as T;
  }

  // Convenience wrapper to mirror V1's executeStep signature
  async runStep(
    pluginName: string,
    stepName: string,
    input: AuthInput,
  ): Promise<AuthOutput> {
    return (await this.executeStep(pluginName, stepName, input)) as AuthOutput;
  }

  getIntrospectionData(): {
    entity: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
    plugins: Array<{
      name: string;
      description: string;
      steps: Array<{
        name: string;
        description?: string;
        inputs: unknown;
        outputs: unknown;
        protocol: unknown;
        requiresAuth: boolean;
      }>;
    }>;
    generatedAt: string;
    version: string;
  } {
    return {
      entity: {
        type: 'object',
        properties: {},
        required: [],
      },
      plugins: this.plugins.map((p) => ({
        name: p.name,
        description: `${p.name} authentication plugin`,
        steps: (p.steps || []).map((s) => ({
          name: s.name,
          description: s.description,
          inputs: s.validationSchema?.toJsonSchema() || {},
          outputs: s.outputs?.toJsonSchema() || {},
          protocol: s.protocol || {},
          requiresAuth: Boolean(s.protocol?.http?.auth || false),
        })),
      })),
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
