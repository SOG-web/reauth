import { executeStep } from './execute-step';
import { AuthInput, AuthOutput, AuthStep, StepNotFound } from '../../types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('executeStep', () => {
  // Mock step for testing
  const mockStep: AuthStep = {
    name: 'test-step',
    description: 'Test step for unit testing',
    inputs: ['testInput'],
    run: vi.fn().mockImplementation(async (input) => {
      return {
        success: true,
        message: 'Step executed successfully',
        status: 'success',
        data: input.testInput,
      };
    }),
    registerHook: vi.fn(),
    protocol: {
      http: {
        method: 'POST',
        auth: false,
      },
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should execute a step successfully', async () => {
    const input: AuthInput = { testInput: 'test-value' };

    const result = await executeStep('test-step', input, {
      pluginName: 'test-plugin',
      step: mockStep,
      config: {},
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Step executed successfully');
    expect(result.data).toBe('test-value');
    expect(mockStep.run).toHaveBeenCalledWith(input, {
      pluginName: 'test-plugin',
      container: undefined,
      config: {},
    });
  });

  it('should throw StepNotFound if step does not exist', async () => {
    const input: AuthInput = { testInput: 'test-value' };

    await expect(
      executeStep('non-existent-step', input, {
        pluginName: 'test-plugin',
        step: undefined,
        config: {},
      }),
    ).rejects.toThrow(StepNotFound);
  });

  it('should execute before hooks if provided', async () => {
    const input: AuthInput = { testInput: 'test-value' };

    const beforeHook = vi.fn().mockImplementation(async (input) => {
      return { ...input, modified: true };
    });

    // Create a step with hooks
    const stepWithHooks: AuthStep = {
      ...mockStep,
      hooks: {
        before: [beforeHook],
      },
    };

    await executeStep('test-step', input, {
      pluginName: 'test-plugin',
      step: stepWithHooks,
      config: {},
    });

    expect(beforeHook).toHaveBeenCalledWith(input, undefined);
    expect(stepWithHooks.run).toHaveBeenCalledWith(
      expect.objectContaining({ testInput: 'test-value', modified: true }),
      expect.anything(),
    );
  });

  it('should execute after hooks if provided', async () => {
    const input: AuthInput = { testInput: 'test-value' };
    const stepOutput: AuthOutput = {
      success: true,
      message: 'Step executed successfully',
      status: 'success',
    };

    // Mock the run function to return our predefined output
    const runFn = vi.fn().mockResolvedValue(stepOutput);

    const afterHook = vi.fn().mockImplementation(async (output) => {
      return { ...output, modified: true };
    });

    // Create a step with hooks
    const stepWithHooks: AuthStep = {
      ...mockStep,
      run: runFn,
      hooks: {
        after: [afterHook],
      },
    };

    const result = await executeStep('test-step', input, {
      pluginName: 'test-plugin',
      step: stepWithHooks,
      config: {},
    });

    expect(afterHook).toHaveBeenCalledWith(stepOutput, undefined);
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Step executed successfully',
        status: 'success',
        modified: true,
      }),
    );
  });

  it('should handle errors and execute onError hooks if provided', async () => {
    const input: AuthInput = { testInput: 'test-value' };
    const testError = new Error('Test error');

    const errorHook = vi.fn();

    // Create a step that throws an error
    const errorStep: AuthStep = {
      ...mockStep,
      run: vi.fn().mockRejectedValue(testError),
      hooks: {
        onError: [errorHook],
      },
    };

    await expect(
      executeStep('test-step', input, {
        pluginName: 'test-plugin',
        step: errorStep,
        config: {},
      }),
    ).rejects.toThrow('Test error');

    expect(errorHook).toHaveBeenCalledWith(testError, input, undefined);
  });

  it('should execute multiple before hooks in sequence', async () => {
    const input: AuthInput = { testInput: 'test-value' };

    const beforeHook1 = vi.fn().mockImplementation(async (input) => {
      return { ...input, hook1: true };
    });

    const beforeHook2 = vi.fn().mockImplementation(async (input) => {
      return { ...input, hook2: true };
    });

    // Create a step with multiple before hooks
    const stepWithHooks: AuthStep = {
      ...mockStep,
      hooks: {
        before: [beforeHook1, beforeHook2],
      },
    };

    await executeStep('test-step', input, {
      pluginName: 'test-plugin',
      step: stepWithHooks,
      config: {},
    });

    // Verify hooks were called in sequence
    expect(beforeHook1).toHaveBeenCalledWith(input, undefined);
    expect(beforeHook2).toHaveBeenCalledWith(
      expect.objectContaining({ testInput: 'test-value', hook1: true }),
      undefined,
    );

    // Verify the step received the final modified input
    expect(stepWithHooks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        testInput: 'test-value',
        hook1: true,
        hook2: true,
      }),
      expect.anything(),
    );
  });

  it('should execute multiple after hooks in sequence', async () => {
    const input: AuthInput = { testInput: 'test-value' };
    const stepOutput: AuthOutput = {
      success: true,
      message: 'Step executed successfully',
      status: 'success',
    };

    // Mock the run function to return our predefined output
    const runFn = vi.fn().mockResolvedValue(stepOutput);

    const afterHook1 = vi.fn().mockImplementation(async (output) => {
      return { ...output, hook1: true };
    });

    const afterHook2 = vi.fn().mockImplementation(async (output) => {
      return { ...output, hook2: true };
    });

    // Create a step with multiple after hooks
    const stepWithHooks: AuthStep = {
      ...mockStep,
      run: runFn,
      hooks: {
        after: [afterHook1, afterHook2],
      },
    };

    const result = await executeStep('test-step', input, {
      pluginName: 'test-plugin',
      step: stepWithHooks,
      config: {},
    });

    // Verify hooks were called in sequence
    expect(afterHook1).toHaveBeenCalledWith(stepOutput, undefined);
    expect(afterHook2).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Step executed successfully',
        status: 'success',
        hook1: true,
      }),
      undefined,
    );

    // Verify the final result includes modifications from both hooks
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Step executed successfully',
        status: 'success',
        hook1: true,
        hook2: true,
      }),
    );
  });

  it('should execute multiple error hooks in parallel', async () => {
    const input: AuthInput = { testInput: 'test-value' };
    const testError = new Error('Test error');

    const errorHook1 = vi.fn();
    const errorHook2 = vi.fn();

    // Create a step that throws an error
    const errorStep: AuthStep = {
      ...mockStep,
      run: vi.fn().mockRejectedValue(testError),
      hooks: {
        onError: [errorHook1, errorHook2],
      },
    };

    await expect(
      executeStep('test-step', input, {
        pluginName: 'test-plugin',
        step: errorStep,
        config: {},
      }),
    ).rejects.toThrow('Test error');

    // Verify both error hooks were called
    expect(errorHook1).toHaveBeenCalledWith(testError, input, undefined);
    expect(errorHook2).toHaveBeenCalledWith(testError, input, undefined);
  });
});
