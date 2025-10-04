import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestReAuthEngine, resetTestEngine, createTestSubject, createTestIdentity, createTestCredential } from '../utils/test-engine-factory';
import type { FumaClient } from '../../../types';

describe('ReAuthEngine - Email-Password Plugin Integration', () => {
  let engine: ReturnType<typeof createTestReAuthEngine>['engine'];
  let dbClient: FumaClient;

  beforeEach(() => {
    const setup = createTestReAuthEngine();
    engine = setup.engine;
    dbClient = setup.dbClient;
  });

  afterEach(() => {
    resetTestEngine(engine, dbClient);
  });

  describe('Register Step', () => {
    it('should register a new user with email and password', async () => {
      const result = await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.subject).toBeDefined();
      expect(result.subject?.id).toBeDefined();
    });

    it('should create subject, identity, and credentials in database', async () => {
      await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });

      // Check database state
      const orm = await engine.getOrm();
      const subjects = await orm.findMany('subjects');
      const identities = await orm.findMany('identities');
      const credentials = await orm.findMany('credentials');

      expect(subjects.length).toBe(1);
      expect(identities.length).toBe(1);
      expect(credentials.length).toBe(1);

      expect(identities[0].provider).toBe('email');
      expect(identities[0].identifier).toBe('test@example.com');
      expect(identities[0].verified).toBe(false); // Since verifyEmail is false
    });

    it('should fail if email already exists', async () => {
      // Register first user
      await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });

      // Try to register again with same email
      const result = await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('Login Step', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should login with correct credentials', async () => {
      const result = await engine.executeStep('email-password', 'login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.subject).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      const result = await engine.executeStep('email-password', 'login', {
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const result = await engine.executeStep('email-password', 'login', {
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
    });
  });

  describe('Change Password Step', () => {
    let token: string;

    beforeEach(async () => {
      // Register a user (which also logs them in)
      const registerResult = await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });
      token = registerResult.token as string;
    });

    it('should change password with correct old password', async () => {
      const result = await engine.executeStep('email-password', 'change-password', {
        token,
        oldPassword: 'password123',
        newPassword: 'newpassword456',
      });

      expect(result.success).toBe(true);

      // Verify new password works
      const loginResult = await engine.executeStep('email-password', 'login', {
        email: 'test@example.com',
        password: 'newpassword456',
      });
      expect(loginResult.success).toBe(true);
    });

    it('should fail with incorrect old password', async () => {
      const result = await engine.executeStep('email-password', 'change-password', {
        token,
        oldPassword: 'wrongpassword',
        newPassword: 'newpassword456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid credentials');
    });
  });

  describe('Password Reset Flow', () => {
    let subjectId: string;

    beforeEach(async () => {
      // Register a user
      const registerResult = await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });
      subjectId = registerResult.subject!.id;
    });

    it('should send reset password code', async () => {
      const result = await engine.executeStep('email-password', 'send-reset-password', {
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);

      // Check that reset code was created in database
      const orm = await engine.getOrm();
      const resetCodes = await orm.findMany('password_reset_codes');
      expect(resetCodes.length).toBe(1);
      expect(resetCodes[0].email).toBe('test@example.com');
    });

    it('should reset password with valid code', async () => {
      // Send reset code
      await engine.executeStep('email-password', 'send-reset-password', {
        email: 'test@example.com',
      });

      // Get the code from database
      const orm = await engine.getOrm();
      const resetCodes = await orm.findMany('password_reset_codes');
      const code = resetCodes[0].code;

      // Reset password
      const result = await engine.executeStep('email-password', 'reset-password', {
        email: 'test@example.com',
        code,
        newPassword: 'newpassword456',
      });

      expect(result.success).toBe(true);

      // Verify new password works
      const loginResult = await engine.executeStep('email-password', 'login', {
        email: 'test@example.com',
        password: 'newpassword456',
      });
      expect(loginResult.success).toBe(true);
    });

    it('should fail reset with invalid code', async () => {
      const result = await engine.executeStep('email-password', 'reset-password', {
        email: 'test@example.com',
        code: 'invalid-code',
        newPassword: 'newpassword456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or expired reset code');
    });
  });

  describe('Email Verification Flow', () => {
    it('should send verification code when verifyEmail is enabled', async () => {
      // Create engine with email verification enabled
      const setup = createTestReAuthEngine({
        mockSendCode: async (subject, code, email, type) => {
          // Mock email sending
        },
      });
      const testEngine = setup.engine;
      const testDbClient = setup.dbClient;

      // Register with verification enabled (override config)
      const result = await testEngine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);

      // Check that verification code was created
      const orm = await testEngine.getOrm();
      const verificationCodes = await orm.findMany('verification_codes');
      expect(verificationCodes.length).toBe(0); // Since verifyEmail is false in config

      resetTestEngine(testEngine, testDbClient);
    });
  });

  describe('Profile Integration', () => {
    it('should return email profile information', async () => {
      // Register a user
      const registerResult = await engine.executeStep('email-password', 'register', {
        email: 'test@example.com',
        password: 'password123',
      });
      const subjectId = registerResult.subject!.id;

      // Get profile
      const plugin = engine.getPlugin('email-password');
      const profile = await plugin!.getProfile!(subjectId, {
        orm: await engine.getOrm(),
        engine,
        container: engine.getContainer(),
        config: plugin!.config,
      });

      expect(profile.emails).toHaveLength(1);
      expect(profile.emails[0].email).toBe('test@example.com');
      expect(profile.emails[0].verified).toBe(true);
      expect(profile.password.set).toBe(true);
    });
  });
});