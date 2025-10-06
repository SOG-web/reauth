import {
  createContainer,
  InjectionMode,
  asValue,
  type AwilixContainer,
} from 'awilix';
import { InMemorySessionResolvers, ReAuthJWTPayload } from './services';
import { FumaSessionService } from './services/session-service';
import { SimpleCleanupScheduler } from './cleanup-scheduler';
import type {
  FumaClient,
  ReAuthCradle,
  SessionResolvers,
  SessionService,
  SubjectResolver,
  AuthPlugin,
  AuthHook,
  HooksType,
  OrmLike,
  AuthInput,
  AuthOutput,
  CleanupTask,
  CleanupScheduler,
  Token,
  PluginNames,
  PluginByName,
  StepsForPlugin,
  StepInput,
  StepOutput,
} from './types';

export type ReAuthConfig<P extends AuthPlugin[] = AuthPlugin[]> = {
  dbClient: FumaClient;
  plugins?: P;
  tokenFactory?: () => string;
  authHooks: Array<AuthHook<P>>;
  sessionHooks: Array<AuthHook<P>>;
  enableCleanupScheduler?: boolean; // Default true
  getUserData: (
    subjectId: string,
    orm: OrmLike,
  ) => Promise<Record<string, any>>;
  deviceValidator?: (
    storedDeviceInfo: Record<string, any>,
    currentDeviceInfo: Record<string, any>,
  ) => boolean | Promise<boolean>;
};

export class ReAuthEngine<P extends AuthPlugin[] = AuthPlugin[]> {
  private container: ReAuthCradle;
  private sessionResolvers: SessionResolvers;
  private sessionService: SessionService;
  private cleanupScheduler: CleanupScheduler;
  private plugins: P[number][] = [];
  private pluginMap = new Map<PluginNames<P>, P[number]>();
  private authHooks: Array<AuthHook<P>> = [];
  private sessionHooks: Array<AuthHook<P>> = [];
  private getUserData: (
    subjectId: string,
    orm: OrmLike,
  ) => Promise<Record<string, any>>;

  constructor(config: ReAuthConfig<P>) {
    this.container = createContainer({
      injectionMode: InjectionMode.CLASSIC,
      strict: true,
    });

    this.sessionResolvers = new InMemorySessionResolvers();
    this.sessionService = new FumaSessionService(
      config.dbClient,
      this.sessionResolvers,
      config.tokenFactory,
      config.getUserData,
      { deviceValidator: config.deviceValidator },
    );

    this.getUserData = config.getUserData;
    this.cleanupScheduler = new SimpleCleanupScheduler(() => this.getOrm());

    this.container.register({
      dbClient: asValue(config.dbClient),
      sessionResolvers: asValue(this.sessionResolvers),
      sessionService: asValue(this.sessionService),
      engine: asValue(this),
    });

    for (const plugin of config.plugins || []) this.registerPlugin(plugin);
    if (config.authHooks) this.authHooks.push(...config.authHooks);
    if (config.sessionHooks) this.sessionHooks.push(...config.sessionHooks);

    // Start cleanup scheduler by default unless explicitly disabled
    if (config.enableCleanupScheduler !== false) {
      this.startCleanupScheduler();
    }
  }

  private registerPlugin(plugin: P[number]) {
    this.plugins.push(plugin);
    this.pluginMap.set(plugin.name as PluginNames<P>, plugin);

    // Set plugin config in cleanup scheduler for task access
    if (plugin.config) {
      this.cleanupScheduler.setPluginConfig(plugin.name, plugin.config);
    }

    plugin.initialize?.(this, plugin.config);
  }

  getContainer(): ReAuthCradle {
    return this.container;
  }

  registerSessionResolver(subjectType: string, resolver: SubjectResolver) {
    this.sessionResolvers.register(subjectType, resolver);
    return this;
  }

  registerCleanupTask(task: CleanupTask) {
    this.cleanupScheduler.registerTask(task);
    return this;
  }

  enableEnhancedSessions() {
    this.sessionService.enableEnhancedFeatures();
    return this;
  }

  getSessionService(): SessionService {
    return this.sessionService;
  }

  async startCleanupScheduler(): Promise<void> {
    await this.cleanupScheduler.start();
  }

  async stopCleanupScheduler(): Promise<void> {
    await this.cleanupScheduler.stop();
  }

  getCleanupScheduler(): CleanupScheduler {
    return this.cleanupScheduler;
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
    deviceInfo?: Record<string, any>,
  ): Promise<Token> {
    await this.executeSessionHooks('before', {
      subjectType,
      subjectId,
      ttlSeconds,
      deviceInfo,
    });
    try {
      let token: Token;
      if (this.sessionService.createSessionWithMetadata) {
        token = await this.sessionService.createSessionWithMetadata(
          subjectType,
          subjectId,
          { ttlSeconds, deviceInfo },
        );
      } else {
        token = await this.sessionService.createSession(
          subjectType,
          subjectId,
          ttlSeconds,
        );
      }
      await this.executeSessionHooks('after', {
        token,
        subjectType,
        subjectId,
        ttlSeconds,
        deviceInfo,
      });
      return token;
    } catch (error) {
      await this.executeSessionHooks(
        'onError',
        { subjectType, subjectId, ttlSeconds, deviceInfo },
        error,
      );
      throw error;
    }
  }

  async checkSession(
    token: Token,
    deviceInfo?: Record<string, any>,
  ): Promise<{
    subject: any | null;
    token: Token | null;
    type?: 'jwt' | 'legacy';
    payload?: ReAuthJWTPayload;
    valid: boolean;
  }> {
    await this.executeSessionHooks('before', { token, deviceInfo });
    const ses = await this.sessionService.verifySession(token, deviceInfo);
    await this.executeSessionHooks('after', {
      subject: ses.subject,
      token: ses.token,
      type: ses.type,
      payload: ses.payload,
      deviceInfo,
    });
    return {
      ...ses,
      valid: Boolean(ses.subject && ses.token),
    };
  }

  getNames() {
    return Array.from(this.pluginMap.keys());
  }

  async executeStep<
    const PN extends PluginNames<P>,
    const SN extends StepsForPlugin<P, PN>,
  >(
    pluginName: PN, // one of the AuthPlugin names in plugin meta array
    stepName: SN,
    input: StepInput<P, PN, SN>,
  ): Promise<StepOutput<P, PN, SN>> {
    const plugin = this.pluginMap.get(pluginName);
    if (!plugin) throw new Error(`Plugin not found: ${pluginName}`);
    const step = (plugin.steps || []).find((s) => s.name === stepName);
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
      engine: this,
      config: plugin.config,
    };

    let currentInput = input as any;

    try {
      // Engine-level before hooks (root hooks)
      currentInput = await this.executeAuthHooks(
        'before',
        pluginName,
        stepName,
        currentInput,
      );

      // Plugin root-level before hook
      if (plugin.rootHooks?.before) {
        const maybeNewInput = await plugin.rootHooks.before(
          currentInput,
          ctx,
          step,
        );
        if (typeof maybeNewInput !== 'undefined') currentInput = maybeNewInput;
      }

      await step.hooks?.before?.(currentInput, ctx);
      const output = await step.run(currentInput, ctx);

      await step.hooks?.after?.(output, ctx);
      // Plugin root-level after hook
      let postRootOutput = output as any;
      if (plugin.rootHooks?.after) {
        const maybeNewOutput = await plugin.rootHooks.after(output, ctx, step);
        if (typeof maybeNewOutput !== 'undefined')
          postRootOutput = maybeNewOutput;
      }

      const finalOutput = await this.executeAuthHooks(
        'after',
        pluginName,
        stepName,
        postRootOutput,
      );

      // Optional output validation (Type.assert)
      if (step.outputs) {
        try {
          step.outputs.assert(finalOutput);
        } catch (e) {
          throw new Error(
            `Output validation failed for ${pluginName}.${stepName}: ${String(e)}`,
          );
        }
      }

      return finalOutput as StepOutput<P, PN, SN>;
    } catch (err) {
      await step.hooks?.onError?.(err, ctx);
      if (plugin.rootHooks?.onError) {
        await plugin.rootHooks.onError(err, currentInput, ctx, step);
      }
      await this.executeAuthHooks(
        'onError',
        pluginName,
        stepName,
        currentInput,
        err,
      );
      throw err;
    }
  }

  // ---------------- Engine-level Hooks APIs ----------------
  registerAuthHook(hook: AuthHook<P>): this {
    this.authHooks.push(hook);
    return this;
  }

  // Alias for compatibility
  registerHook(hook: AuthHook<P>): this {
    return this.registerAuthHook(hook);
  }

  registerSessionHook(hook: AuthHook<P>): this {
    this.sessionHooks.push(hook);
    return this;
  }

  async executeAuthHooks<
    const PN extends PluginNames<P>,
    const SN extends StepsForPlugin<P, PN>,
  >(
    type: HooksType,
    pluginName: PN,
    stepName: SN,
    data: StepInput<P, PN, SN> | StepOutput<P, PN, SN>,
    error?: unknown,
  ): Promise<StepInput<P, PN, SN> | StepOutput<P, PN, SN>> {
    let current: StepInput<P, PN, SN> | StepOutput<P, PN, SN> = data;
    for (const h of this.authHooks) {
      const matchesType = h.type === type;
      const matchesPlugin =
        h.universal || !h.pluginName || h.pluginName === pluginName;
      const matchesStep = h.universal || !h.steps || h.steps.includes(stepName);
      if (matchesType && matchesPlugin && matchesStep) {
        const res = await h.fn(
          current,
          this.container,
          error,
          pluginName,
          stepName,
        );
        if (typeof res !== 'undefined') current = res;
      }
    }
    return current;
  }

  async executeSessionHooks(
    type: HooksType,
    data: AuthInput | AuthOutput,
    error?: unknown,
  ): Promise<AuthInput | AuthOutput> {
    let current: AuthInput | AuthOutput = data;
    const hooks = this.sessionHooks.filter((h) => h.type === type);
    if (type === 'onError' && error) {
      for (const h of hooks) {
        const res = (await h.fn(current, this.container, error)) as
          | AuthInput
          | AuthOutput;
        if (typeof res !== 'undefined') current = res;
      }
      return current;
    }
    for (const h of hooks) {
      const res = (await h.fn(current, this.container)) as
        | AuthInput
        | AuthOutput;
      if (typeof res !== 'undefined') current = res;
    }
    return current;
  }

  // ---------------- Introspection & Utilities ----------------
  getStepInputs<const PN extends PluginNames<P>>(
    pluginName: PN,
    stepName: StepsForPlugin<P, PN>,
  ): ReadonlyArray<string> {
    const plugin = this.pluginMap.get(pluginName);
    const step = plugin?.steps?.find((s) => s.name === stepName);
    return step?.inputs ?? [];
  }

  getAllPlugins(): P[number][] {
    return [...this.plugins];
  }

  getPlugin<const PN extends PluginNames<P>>(
    name: PN,
  ): PluginByName<P, PN> | undefined {
    return this.pluginMap.get(name) as PluginByName<P, PN> | undefined;
  }

  // The DI container may store heterogeneous services; unknown is the safest accurate return type.
  getService<T = unknown>(name: string) {
    // Awilix resolve is string-keyed; casting the key is necessary.
    return this.container.resolve<T>(name as keyof ReAuthCradle);
  }

  // Convenience wrapper to mirror V1's executeStep signature
  async runStep<
    const PN extends PluginNames<P>,
    const SN extends StepsForPlugin<P, PN>,
  >(
    pluginName: PN,
    stepName: SN,
    input: StepInput<P, PN, SN>,
  ): Promise<StepOutput<P, PN, SN>> {
    return await this.executeStep(pluginName, stepName, input);
  }

  // Aggregate profile information across all plugins that implement getProfile
  async getUnifiedProfile(subjectId: string): Promise<{
    subjectId: string;
    plugins: Record<string, any>;
    generatedAt: string;
  }> {
    const orm = await this.getOrm();
    const results = await Promise.all(
      this.plugins.map(async (plugin) => {
        if (typeof (plugin as any).getProfile !== 'function')
          return [plugin.name, undefined] as const;
        try {
          const data = await (plugin as any).getProfile(subjectId, {
            orm,
            engine: this as any,
            container: this.container,
            config: plugin.config,
          });
          return [plugin.name, data] as const;
        } catch (err) {
          return [
            plugin.name,
            {
              error:
                err instanceof Error
                  ? err.message
                  : `Unknown error: ${String(err)}`,
            },
          ] as const;
        }
      }),
    );
    const pluginsData: Record<string, any> = {};
    for (const [name, data] of results) {
      if (typeof data !== 'undefined') pluginsData[name] = data;
    }
    return {
      subjectId,
      plugins: pluginsData,
      generatedAt: new Date().toISOString(),
    };
  }

  getIntrospectionData(): {
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
    try {
      return {
        plugins: this.plugins.map((p) => ({
          name: p.name,
          description: `${p.name} authentication plugin`,
          steps: (p.steps || []).map((s) => {
            return {
              name: s.name,
              description: s.description,
              inputs: s.validationSchema?.toJsonSchema() || {},
              outputs: s.outputs?.toJsonSchema() || {},
              protocol: s.protocol || {},
              requiresAuth: Boolean(s.protocol?.http?.auth || false),
            };
          }),
        })),
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    } catch (error) {
      console.error(error);
      return {
        plugins: [],
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    }
  }
}

export default function createReAuthEngine<
  P extends AuthPlugin[] = AuthPlugin[],
>(config: ReAuthConfig<P>) {
  return new ReAuthEngine<P>(config);
}
