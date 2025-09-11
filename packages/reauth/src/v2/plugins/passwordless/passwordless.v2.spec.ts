import { describe, it, expect, vi } from 'vitest';
import {
  default as passwordlessPluginV2,
  createPasswordlessPluginV2,
} from './plugin.v2';
import { createAuthPluginV2 } from '../../utils/create-plugin.v2';

describe('Passwordless Plugin V2', () => {
  it('should have the correct name', () => {
    expect(passwordlessPluginV2.name).toBe('passwordless');
  });

  it('should have all required steps', () => {
    const stepNames =
      passwordlessPluginV2.steps?.map((step) => step.name) || [];
    expect(stepNames).toContain('send-magic-link');
    expect(stepNames).toContain('verify-magic-link');
    expect(stepNames).toContain('register-webauthn');
    expect(stepNames).toContain('authenticate-webauthn');
    expect(stepNames).toContain('list-credentials');
    expect(stepNames).toContain('revoke-credential');
  });

  it('should have default configuration values', () => {
    expect(passwordlessPluginV2.config).toEqual({
      sessionTtlSeconds: 3600,
      magicLinkTtlMinutes: 30,
      magicLinks: false,
      webauthn: false,
    });
  });

  it('should have root hooks for cleanup', () => {
    expect(passwordlessPluginV2.rootHooks).toBeDefined();
    expect(passwordlessPluginV2.rootHooks?.before).toBeDefined();
  });

  it('should validate config with factory function', () => {
    expect(() => {
      createPasswordlessPluginV2({
        magicLinks: false,
        webauthn: false,
      } as any);
    }).toThrow('At least one authentication method must be enabled');
  });

  it('should create valid magic links plugin', () => {
    const mockSendMagicLink = vi.fn();

    expect(() => {
      createPasswordlessPluginV2({
        magicLinks: true,
        sendMagicLink: mockSendMagicLink,
        sessionTtlSeconds: 3600,
        magicLinkTtlMinutes: 30,
      });
    }).not.toThrow();
  });

  it('should create valid WebAuthn plugin', () => {
    expect(() => {
      createPasswordlessPluginV2({
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
      createAuthPluginV2(passwordlessPluginV2, {
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
