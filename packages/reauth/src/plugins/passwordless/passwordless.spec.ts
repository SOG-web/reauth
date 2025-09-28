import { describe, it, expect, vi } from 'vitest';
import {
  default as passwordlessPlugin,
  createPasswordlessPlugin,
} from './plugin';
import { createAuthPlugin } from '../../utils/create-plugin';

describe('Passwordless Plugin ', () => {
  it('should have the correct name', () => {
    expect(passwordlessPlugin.name).toBe('passwordless');
  });

  it('should have all required steps', () => {
    const stepNames = passwordlessPlugin.steps?.map((step) => step.name) || [];
    expect(stepNames).toContain('send-magic-link');
    expect(stepNames).toContain('verify-magic-link');
    expect(stepNames).toContain('register-webauthn');
    expect(stepNames).toContain('authenticate-webauthn');
    expect(stepNames).toContain('list-credentials');
    expect(stepNames).toContain('revoke-credential');
  });

  it('should have default configuration values', () => {
    expect(passwordlessPlugin.config).toEqual({
      sessionTtlSeconds: 3600,
      magicLinkTtlMinutes: 30,
      magicLinks: false,
      webauthn: false,
    });
  });

  it('should have root hooks for cleanup', () => {
    expect(passwordlessPlugin.rootHooks).toBeDefined();
    expect(passwordlessPlugin.rootHooks?.before).toBeDefined();
  });

  it('should validate config with factory function', () => {
    expect(() => {
      createPasswordlessPlugin({
        magicLinks: false,
        webauthn: false,
      } as any);
    }).toThrow('At least one authentication method must be enabled');
  });

  it('should create valid magic links plugin', () => {
    const mockSendMagicLink = vi.fn();

    expect(() => {
      createPasswordlessPlugin({
        magicLinks: true,
        sendMagicLink: mockSendMagicLink,
        sessionTtlSeconds: 3600,
        magicLinkTtlMinutes: 30,
      });
    }).not.toThrow();
  });

  it('should create valid WebAuthn plugin', () => {
    expect(() => {
      createPasswordlessPlugin({
        webauthn: true,
        rpId: 'example.com',
        rpName: 'Example App',
        sessionTtlSeconds: 3600,
      });
    }).not.toThrow();
  });

  it('should be able to create configured plugin instance', () => {
    const mockSendMagicLink = vi.fn();

    expect(() => {
      createAuthPlugin(passwordlessPlugin, {
        config: {
          magicLinks: true,
          sendMagicLink: mockSendMagicLink,
          sessionTtlSeconds: 3600,
          magicLinkTtlMinutes: 30,
        } as any, // Type assertion to bypass complex discriminated union
      });
    }).not.toThrow();
  });
});
