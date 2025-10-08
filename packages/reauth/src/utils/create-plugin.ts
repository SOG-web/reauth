import type { AuthPlugin, AuthStep, RootStepHooks, OrmLike } from '../types';

export interface StepOverride<Cfg> {
  name: string;
  override: Partial<AuthStep<Cfg>>;
}

export interface PluginFactoryConfig<Cfg> {
  config?: Partial<Cfg>;
  stepOverrides?: StepOverride<Cfg>[];
  validateConfig?: (config: Partial<Cfg>) => string[] | null;
  rootHooks?: RootStepHooks<Cfg>;
}

/**
 * Create a new  plugin by composing a base plugin with overrides and extra config/hooks.
 */
export function createAuthPlugin<
  Cfg,
  Name extends string,
  BasePlugin extends AuthPlugin<Cfg, Name> = AuthPlugin<Cfg, Name>,
>(
  basePlugin: BasePlugin,
  factoryConfig: PluginFactoryConfig<Cfg> = {},
): BasePlugin {
  const {
    config = {},
    stepOverrides = [],
    validateConfig,
    rootHooks,
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
      } as BasePlugin['steps'][number];
    }
  }

  const plugin = {
    ...basePlugin,
    config: {
      ...basePlugin.config,
      ...(config as Cfg),
    },
    steps,
    rootHooks: rootHooks || basePlugin.rootHooks,
  };

  return plugin as BasePlugin;
}

// Legacy alias for backward compatibility
export const createAuthPluginLegacy = createAuthPlugin;
