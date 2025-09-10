import type { AuthPluginV2, AuthStepV2, RootStepHooksV2, OrmLike } from '../types.v2';

export interface StepOverrideV2<Cfg = unknown, OrmT extends OrmLike = OrmLike> {
  name: string;
  override: Partial<AuthStepV2<unknown, unknown, Cfg, OrmT>>;
}

export interface PluginFactoryConfigV2<Cfg = unknown, OrmT extends OrmLike = OrmLike> {
  config?: Partial<Cfg>;
  stepOverrides?: StepOverrideV2<Cfg, OrmT>[];
  initialConfig?: Partial<Cfg>;
  rootHooks?: RootStepHooksV2<Cfg, OrmT>;
  validateConfig?: (config: Partial<Cfg>) => string[] | null;
  requiredDependencies?: string[]; // kept for parity, not used by V2 engine directly
}

/**
 * Create a new V2 plugin by composing a base plugin with overrides and extra config/hooks.
 */
export function createAuthPluginV2<Cfg = unknown, OrmT extends OrmLike = OrmLike>(
  basePlugin: AuthPluginV2<Cfg, OrmT>,
  factoryConfig: PluginFactoryConfigV2<Cfg, OrmT> = {},
): AuthPluginV2<Cfg, OrmT> {
  const {
    config = {},
    stepOverrides = [],
    initialConfig = {},
    rootHooks,
    validateConfig,
  } = factoryConfig;

  if (!basePlugin) throw new Error('basePlugin is required');
  if (!Array.isArray(basePlugin.steps)) throw new Error('basePlugin.steps must be an array');

  if (validateConfig) {
    const errs = validateConfig(config);
    if (errs && errs.length) {
      throw new Error(`V2 plugin config validation failed: ${errs.join(', ')}`);
    }
  }

  const steps = [...(basePlugin.steps || [])];

  for (const s of stepOverrides) {
    const idx = steps.findIndex((st) => st.name === s.name);
    if (idx !== -1) {
      steps[idx] = {
        ...steps[idx]!,
        ...s.override,
      } as AuthStepV2<unknown, unknown, Cfg, OrmT>;
    }
  }

  const plugin: AuthPluginV2<Cfg, OrmT> = {
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
export function createAuthPluginLegacyV2<Cfg = unknown, OrmT extends OrmLike = OrmLike>(
  config: Partial<Cfg>,
  plugin: AuthPluginV2<Cfg, OrmT>,
  overrideStep?: Array<{ name: string; override: Partial<AuthStepV2<unknown, unknown, Cfg, OrmT>> }>,
  initialConfig?: Partial<Cfg>,
): AuthPluginV2<Cfg, OrmT> {
  return createAuthPluginV2<Cfg, OrmT>(plugin, {
    config,
    stepOverrides: overrideStep,
    initialConfig,
    rootHooks: (config as any)?.rootHooks as RootStepHooksV2<Cfg, OrmT> | undefined,
  });
}
