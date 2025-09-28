import type { AuthPlugin, AuthStep, RootStepHooks, OrmLike } from '../types.';

export interface StepOverride<Cfg = unknown, OrmT extends OrmLike = OrmLike> {
  name: string;
  override: Partial<AuthStep<unknown, unknown, Cfg, OrmT>>;
}

export interface PluginFactoryConfig<
  Cfg = unknown,
  OrmT extends OrmLike = OrmLike,
> {
  config?: Partial<Cfg>;
  stepOverrides?: StepOverride<Cfg, OrmT>[];
  initialConfig?: Partial<Cfg>;
  rootHooks?: RootStepHooks<Cfg, OrmT>;
  validateConfig?: (config: Partial<Cfg>) => string[] | null;
  requiredDependencies?: string[]; // kept for parity, not used by  engine directly
}

/**
 * Create a new  plugin by composing a base plugin with overrides and extra config/hooks.
 */
export function createAuthPlugin<Cfg = unknown, OrmT extends OrmLike = OrmLike>(
  basePlugin: AuthPlugin<Cfg, OrmT>,
  factoryConfig: PluginFactoryConfig<Cfg, OrmT> = {},
): AuthPlugin<Cfg, OrmT> {
  const {
    config = {},
    stepOverrides = [],
    initialConfig = {},
    rootHooks,
    validateConfig,
  } = factoryConfig;

  if (!basePlugin) throw new Error('basePlugin is required');
  if (!Array.isArray(basePlugin.steps))
    throw new Error('basePlugin.steps must be an array');

  if (validateConfig) {
    const errs = validateConfig(config);
    if (errs && errs.length) {
      throw new Error(` plugin config validation failed: ${errs.join(', ')}`);
    }
  }

  const steps = [...(basePlugin.steps || [])];

  for (const s of stepOverrides) {
    const idx = steps.findIndex((st) => st.name === s.name);
    if (idx !== -1) {
      steps[idx] = {
        ...steps[idx]!,
        ...s.override,
      } as AuthStep<unknown, unknown, Cfg, OrmT>;
    }
  }

  const plugin: AuthPlugin<Cfg, OrmT> = {
    ...basePlugin,
    config: {
      ...(initialConfig as Cfg),
      ...(basePlugin.config as Cfg),
      ...(config as Cfg),
    },
    steps,
    rootHooks: rootHooks ?? basePlugin.rootHooks,
  };

  return plugin;
}

/**
 * Legacy-style helper for simple overrides compatible with V1-style signatures.
 */
export function createAuthPluginLegacy<
  Cfg = unknown,
  OrmT extends OrmLike = OrmLike,
>(
  config: Partial<Cfg>,
  plugin: AuthPlugin<Cfg, OrmT>,
  overrideStep?: Array<{
    name: string;
    override: Partial<AuthStep<unknown, unknown, Cfg, OrmT>>;
  }>,
  initialConfig?: Partial<Cfg>,
): AuthPlugin<Cfg, OrmT> {
  return createAuthPlugin<Cfg, OrmT>(plugin, {
    config,
    stepOverrides: overrideStep,
    initialConfig,
    rootHooks: (config as any)?.rootHooks as
      | RootStepHooks<Cfg, OrmT>
      | undefined,
  });
}
