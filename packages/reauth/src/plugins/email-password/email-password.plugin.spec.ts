import { AwilixContainer } from 'awilix';
import EmailPasswordAuth from './email-password.plugin';
import {
  AuthInput,
  AuthInputError,
  AuthOutput,
  AuthPlugin,
  AuthStep,
  AuthToken,
  Entity,
  EntityService,
  ReAuthCradle,
  SessionService,
} from '../../types';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHookRegisterer,
  executeAfterHooks,
  executeBeforeHooks,
  executeErrorHooks,
  executeStep,
} from '../utils';
import { validateInputWithValidationSchema } from '../../utils';
import { ReAuthEngine } from '../../auth-engine';

function getStep(name: string, steps: AuthStep<any>[]) {
  return steps.find((s) => s.name === name);
}

async function runStep(
  step: any,
  container,
  input: AuthInput,
  pluginName: string,
  config: any,
): Promise<AuthOutput> {
  try {
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

    // console.log(inp);

    // console.log(step);

    // Execute the step
    const result = await step.run(inp, {
      pluginName,
      container,
      config: config,
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

describe('EmailPasswordAuth Plugin', () => {
  let container: AwilixContainer<ReAuthCradle>;
  let emailPasswordAuth: AuthPlugin;
  let reAuth: ReAuthEngine;

  const entity: Entity = {
    id: '744d263d-3610-409b-9549-661a99411e77',
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
    email: 'rah@rr.com',
    email_verified: true,
    password_hash:
      '$argon2id$v=19$m=19456,t=2,p=1$Xl9cCAA0lZeHxtsIlM5B2w$zkFrpmI02qupVul6ycSfVSzbdifOb6QsOAfNUk32JeM',
  };

  const entityService: EntityService = {
    findEntity: vi
      .fn()
      .mockImplementation(async (id: string, filed: string) => {
        return entity;
      }),
    createEntity: vi
      .fn()
      .mockImplementation(async (entity: Partial<Entity>) => {
        return entity;
      }),
    updateEntity: vi
      .fn()
      .mockImplementation(
        async (id: string, filed: string, entity: Partial<Entity>) => {
          return entity;
        },
      ),
    deleteEntity: vi
      .fn()
      .mockImplementation(async (id: string, filed: string) => {}),
  };

  const sessionService: SessionService = {
    createSession: async function (
      entityId: string | number,
    ): Promise<AuthToken> {
      return 'token----';
    },
    verifySession: async function (
      token: string,
    ): Promise<{ entity: Entity | null; token: AuthToken }> {
      return {
        entity,
        token,
      };
    },
    destroySession: async function (token: string): Promise<void> {},
    destroyAllSessions: async function (
      entityId: string | number,
    ): Promise<void> {},
  };

  beforeEach(() => {
    reAuth = new ReAuthEngine({
      plugins: [EmailPasswordAuth()],
      entity: entityService,
      session: sessionService,
    });
    // Create a fresh container for each test
    container = reAuth.getContainer();
    emailPasswordAuth = reAuth.getPlugin('email-password');
  });

  it('should have the correct name', () => {
    expect(emailPasswordAuth.name).toBe('email-password');
  });

  it('should initialize with a container', async () => {
    expect(emailPasswordAuth.container).toBe(container);
  });

  it('should have a login step', () => {
    const loginStep = getStep('login', emailPasswordAuth.steps);
    expect(loginStep).toBeDefined();
    expect(loginStep?.name).toBe('login');
    expect(loginStep?.description).toBe(
      'Authenticate user with email and password',
    );
    expect(loginStep?.inputs).toContain('email');
    expect(loginStep?.inputs).toContain('password');
  });

  it('should validate email and password inputs', async () => {
    const loginStep = getStep('login', emailPasswordAuth.steps);
    expect(loginStep?.validationSchema).toBeDefined();
    expect(loginStep?.validationSchema?.email).toBeDefined();
    expect(loginStep?.validationSchema?.password).toBeDefined();
  });

  it('should run the login step successfully with valid inputs', async () => {
    // Initialize the plugin

    // Valid input data
    const input: AuthInput = {
      email: 'rah@rr.com',
      password: 'dfklfdfghgkghkl',
      token: 'token',
      entity: { id: 'id' } as Entity,
    };

    const loginStep = getStep('login', emailPasswordAuth.steps);

    // Run the login step
    const result = await runStep(
      loginStep,
      container,
      input,
      'email-password',
      {},
    );

    // console.log(result);

    // Check the result
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Login successful');
  });

  it('should register and execute hooks', async () => {
    // Get the login step
    const loginStep = getStep('login', emailPasswordAuth.steps)!;
    expect(loginStep).toBeDefined();

    // Create a mock hook function
    const beforeHook = vi.fn().mockImplementation((input) => {
      return { ...input, additionalData: 'test' };
    });

    loginStep.hooks = {};

    const register = createHookRegisterer(loginStep.hooks);
    register('before', beforeHook);

    // Valid input data
    const input: AuthInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    // Run the login step
    await runStep(loginStep, container, input, 'email-password', {});

    // Check that the hook was called
    expect(beforeHook).toHaveBeenCalled();
    expect(beforeHook).toHaveBeenCalledWith(input, container, undefined);
  });
});
