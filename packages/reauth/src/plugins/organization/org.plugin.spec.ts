import {
  AwilixContainer,
  createContainer,
  InjectionMode,
  asValue,
} from 'awilix';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReAuthCradle,
  AuthPlugin,
  Entity,
  EntityService,
  SessionService,
  AuthToken,
  StepNotFound,
  AuthStep,
} from '../../types';
import OrgAuth from './org.plugin';
import { ReAuthEngine } from '../../auth-engine';

describe('Organization Plugin', () => {
  let container: AwilixContainer<ReAuthCradle>;
  let organizationPlugin: AuthPlugin;
  let reAuth: ReAuthEngine;
  let mockPlugin: AuthPlugin;

  const createMockPlugin = (name: string): AuthPlugin => {
    const mockStep: AuthStep<any> = {
      name: 'admin',
      description: 'Test step for unit testing',
      inputs: ['testInput'],
      run: vi.fn().mockImplementation(async (input) => {
        return {
          success: true,
          message: 'Step executed successfully',
          data: input.testInput,
        };
      }),
      registerHook: vi.fn(),
      protocol: {
        http: undefined,
      },
    };

    return {
      name,
      steps: [mockStep],
      initialize: vi.fn(),
      config: {},
      runStep: vi
        .fn()
        .mockImplementation(async (stepName, input, container) => {
          if (stepName === 'test-step') {
            return {
              success: true,
              message: 'Step executed successfully',
              data: input.testInput,
            };
          }
          throw new StepNotFound(stepName, name);
        }),
    };
  };

  const entity: Entity = {
    id: 'id',
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
    email: '',
    email_verified: true,
    password_hash: '',
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
      .mockImplementation(async (id: string, field: string) => {}),
  };

  const sessionService: SessionService = {
    createSession: async function (
      entityId: string | number,
    ): Promise<AuthToken> {
      return 'token';
    },
    verifySession: async function (
      token: string,
    ): Promise<{ entity: Entity | null; token: AuthToken }> {
      return {
        entity,
        token: 'token',
      };
    },
    destroySession: async function (token: string): Promise<void> {},
    destroyAllSessions: async function (
      entityId: string | number,
    ): Promise<void> {},
  };

  beforeEach(() => {
    mockPlugin = createMockPlugin('admin');
    reAuth = new ReAuthEngine({
      plugins: [mockPlugin],
      entity: entityService,
      session: sessionService,
    });
    container = reAuth.getContainer();
    organizationPlugin = OrgAuth({});
    organizationPlugin.initialize(container);
  });

  it('should have the correct name', () => {
    expect(organizationPlugin.name).toBe('organization');
  });
});
