import type { AuthInput, AuthOutput } from '../../../types';

/**
 * Test data factory for generating consistent test data across integration tests
 */
export class TestDataFactory {
  private static counter = 1;

  /**
   * Generate unique test identifier
   */
  static uniqueId(): string {
    return `test_${Date.now()}_${this.counter++}`;
  }

  /**
   * Generate test email address
   */
  static email(prefix?: string): string {
    const id = prefix || this.uniqueId();
    return `${id}@example.com`;
  }

  /**
   * Generate test phone number
   */
  static phoneNumber(): string {
    const randomNum = Math.floor(Math.random() * 1000000000).toString().padStart(10, '0');
    return `+1${randomNum}`;
  }

  /**
   * Create test data for email/password authentication
   */
  static emailPasswordData(overrides: Partial<any> = {}) {
    return {
      email: this.email('test'),
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      others: {}, // Required field for plugin steps
      ...overrides,
    };
  }

  /**
   * Create test data for username authentication
   */
  static usernameData(overrides: Partial<any> = {}) {
    return {
      username: `testuser_${this.uniqueId()}`,
      password: 'TestPassword123!',
      ...overrides,
    };
  }

  /**
   * Create test data for phone authentication
   */
  static phoneData(overrides: Partial<any> = {}) {
    return {
      phoneNumber: this.phoneNumber(),
      code: '123456',
      ...overrides,
    };
  }

  /**
   * Create test data for API key authentication
   */
  static apiKeyData(overrides: Partial<any> = {}) {
    return {
      name: `Test API Key ${this.uniqueId()}`,
      description: 'Generated for testing',
      expiresInDays: 30,
      permissions: ['read', 'write'],
      others: {}, // Required field for plugin steps
      ...overrides,
    };
  }

  /**
   * Create test data for passwordless authentication
   */
  static passwordlessData(overrides: Partial<any> = {}) {
    return {
      email: this.email('passwordless'),
      ...overrides,
    };
  }

  /**
   * Create test data for organization context
   */
  static organizationData(overrides: Partial<any> = {}) {
    return {
      name: `Test Org ${this.uniqueId()}`,
      slug: `test-org-${this.uniqueId().toLowerCase()}`,
      description: 'Test organization for integration tests',
      settings: {
        allowInvites: true,
        requireEmailVerification: true,
      },
      ...overrides,
    };
  }

  /**
   * Create test data for organization member
   */
  static organizationMemberData(overrides: Partial<any> = {}) {
    return {
      role: 'member',
      permissions: ['read'],
      joinedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create test data for anonymous/guest session
   */
  static anonymousData(overrides: Partial<any> = {}) {
    return {
      fingerprint: `test_fingerprint_${this.uniqueId()}`,
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ipAddress: '127.0.0.1',
      metadata: {
        testMode: true,
      },
      others: {}, // Required field for plugin steps
      ...overrides,
    };
  }

  /**
   * Create test JWT payload
   */
  static jwtPayload(overrides: Partial<any> = {}) {
    return {
      sub: `test_subject_${this.uniqueId()}`,
      iss: 'test-reauth-issuer',
      aud: 'test-audience',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      jti: this.uniqueId(),
      ...overrides,
    };
  }

  /**
   * Create test session data
   */
  static sessionData(overrides: Partial<any> = {}) {
    return {
      subjectType: 'subject',
      subjectId: `test_subject_${this.uniqueId()}`,
      ttlSeconds: 3600,
      metadata: {
        userAgent: 'Test Browser',
        ipAddress: '127.0.0.1',
      },
      ...overrides,
    };
  }

  /**
   * Create test subject (user) data
   */
  static subjectData(overrides: Partial<any> = {}) {
    return {
      id: `subject_${this.uniqueId()}`,
      email: this.email('subject'),
      emailVerified: true,
      profile: {
        name: `Test User ${this.counter}`,
        avatar: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create test credentials data
   */
  static credentialsData(overrides: Partial<any> = {}) {
    return {
      type: 'password',
      identifier: this.email('credentials'),
      hashedPassword: '$2b$10$test.hash.for.testing.purposes.only',
      verified: true,
      ...overrides,
    };
  }

  /**
   * Create test verification code
   */
  static verificationCodeData(overrides: Partial<any> = {}) {
    return {
      type: 'email_verification',
      identifier: this.email('verify'),
      code: '123456',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      attempts: 0,
      ...overrides,
    };
  }

  /**
   * Reset the counter for predictable testing
   */
  static resetCounter(): void {
    this.counter = 1;
  }
}

/**
 * Test assertion helpers for validating auth outputs
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
   * Assert that a session is valid
   */
  static assertValidSession(session: { valid: boolean; subject: any; token: any }): void {
    if (!session.valid) {
      throw new Error('Expected valid session but got invalid session');
    }
    if (!session.subject) {
      throw new Error('Expected session to have subject');
    }
    if (!session.token) {
      throw new Error('Expected session to have token');
    }
  }

  /**
   * Assert that a session is invalid
   */
  static assertInvalidSession(session: { valid: boolean }): void {
    if (session.valid) {
      throw new Error('Expected invalid session but got valid session');
    }
  }

  /**
   * Assert that output contains specific data fields
   */
  static assertHasData(output: AuthOutput, expectedFields: string[]): void {
    this.assertSuccess(output);
    
    if (!output.data) {
      throw new Error('Expected output to have data object');
    }

    for (const field of expectedFields) {
      if (!(field in output.data)) {
        throw new Error(`Expected output.data to contain field: ${field}`);
      }
    }
  }

  /**
   * Assert that two objects have matching properties
   */
  static assertMatches(actual: any, expected: Partial<any>, message?: string): void {
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) {
        throw new Error(
          message || `Expected ${key} to be ${value} but got ${actual[key]}`
        );
      }
    }
  }
}

/**
 * Test scenario builders for common authentication flows
 */
export class TestScenarios {
  /**
   * Build a complete user registration scenario
   */
  static completeUserRegistration() {
    return {
      anonymousData: TestDataFactory.anonymousData(),
      emailPasswordData: TestDataFactory.emailPasswordData(),
      phoneData: TestDataFactory.phoneData(),
      organizationData: TestDataFactory.organizationData(),
    };
  }

  /**
   * Build a multi-factor authentication scenario
   */
  static multiFactor() {
    const email = TestDataFactory.email('mfa');
    return {
      emailPasswordData: TestDataFactory.emailPasswordData({ email }),
      phoneData: TestDataFactory.phoneData(),
      jwtData: TestDataFactory.jwtPayload({ sub: `user_with_${email}` }),
    };
  }

  /**
   * Build a cross-plugin workflow scenario
   */
  static crossPlugin() {
    const subjectId = `cross_plugin_${TestDataFactory.uniqueId()}`;
    return {
      sessionData: TestDataFactory.sessionData({ subjectId }),
      apiKeyData: TestDataFactory.apiKeyData(),
      orgData: TestDataFactory.organizationData(),
      memberData: TestDataFactory.organizationMemberData(),
    };
  }
}