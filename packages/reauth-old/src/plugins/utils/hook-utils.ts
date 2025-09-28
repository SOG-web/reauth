import { AwilixContainer } from 'awilix';
import {
  AuthInput,
  AuthOutput,
  ReAuthCradle,
  AuthStepHooks,
  HooksType,
} from '../../types';

type HookFunction = (
  data: AuthInput | AuthOutput,
  container: AwilixContainer<ReAuthCradle>,
  error?: Error,
) => Promise<AuthOutput | AuthInput | void>;

/**
 * Execute multiple before hooks in sequence, passing the result of each hook to the next
 */
export async function executeBeforeHooks(
  hooks: AuthStepHooks['before'],
  input: AuthInput,
  container: AwilixContainer<ReAuthCradle>,
): Promise<AuthInput> {
  if (!hooks || hooks.length === 0) {
    return input;
  }

  let currentInput = input;
  for (const hook of hooks) {
    currentInput = await hook(currentInput, container);
  }
  return currentInput;
}

/**
 * Execute multiple after hooks in sequence, passing the result of each hook to the next
 */
export async function executeAfterHooks(
  hooks: AuthStepHooks['after'],
  output: AuthOutput,
  container: AwilixContainer<ReAuthCradle>,
): Promise<AuthOutput> {
  if (!hooks || hooks.length === 0) {
    return output;
  }

  let currentOutput = output;
  for (const hook of hooks) {
    currentOutput = await hook(currentOutput, container);
  }
  return currentOutput;
}

/**
 * Execute multiple error hooks in parallel (they don't modify data, just handle errors)
 */
export async function executeErrorHooks(
  hooks: AuthStepHooks['onError'],
  error: Error,
  input: AuthInput,
  container: AwilixContainer<ReAuthCradle>,
): Promise<void> {
  if (!hooks || hooks.length === 0) {
    return;
  }

  // Execute error hooks in parallel since they don't return values
  await Promise.all(hooks.map((hook) => hook(error, input, container)));
}

export function createHookRegisterer(hooks: AuthStepHooks) {
  return function registerHook(type: HooksType, fn: HookFunction) {
    if (!hooks) {
      hooks = {};
    }

    if (type === 'before') {
      if (!hooks.before) {
        hooks.before = [];
      }
      hooks.before.push(async (input, container) => {
        const result = await fn(input, container, undefined);
        return (result as AuthInput) || input;
      });
    } else if (type === 'after') {
      if (!hooks.after) {
        hooks.after = [];
      }
      hooks.after.push(async (output, container) => {
        const result = (await fn(output, container, undefined)) as AuthOutput;
        return result || output;
      });
    } else if (type === 'onError') {
      if (!hooks.onError) {
        hooks.onError = [];
      }
      hooks.onError.push(async (error, input, container) => {
        await fn(input, container, error);
      });
    }
  };
}
