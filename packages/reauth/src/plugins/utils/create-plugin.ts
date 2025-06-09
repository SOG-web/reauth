import { AuthPlugin, AuthStep } from '../../types';

export function createAuthPlugin(
  config: Record<string, any>,
  plugin: AuthPlugin,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<any>>;
  }[],
  initialConfig?: Record<string, any>,
): AuthPlugin {
  const basePlugin = plugin;

  // Start with base plugin steps
  let allSteps = [...basePlugin.steps];

  // Apply step overrides if provided
  if (overrideStep && overrideStep.length > 0) {
    overrideStep.forEach((stepOverride) => {
      const existingStepIndex = allSteps.findIndex(
        (s) => s.name === stepOverride.name,
      );
      if (existingStepIndex !== -1) {
        // Override the existing step, ensuring required properties are preserved
        allSteps[existingStepIndex] = {
          ...allSteps[existingStepIndex],
          ...stepOverride.override,
        } as AuthStep<any>;
      }
    });
  }

  // Apply root hooks if provided
  if (config.rootHooks) {
    basePlugin.rootHooks = config.rootHooks;
  }

  // remove root hooks from config
  delete config.rootHooks;

  const combinedPlugin: AuthPlugin = {
    ...basePlugin,
    config: {
      ...initialConfig,
      ...basePlugin.config,
      ...config.config,
    },
    steps: allSteps,
  };
  return combinedPlugin;
}

export function checkDependsOn(plugins: AuthPlugin[], dependsOn: string[]) {
  const names = plugins.map((p) => p.name);
  let notFound = true;
  let pluginName: string[] = [];
  for (let d = 0; d < dependsOn.length; d++) {
    const found = names.includes(dependsOn[d]!);
    if (!found) {
      notFound = false;
      pluginName.push(dependsOn[d]!);
    }
  }

  return {
    status: notFound,
    pluginName,
  };
}
