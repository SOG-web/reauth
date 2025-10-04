import type { AuthPlugin, AuthStep, RootStepHooks, OrmLike } from '../types';

export interface StepOverride<Cfg> {
  name: string;
  override: Partial<AuthStep<Cfg>>;
}

export interface PluginFactoryConfig<Cfg> {
  config?: Partial<Cfg>;
  stepOverrides?: StepOverride<Cfg>[];
  validateConfig?: (config: Partial<Cfg>) => string[] | null;
}

/**
 * Create a new  plugin by composing a base plugin with overrides and extra config/hooks.
 */
export function createAuthPlugin<Cfg, Name extends string = string>(
  basePlugin: AuthPlugin<Cfg, Name>,
  factoryConfig: PluginFactoryConfig<Cfg> = {},
) {
  const { config = {}, stepOverrides = [], validateConfig } = factoryConfig;

  if (!basePlugin) throw new Error('basePlugin is required');
  if (!Array.isArray(basePlugin.steps))
    throw new Error('basePlugin.steps must be an array');

  if (validateConfig) {
    const errs = validateConfig(config);
    if (errs && errs.length) {
      throw new Error(` plugin config validation failed: ${errs.join(', ')}`);
    }
  }

  // const steps = [...(basePlugin.steps || [])];

  // for (const s of stepOverrides) {
  //   const idx = steps.findIndex((st) => st.name === s.name);
  //   if (idx !== -1) {
  //     steps[idx] = {
  //       ...steps[idx]!,
  //       ...s.override,
  //     } as AuthStep<Cfg>;
  //   }
  // }

  const plugin = {
    ...basePlugin,
    config: {
      ...basePlugin.config,
      ...(config as Cfg),
    },
    rootHooks: basePlugin.rootHooks,
  };

  return plugin;
}

export function createAuthPlugin2<
  Cfg,
  Name extends string,
  BasePlugin extends AuthPlugin<Cfg, Name>,
>(basePlugin: BasePlugin, factoryConfig: PluginFactoryConfig<Cfg> = {}) {
  const { config = {}, stepOverrides = [], validateConfig } = factoryConfig;

  if (!basePlugin) throw new Error('basePlugin is required');
  if (!Array.isArray(basePlugin.steps))
    throw new Error('basePlugin.steps must be an array');

  if (validateConfig) {
    const errs = validateConfig(config);
    if (errs && errs.length) {
      throw new Error(`plugin config validation failed: ${errs.join(', ')}`);
    }
  }

  // If no step overrides, preserve the original steps array reference
  // let steps = basePlugin.steps;

  // if (stepOverrides && stepOverrides.length > 0) {
  //   // Only spread if we actually need to modify
  //   const newSteps = [...(basePlugin.steps || [])];
  //   for (const s of stepOverrides) {
  //     const idx = newSteps.findIndex((st) => st.name === s.name);
  //     if (idx !== -1) {
  //       newSteps[idx] = {
  //         ...newSteps[idx]!,
  //         ...s.override,
  //       };
  //     }
  //   }
  //   steps = newSteps as BasePlugin['steps'];
  // }

  return {
    ...basePlugin,
    config: {
      ...basePlugin.config,
      ...(config as Cfg),
    },
  };
}
