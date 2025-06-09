import {
  AuthStep,
  AuthInput,
  AuthOutput,
  AuthInputError,
  StepNotFound,
} from '../../types';
import { validateInputWithValidationSchema } from '../../utils/standard-schema';
import {
  executeBeforeHooks,
  executeAfterHooks,
  executeErrorHooks,
} from './hook-utils';

export interface ExecuteStepOptions<T = any> {
  /** Name of the plugin for error messages */
  pluginName: string;
  /** Function to get the step by name */
  step: AuthStep<T> | undefined;
  /** Optional DI container */
  container?: any;

  config: T;
}

/**
 * Execute an auth step with validation and hooks
 * @param stepName Name of the step to execute
 * @param input Input data for the step
 * @param options Configuration options
 * @returns Promise that resolves with the step's output
 */
export async function executeStep(
  stepName: string,
  input: AuthInput,
  options: ExecuteStepOptions,
): Promise<AuthOutput> {
  const { pluginName, step, container } = options;

  if (!step) {
    throw new StepNotFound(stepName, pluginName);
  }

  // console.log('executeStep', stepName);
  // console.dir(input, { depth: null });

  try {
    // Validate input if schema is provided
    if (step.validationSchema) {
      const result = await validateInputWithValidationSchema(
        step.validationSchema,
        input,
      );

      if (!result.isValid) {
        throw new AuthInputError(
          'Input validation failed',
          pluginName,
          step.name,
          result.errors,
        );
      }
    }

    let inp = input;

    // Run before hooks in sequence
    inp = await executeBeforeHooks(step.hooks?.before, input, container);

    // Execute the step
    const result = await step.run(inp, {
      pluginName,
      container,
      config: options.config,
    });

    // Run after hooks in sequence
    const finalResult = await executeAfterHooks(
      step.hooks?.after,
      result,
      container,
    );

    return finalResult;
  } catch (error) {
    // Run error hooks in parallel
    await executeErrorHooks(
      step.hooks?.onError,
      error as Error,
      input,
      container,
    );
    throw error;
  }
}

export default executeStep;
