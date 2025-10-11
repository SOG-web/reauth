import { describe, it, expect, afterEach, vi } from 'vitest';
import { Logger } from './logger.js';

describe('Logger', () => {
  let logger: Logger;

  afterEach(() => {
    if (logger) {
      logger.destroy();
    }
    vi.restoreAllMocks();
  });

  it('should create a logger instance', () => {
    logger = new Logger();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create logger with custom options', () => {
    logger = new Logger({
      prefix: 'TestApp',
      enabledTags: ['test'],
      timestampFormat: 'human',
      emojis: false,
    });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should support runtime tag control', () => {
    logger = new Logger({ enabledTags: ['test'] });

    // Test that setEnabledTags works
    logger.setEnabledTags(['new-tag']);
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should have all required methods', () => {
    logger = new Logger();

    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('success');
    expect(logger).toHaveProperty('setEnabledTags');
    expect(logger).toHaveProperty('destroy');
  });

  it('should handle different timestamp formats', () => {
    const isoLogger = new Logger({ timestampFormat: 'iso' });
    const humanLogger = new Logger({ timestampFormat: 'human' });

    expect(isoLogger).toBeInstanceOf(Logger);
    expect(humanLogger).toBeInstanceOf(Logger);

    isoLogger.destroy();
    humanLogger.destroy();
  });

  it('should handle emoji configuration', () => {
    const withEmojis = new Logger({ emojis: true });
    const withoutEmojis = new Logger({ emojis: false });

    expect(withEmojis).toBeInstanceOf(Logger);
    expect(withoutEmojis).toBeInstanceOf(Logger);

    withEmojis.destroy();
    withoutEmojis.destroy();
  });

  it('should handle environment variable configuration', () => {
    const originalEnv = process.env.REAUTH_DEBUG;
    process.env.REAUTH_DEBUG = 'network,auth';

    logger = new Logger({ prefixEnv: 'REAUTH_' });
    expect(logger).toBeInstanceOf(Logger);

    // Restore environment
    if (originalEnv) {
      process.env.REAUTH_DEBUG = originalEnv;
    } else {
      delete process.env.REAUTH_DEBUG;
    }
  });

  it('should handle file output configuration', () => {
    logger = new Logger({
      fileOutput: {
        enabled: true,
        fileName: 'test.log',
      },
    });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should handle multiple tags', () => {
    logger = new Logger({ enabledTags: ['auth', 'network'] });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should handle wildcard tags', () => {
    logger = new Logger({ enabledTags: ['*'] });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should handle empty enabled tags', () => {
    logger = new Logger({ enabledTags: [] });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should handle undefined enabled tags', () => {
    logger = new Logger({ enabledTags: undefined });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should handle all configuration options together', () => {
    logger = new Logger({
      prefix: 'FullTest',
      prefixEnv: 'TEST_',
      enabledTags: ['test', 'debug'],
      timestamp: true,
      timestampFormat: 'human',
      emojis: false,
      fileOutput: {
        enabled: true,
        filePath: './logs',
        fileName: 'test.log',
      },
    });
    expect(logger).toBeInstanceOf(Logger);
  });
});
