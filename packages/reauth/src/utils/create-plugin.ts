import type { AuthPlugin, AuthStep, RootStepHooks, OrmLike } from '../types';

export interface StepOverride<Cfg> {
  name: string;
  override: Partial<AuthStep<Cfg>>;
}

export interface PluginFactoryConfig<Cfg> {
  config?: Partial<Cfg>;
  stepOverrides?: StepOverride<Cfg>[];
  initialConfig?: Partial<Cfg>;
  validateConfig?: (config: Partial<Cfg>) => string[] | null;
  requiredDependencies?: string[]; // kept for parity, not used by  engine directly
}

/**
 * Create a new  plugin by composing a base plugin with overrides and extra config/hooks.
 */
export function createAuthPlugin<Cfg>(
  basePlugin: AuthPlugin<Cfg>,
  factoryConfig: PluginFactoryConfig<Cfg> = {},
): AuthPlugin<Cfg> {
  const {
    config = {},
    stepOverrides = [],
    initialConfig = {},
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
      } as AuthStep<Cfg>;
    }
  }

  const plugin: AuthPlugin<Cfg> = {
    ...basePlugin,
    config: {
      ...initialConfig,
      ...basePlugin.config,
      ...(config as Cfg),
    },
    steps,
    rootHooks: basePlugin.rootHooks,
  };

  return plugin;
}

/**
 * Legacy-style helper for simple overrides compatible with V1-style signatures.
 */
// export function createAuthPluginLegacy<Cfg>(
//   config: Partial<Cfg>,
//   plugin: AuthPlugin<Cfg>,
//   overrideStep?: Array<{
//     name: string;
//     override: Partial<AuthStep<Cfg>>;
//   }>,
//   initialConfig?: Partial<Cfg>,
// ): AuthPlugin<Cfg> {
//   return createAuthPlugin<Cfg>(plugin, {
//     config,
//     stepOverrides: overrideStep,
//     initialConfig,
//   });
// }
