/**
 * Test User Feature Unit Tests
 *
 * This file contains comprehensive tests for the test user functionality
 * across all authentication plugins.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import emailPasswordAuth from './email-password/email-password.plugin';
import phonePasswordAuth from './phone-password/phone-password.plugin';
import usernamePasswordAuth from './username/username.plugin';

// Mock dependencies
const mockContainer = {
  cradle: {
    entityService: {
      findEntity: vi.fn(),
      createEntity: vi.fn(),
      updateEntity: vi.fn(),
    },
    reAuthEngine: {
      createSession: vi.fn(),
    },
    serializeEntity: vi.fn(),
  },
};

describe('Test User Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV to development for tests
    process.env.NODE_ENV = 'development';
  });

  describe('Email-Password Plugin Test Users', () => {
    const plugin = emailPasswordAuth({
      verifyEmail: false,
      testUsers: {
        enabled: true,
        users: [
          {
            email: 'test@example.com',
            password: 'test123',
            profile: {
              name: 'Test User',
              role: 'admin',
            },
          },
        ],
      },
    });

    it('should authenticate test user successfully', async () => {
      // Mock successful session creation
      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'test-token-123',
      });

      mockContainer.cradle.serializeEntity.mockReturnValue({
        id: 'test-user-test@example.com',
        email: 'test@example.com',
        role: 'admin',
      });

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        {
          email: 'test@example.com',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('test user');
      expect(result.token).toBe('test-token-123');
      expect(
        mockContainer.cradle.entityService.findEntity,
      ).not.toHaveBeenCalled();
    });

    it('should fall back to normal authentication for non-test users', async () => {
      mockContainer.cradle.entityService.findEntity.mockResolvedValue({
        id: 'real-user-1',
        email: 'real@example.com',
        password_hash: 'hashed-password',
        email_verified: true,
      });

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        {
          email: 'real@example.com',
          password: 'wrong-password',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(
        mockContainer.cradle.entityService.findEntity,
      ).toHaveBeenCalledWith('real@example.com', 'email');
    });

    it('should not work when test users are disabled', async () => {
      const pluginDisabled = emailPasswordAuth({
        testUsers: {
          enabled: false,
          users: [
            {
              email: 'test@example.com',
              password: 'test123',
              profile: {},
            },
          ],
        },
      });

      mockContainer.cradle.entityService.findEntity.mockResolvedValue(null);

      const loginStep = pluginDisabled.steps.find(
        (step) => step.name === 'login',
      );
      const result = await loginStep!.run(
        {
          email: 'test@example.com',
          password: 'test123',
        },
        { container: mockContainer, config: pluginDisabled.config },
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
      expect(mockContainer.cradle.entityService.findEntity).toHaveBeenCalled();
    });

    it('should respect environment restrictions', async () => {
      process.env.NODE_ENV = 'production';

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      mockContainer.cradle.entityService.findEntity.mockResolvedValue(null);

      const result = await loginStep!.run(
        {
          email: 'test@example.com',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
      expect(mockContainer.cradle.entityService.findEntity).toHaveBeenCalled();
    });
  });

  describe('Phone-Password Plugin Test Users', () => {
    const plugin = phonePasswordAuth({
      verifyPhone: false,
      sendCode: vi.fn(),
      testUsers: {
        enabled: true,
        users: [
          {
            phone: '+1234567890',
            password: 'test123',
            profile: {
              name: 'Test Phone User',
              role: 'user',
            },
          },
        ],
      },
    });

    it('should authenticate phone test user successfully', async () => {
      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'phone-test-token',
      });

      mockContainer.cradle.serializeEntity.mockReturnValue({
        id: 'test-user-+1234567890',
        phone: '+1234567890',
        role: 'user',
      });

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        {
          phone: '+1234567890',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('test user');
      expect(result.token).toBe('phone-test-token');
    });

    it('should handle test user registration', async () => {
      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'phone-register-token',
      });

      mockContainer.cradle.serializeEntity.mockReturnValue({
        id: 'test-user-+1234567890',
        phone: '+1234567890',
      });

      const registerStep = plugin.steps.find(
        (step) => step.name === 'register',
      );
      const result = await registerStep!.run(
        {
          phone: '+1234567890',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('test user');
    });
  });

  describe('Username-Password Plugin Test Users', () => {
    const plugin = usernamePasswordAuth({
      testUsers: {
        enabled: true,
        users: [
          {
            username: 'testuser',
            password: 'test123',
            profile: {
              name: 'Test Username User',
              role: 'developer',
            },
          },
        ],
      },
    });

    it('should authenticate username test user successfully', async () => {
      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'username-test-token',
      });

      mockContainer.cradle.serializeEntity.mockReturnValue({
        id: 'test-user-testuser',
        username: 'testuser',
        role: 'developer',
      });

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        {
          username: 'testuser',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('test user');
      expect(result.token).toBe('username-test-token');
    });

    it('should handle username test user registration', async () => {
      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'username-register-token',
      });

      mockContainer.cradle.serializeEntity.mockReturnValue({
        id: 'test-user-testuser',
        username: 'testuser',
        role: 'developer',
      });

      const registerStep = plugin.steps.find(
        (step) => step.name === 'register',
      );
      const result = await registerStep!.run(
        {
          username: 'testuser',
          password: 'test123',
        },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('test user');
    });
  });

  describe('Environment Controls', () => {
    it('should work in development environment', async () => {
      process.env.NODE_ENV = 'development';

      const plugin = emailPasswordAuth({
        testUsers: {
          enabled: true,
          environment: 'development',
          users: [
            { email: 'test@example.com', password: 'test123', profile: {} },
          ],
        },
      });

      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'dev-token',
      });
      mockContainer.cradle.serializeEntity.mockReturnValue({});

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        { email: 'test@example.com', password: 'test123' },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
    });

    it('should work in test environment when configured', async () => {
      process.env.NODE_ENV = 'test';

      const plugin = emailPasswordAuth({
        testUsers: {
          enabled: true,
          environment: 'test',
          users: [
            { email: 'test@example.com', password: 'test123', profile: {} },
          ],
        },
      });

      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'test-token',
      });
      mockContainer.cradle.serializeEntity.mockReturnValue({});

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        { email: 'test@example.com', password: 'test123' },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
    });

    it('should not work in production when environment is development', async () => {
      process.env.NODE_ENV = 'production';

      const plugin = emailPasswordAuth({
        testUsers: {
          enabled: true,
          environment: 'development',
          users: [
            { email: 'test@example.com', password: 'test123', profile: {} },
          ],
        },
      });

      mockContainer.cradle.entityService.findEntity.mockResolvedValue(null);

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        { email: 'test@example.com', password: 'test123' },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(false);
      expect(mockContainer.cradle.entityService.findEntity).toHaveBeenCalled();
    });

    it('should work in all environments when configured to "all"', async () => {
      process.env.NODE_ENV = 'production';

      const plugin = emailPasswordAuth({
        testUsers: {
          enabled: true,
          environment: 'all',
          users: [
            { email: 'test@example.com', password: 'test123', profile: {} },
          ],
        },
      });

      mockContainer.cradle.reAuthEngine.createSession.mockResolvedValue({
        success: true,
        token: 'all-env-token',
      });
      mockContainer.cradle.serializeEntity.mockReturnValue({});

      const loginStep = plugin.steps.find((step) => step.name === 'login');
      const result = await loginStep!.run(
        { email: 'test@example.com', password: 'test123' },
        { container: mockContainer, config: plugin.config },
      );

      expect(result.success).toBe(true);
    });
  });
});
