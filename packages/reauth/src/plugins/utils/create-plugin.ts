import type { AwilixContainer } from 'awilix';
import type { AuthPlugin, AuthStep, ReAuthCradle } from '../../types';
import {
  PluginConfigurationError,
  PluginDependencyError,
} from '../../utils/plugin-errors';

/**
 * Step override configuration
 */
export interface StepOverride<T> {
  name: string;
  override: Partial<AuthStep<T>>;
}

/**
 * Plugin factory configuration
 */
export interface PluginFactoryConfig<T> {
  /** Plugin configuration */
  config?: Partial<T>;
  /** Step overrides */
  stepOverrides?: StepOverride<T>[];
  /** Initial configuration */
  initialConfig?: Record<string, any>;
  /** Root hooks */
  rootHooks?: any;
  /** Validation function for configuration */
  validateConfig?: (config: Partial<T>) => string[] | null;
  /** Dependencies that must be available */
  requiredDependencies?: string[];
}

/**
 * Enhanced plugin factory function
 */
export function createAuthPlugin<T>(
  basePlugin: AuthPlugin<T>,
  factoryConfig: PluginFactoryConfig<T> = {},
): AuthPlugin<T> {
  const {
    config = {},
    stepOverrides = [],
    initialConfig = {},
    rootHooks,
    validateConfig,
    requiredDependencies = [],
  } = factoryConfig;

  // Validate configuration if validator provided
  if (validateConfig) {
    const validationErrors = validateConfig(config);
    if (validationErrors && validationErrors.length > 0) {
      throw new PluginConfigurationError(
        basePlugin.name,
        `Configuration validation failed: ${validationErrors.join(', ')}`,
        undefined,
        undefined,
        config,
      );
    }
  }

  // Start with base plugin steps
  const allSteps = [...basePlugin.steps];

  // Apply step overrides if provided
  stepOverrides.forEach((stepOverride) => {
    const existingStepIndex = allSteps.findIndex(
      (s) => s.name === stepOverride.name,
    );
    if (existingStepIndex !== -1) {
      // Override the existing step, ensuring required properties are preserved
      allSteps[existingStepIndex] = {
        ...allSteps[existingStepIndex],
        ...stepOverride.override,
      } as AuthStep<T>;
    }
  });

  // Create the combined plugin
  const combinedPlugin: AuthPlugin<T> = {
    ...basePlugin,
    config: {
      ...initialConfig,
      ...basePlugin.config,
      ...config,
    },
    steps: allSteps,
    dependsOn: [...(basePlugin.dependsOn || []), ...requiredDependencies],
    rootHooks: rootHooks || basePlugin.rootHooks,
  };

  return combinedPlugin;
}

/**
 * Legacy function for backward compatibility
 */
export function createAuthPluginLegacy(
  config: Record<string, any>,
  plugin: AuthPlugin,
  overrideStep?: {
    name: string;
    override: Partial<AuthStep<any>>;
  }[],
  initialConfig?: Record<string, any>,
): AuthPlugin {
  return createAuthPlugin(plugin, {
    config,
    stepOverrides: overrideStep,
    initialConfig,
    rootHooks: config.rootHooks,
  });
}

/**
 * Enhanced dependency checking with better error handling
 */
export function checkDependsOn(plugins: AuthPlugin[], dependsOn: string[]) {
  const names = plugins.map((p) => p.name);
  const missingDependencies: string[] = [];

  for (const dependency of dependsOn) {
    if (!names.includes(dependency)) {
      missingDependencies.push(dependency);
    }
  }

  return {
    status: missingDependencies.length === 0,
    pluginName: missingDependencies,
  };
}

/**
 * Validate plugin dependencies and throw appropriate errors
 */
export function validatePluginDependencies(
  plugin: AuthPlugin,
  availablePlugins: AuthPlugin[],
): void {
  if (!plugin.dependsOn || plugin.dependsOn.length === 0) {
    return;
  }

  const dependencyCheck = checkDependsOn(availablePlugins, plugin.dependsOn);
  if (!dependencyCheck.status) {
    throw new PluginDependencyError(plugin.name, dependencyCheck.pluginName);
  }
}

/**
 * Initialize plugin with proper error handling and dependency validation
 */
export async function initializePluginSafely(
  plugin: AuthPlugin,
  container: AwilixContainer<ReAuthCradle>,
  availablePlugins: AuthPlugin[] = [],
): Promise<void> {
  try {
    // Validate dependencies first
    validatePluginDependencies(plugin, availablePlugins);

    // Set container reference
    plugin.container = container;

    // Initialize the plugin
    await plugin.initialize(container);
  } catch (error) {
    if (error instanceof PluginDependencyError) {
      throw error;
    }

    // Wrap other errors in initialization error
    throw new PluginConfigurationError(
      plugin.name,
      `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      undefined,
      { originalError: error },
    );
  }
}

/**
 * Create a plugin with validation and safe initialization
 */
export async function createAndInitializePlugin<T>(
  basePlugin: AuthPlugin<T>,
  factoryConfig: PluginFactoryConfig<T>,
  container: AwilixContainer<ReAuthCradle>,
  availablePlugins: AuthPlugin[] = [],
): Promise<AuthPlugin<T>> {
  // Create the plugin
  const plugin = createAuthPlugin(basePlugin, factoryConfig);

  // Initialize it safely
  await initializePluginSafely(plugin, container, availablePlugins);

  return plugin;
}

/**
 * Utility to create multiple plugins with dependency resolution
 */
export async function createPluginCollection(
  pluginConfigs: Array<{
    plugin: AuthPlugin;
    config: PluginFactoryConfig<any>;
  }>,
  container: AwilixContainer<ReAuthCradle>,
): Promise<AuthPlugin[]> {
  const createdPlugins: AuthPlugin[] = [];
  const pendingPlugins = [...pluginConfigs];

  // Keep trying to initialize plugins until all are done or we can't make progress
  while (pendingPlugins.length > 0) {
    const initialLength = pendingPlugins.length;

    for (let i = pendingPlugins.length - 1; i >= 0; i--) {
      const { plugin: basePlugin, config } = pendingPlugins[i]!;

      try {
        const plugin = await createAndInitializePlugin(
          basePlugin,
          config,
          container,
          createdPlugins,
        );
        createdPlugins.push(plugin);
        pendingPlugins.splice(i, 1);
      } catch (error) {
        if (error instanceof PluginDependencyError) {
          // Skip for now, might be resolved in next iteration
          continue;
        }
        // Other errors are fatal
        throw error;
      }
    }

    // If we didn't make progress, we have circular dependencies or missing plugins
    if (pendingPlugins.length === initialLength) {
      const pendingNames = pendingPlugins.map((p) => p.plugin.name);
      throw new PluginDependencyError('PluginCollection', pendingNames, {
        reason: 'Circular dependencies or missing plugins detected',
      });
    }
  }

  return createdPlugins;
}
