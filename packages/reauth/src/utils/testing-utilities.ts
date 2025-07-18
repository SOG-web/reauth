import type { AwilixContainer } from 'awilix';
import { createContainer, asValue, asFunction } from 'awilix';
import type {
  AuthPlugin,
  AuthStep,
  AuthInput,
  AuthOutput,
  Entity,
  Session,
  EntityService,
  SessionService,
  ReAuthCradle,
  AuthToken,
} from '../types';
import type { SecurityService } from './security-service';
import { BaseSecurityService } from './security-service';

/**
 * Mock entity for testing
 */
export interface MockEntity extends Entity {
  email: string;
  username?: string;
  phone?: string;
  [key: string]: any;
}

/**
 * Mock session for testing
 */
export interface MockSession extends Session {
  [key: string]: any;
}

/**
 * Test configuration for plugins
 */
export interface TestPluginConfig {
  enableRateLimiting?: boolean;
  enableSecurity?: boolean;
  mockExternalServices?: boolean;
  testData?: Record<string, any>;
}

/**
 * Mock EntityService for testing
 */
export class MockEntityService implements EntityService {
  private entities = new Map<string, MockEntity>();
  private idCounter = 1;

  constructor(initialEntities: MockEntity[] = []) {
    initialEntities.forEach((entity) => {
      this.entities.set(entity.id, entity);
    });
  }

  async findEntity(id: string, field = 'id'): Promise<Entity | null> {
    if (field === 'id') {
      return this.entities.get(id) || null;
    }

    // Search by other fields
    for (const entity of this.entities.values()) {
      if ((entity as any)[field] === id) {
        return entity;
      }
    }
    return null;
  }

  async createEntity(entityData: Partial<Entity>): Promise<Entity> {
    const entity: MockEntity = {
      id: entityData.id || `test-entity-${this.idCounter++}`,
      role: entityData.role || 'user',
      created_at: new Date(),
      updated_at: new Date(),
      ...entityData,
    };

    this.entities.set(entity.id, entity);
    return entity;
  }

  async updateEntity(
    id: string,
    field: string,
    entityData: Partial<Entity>,
  ): Promise<Entity> {
    const existing = await this.findEntity(id, field);
    if (!existing) {
      throw new Error(`Entity not found: ${id}`);
    }

    const updated: MockEntity = {
      ...existing,
      ...entityData,
      updated_at: new Date(),
    };

    this.entities.set(existing.id, updated);
    return updated;
  }

  async deleteEntity(id: string, field: string): Promise<void> {
    const existing = await this.findEntity(id, field);
    if (existing) {
      this.entities.delete(existing.id);
    }
  }

  // Test utilities
  getAllEntities(): MockEntity[] {
    return Array.from(this.entities.values());
  }

  clearEntities(): void {
    this.entities.clear();
  }

  setEntities(entities: MockEntity[]): void {
    this.entities.clear();
    entities.forEach((entity) => {
      this.entities.set(entity.id, entity);
    });
  }
}

/**
 * Mock SessionService for testing
 */
export class MockSessionService implements SessionService {
  private sessions = new Map<string, MockSession>();
  private tokenCounter = 1;

  constructor(initialSessions: MockSession[] = []) {
    initialSessions.forEach((session) => {
      this.sessions.set(session.token, session);
    });
  }

  async createSession(entityId: string | number): Promise<AuthToken> {
    const token = `test-token-${this.tokenCounter++}`;
    const session: MockSession = {
      id: `session-${this.tokenCounter}`,
      entity_id: entityId.toString(),
      token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.sessions.set(token, session);
    return token;
  }

  async verifySession(
    token: string,
  ): Promise<{ entity: Entity | null; token: AuthToken }> {
    const session = this.sessions.get(token);
    if (!session || session.expires_at < new Date()) {
      return { entity: null, token: null };
    }

    // In a real implementation, you'd fetch the entity
    // For testing, we'll create a mock entity
    const entity: MockEntity = {
      id: session.entity_id,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    };

    return { entity, token };
  }

  async destroySession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async destroyAllSessions(entityId: string | number): Promise<void> {
    const entityIdStr = entityId.toString();
    for (const [token, session] of this.sessions.entries()) {
      if (session.entity_id === entityIdStr) {
        this.sessions.delete(token);
      }
    }
  }

  // Test utilities
  getAllSessions(): MockSession[] {
    return Array.from(this.sessions.values());
  }

  clearSessions(): void {
    this.sessions.clear();
  }

  setSessions(sessions: MockSession[]): void {
    this.sessions.clear();
    sessions.forEach((session) => {
      this.sessions.set(session.token, session);
    });
  }
}

/**
 * Mock SecurityService for testing
 */
export class MockSecurityService extends BaseSecurityService {
  private loggedEvents: any[] = [];

  async logSecurityEvent(event: any): Promise<void> {
    this.loggedEvents.push(event);
    // Don't log to console in tests
  }

  // Test utilities
  getLoggedEvents(): any[] {
    return [...this.loggedEvents];
  }

  clearLoggedEvents(): void {
    this.loggedEvents = [];
  }
}

/**
 * Create a test container with mock services
 */
export function createTestContainer(
  config: TestPluginConfig = {},
): AwilixContainer<ReAuthCradle> {
  const container = createContainer<ReAuthCradle>();

  // Register mock services
  container.register({
    entityService: asValue(new MockEntityService()),
    sessionService: asValue(new MockSessionService()),
    securityService: asValue(new MockSecurityService()),
    sensitiveFields: asValue({}),
    serializeEntity: asValue(<T extends Entity>(entity: T) => entity),
  });

  return container;
}

/**
 * Create test input for plugin steps
 */
export function createTestInput(overrides: Partial<AuthInput> = {}): AuthInput {
  return {
    entity: undefined,
    token: null,
    ...overrides,
  };
}

/**
 * Create test output for plugin steps
 */
export function createTestOutput(
  overrides: Partial<AuthOutput> = {},
): AuthOutput {
  return {
    success: true,
    message: 'Test successful',
    status: 'success',
    ...overrides,
  };
}

/**
 * Create a mock entity for testing
 */
export function createMockEntity(
  overrides: Partial<MockEntity> = {},
): MockEntity {
  return {
    id: `test-entity-${Date.now()}`,
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock session for testing
 */
export function createMockSession(
  overrides: Partial<MockSession> = {},
): MockSession {
  return {
    id: `test-session-${Date.now()}`,
    entity_id: 'test-entity-1',
    token: `test-token-${Date.now()}`,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock auth step for testing
 */
export function createMockStep<T>(
  name: string,
  runFn?: (input: AuthInput) => Promise<AuthOutput>,
  overrides: Partial<AuthStep<T>> = {},
): AuthStep<T> {
  return {
    name,
    description: `Test step: ${name}`,
    inputs: ['entity'],
    protocol: {
      http: {
        method: 'POST',
        auth: false,
      },
    },
    run: runFn || (async (input: AuthInput) => createTestOutput()),
    ...overrides,
  };
}

/**
 * Create a mock plugin for testing
 */
export function createMockPlugin<T>(
  name: string,
  steps: AuthStep<T>[] = [],
  config: Partial<T> = {},
  overrides: Partial<AuthPlugin<T>> = {},
): AuthPlugin<T> {
  return {
    name,
    steps: steps.length > 0 ? steps : [createMockStep(`${name}-step`)],
    config,
    initialize: async () => {},
    ...overrides,
  };
}

/**
 * Test helper to run a plugin step
 */
export async function runPluginStep<T>(
  plugin: AuthPlugin<T>,
  stepName: string,
  input: AuthInput,
  container?: AwilixContainer<ReAuthCradle>,
): Promise<AuthOutput> {
  const step = plugin.steps.find((s) => s.name === stepName);
  if (!step) {
    throw new Error(`Step ${stepName} not found in plugin ${plugin.name}`);
  }

  const testContainer = container || createTestContainer();
  const pluginProperties = {
    pluginName: plugin.name,
    container: testContainer,
    config: plugin.config,
  };

  return step.run(input, pluginProperties);
}

/**
 * Test helper to initialize a plugin
 */
export async function initializeTestPlugin<T>(
  plugin: AuthPlugin<T>,
  container?: AwilixContainer<ReAuthCradle>,
): Promise<void> {
  const testContainer = container || createTestContainer();
  plugin.container = testContainer;
  await plugin.initialize(testContainer);
}

/**
 * Test assertion helpers
 */
export class TestAssertions {
  /**
   * Assert that an auth output indicates success
   */
  static assertSuccess(output: AuthOutput, message?: string): void {
    if (!output.success) {
      throw new Error(message || `Expected success but got: ${output.message}`);
    }
  }

  /**
   * Assert that an auth output indicates failure
   */
  static assertFailure(output: AuthOutput, expectedMessage?: string): void {
    if (output.success) {
      throw new Error('Expected failure but got success');
    }
    if (expectedMessage && !output.message.includes(expectedMessage)) {
      throw new Error(
        `Expected message to contain "${expectedMessage}" but got: ${output.message}`,
      );
    }
  }

  /**
   * Assert that an entity has expected properties
   */
  static assertEntityProperties(
    entity: Entity,
    expectedProps: Partial<Entity>,
  ): void {
    for (const [key, value] of Object.entries(expectedProps)) {
      if ((entity as any)[key] !== value) {
        throw new Error(
          `Expected entity.${key} to be ${value} but got ${(entity as any)[key]}`,
        );
      }
    }
  }

  /**
   * Assert that a security event was logged
   */
  static assertSecurityEventLogged(
    securityService: MockSecurityService,
    eventType: string,
    pluginName: string,
  ): void {
    const events = securityService.getLoggedEvents();
    const found = events.some(
      (event) => event.type === eventType && event.pluginName === pluginName,
    );
    if (!found) {
      throw new Error(
        `Expected security event ${eventType} for plugin ${pluginName} but not found`,
      );
    }
  }
}

/**
 * Test data factory for common test scenarios
 */
export class TestDataFactory {
  /**
   * Create test data for email/password authentication
   */
  static emailPasswordData(overrides: any = {}) {
    return {
      email: 'test@example.com',
      password: 'testPassword123',
      ...overrides,
    };
  }

  /**
   * Create test data for phone authentication
   */
  static phoneData(overrides: any = {}) {
    return {
      phone: '+1234567890',
      code: '123456',
      ...overrides,
    };
  }

  /**
   * Create test data for API key authentication
   */
  static apiKeyData(overrides: any = {}) {
    return {
      apiKey: 'test-api-key-123',
      permissions: ['read', 'write'],
      ...overrides,
    };
  }

  /**
   * Create test data for organization context
   */
  static organizationData(overrides: any = {}) {
    return {
      organizationId: 'test-org-1',
      role: 'member',
      permissions: ['read'],
      ...overrides,
    };
  }
}
