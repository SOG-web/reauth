import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import chalk from 'chalk';
import pino from 'pino';
import type {
  LogLevel,
  LoggerOptions,
  LogMessage,
  LoggerInterface,
  TimestampFormat,
} from './types.js';

export class Logger implements LoggerInterface {
  private enabledTags: Set<string> = new Set();
  private prefix: string;
  private prefixEnv: string;
  private timestamp: boolean;
  private timestampFormat: TimestampFormat;
  private emojis: boolean;
  private fileOutput: LoggerOptions['fileOutput'];
  private pinoLogger: pino.Logger;
  private fileStream?: any; // Runtime agnostic writable stream

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    this.prefixEnv = options.prefixEnv || '';
    this.timestamp = options.timestamp !== false;
    this.timestampFormat = options.timestampFormat || 'iso';
    this.emojis = options.emojis !== false; // Default to true for backward compatibility
    this.fileOutput = options.fileOutput;

    // Initialize enabled tags from options and environment
    this.initializeEnabledTags(options.enabledTags);

    // Initialize pino logger
    this.pinoLogger = this.initializePinoLogger();

    // Initialize file output if enabled
    if (this.fileOutput?.enabled) {
      this.initializeFileOutput();
    }
  }

  private initializeEnabledTags(initialTags?: string[]): void {
    // Start with initial tags if provided
    if (initialTags) {
      initialTags.forEach((tag) => this.enabledTags.add(tag));
    }

    // Parse environment variable for tag control
    if (this.prefixEnv) {
      const envVar = `${this.prefixEnv}DEBUG`;
      const envValue = process.env[envVar];

      if (envValue) {
        const envTags = envValue.split(',').map((tag) => tag.trim());

        // If wildcard is present, enable all tags
        if (envTags.includes('*')) {
          // Enable all tags - we'll handle this in the log method
          this.enabledTags.add('*');
        } else {
          envTags.forEach((tag) => this.enabledTags.add(tag));
        }
      }
    }

    // If no tags are enabled, enable all by default
    if (this.enabledTags.size === 0) {
      this.enabledTags.add('*');
    }
  }

  private initializePinoLogger(): pino.Logger {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Production: structured JSON logging
      return pino({
        level: 'info',
        formatters: {
          level: (label) => ({ level: label }),
        },
      });
    } else {
      // Development: pretty printing with pino-pretty
      return pino({
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true, // Let chalk handle colors
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        },
      });
    }
  }

  private initializeFileOutput(): void {
    if (!this.fileOutput?.enabled) return;

    const fileName =
      this.fileOutput.fileName ||
      `${this.prefix || 'app'}-${new Date().toISOString().split('T')[0]}.log`;
    const filePath = this.fileOutput.filePath
      ? join(this.fileOutput.filePath, fileName)
      : fileName;

    // Ensure directory exists
    const dir = dirname(filePath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    this.fileStream = createWriteStream(filePath, { flags: 'a' });
  }

  private shouldLog(tags: string[]): boolean {
    // If wildcard is enabled, log everything
    if (this.enabledTags.has('*')) {
      return true;
    }

    // Check if any of the message tags are enabled
    return tags.some((tag) => this.enabledTags.has(tag));
  }

  private formatTimestamp(date: Date): string {
    if (this.timestampFormat === 'human') {
      return this.formatHumanTimestamp(date);
    }
    return date.toISOString();
  }

  private formatHumanTimestamp(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const displaySeconds = seconds.toString().padStart(2, '0');

    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    return `${displayHours}:${displayMinutes}:${displaySeconds}${ampm} ${day} ${month} ${year}`;
  }

  private getEmoji(level: LogLevel): string {
    if (!this.emojis) {
      return '';
    }

    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      default:
        return '📝';
    }
  }

  private formatMessage(logMessage: LogMessage): string {
    const { level, tags, message, timestamp, prefix } = logMessage;
    const emoji = this.getEmoji(level);
    const tagStr = tags.length > 0 ? `[${tags.join(',')}]` : '';
    const prefixStr = prefix ? `[${prefix}]` : '';
    const timeStr = timestamp ? `[${timestamp}]` : '';

    // Use chalk for colored terminal output in development
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      const coloredTime = timeStr ? chalk.gray(timeStr) : '';
      const coloredPrefix = prefixStr ? chalk.cyan(prefixStr) : '';
      const coloredTags = tagStr ? chalk.yellow(tagStr) : '';
      const coloredMessage = this.getColoredMessage(level, message);

      return `${coloredTime}${coloredPrefix} ${coloredTags} ${emoji} ${coloredMessage}`;
    }

    return `${timeStr}${prefixStr} ${tagStr} ${emoji} ${message}`;
  }

  private getColoredMessage(level: LogLevel, message: string): string {
    switch (level) {
      case 'info':
        return chalk.blue(message);
      case 'warn':
        return chalk.yellow(message);
      case 'error':
        return chalk.red(message);
      case 'success':
        return chalk.green(message);
      default:
        return message;
    }
  }

  private log(level: LogLevel, tags: string[], ...args: any[]): void {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    // Check if we should log this message
    if (!this.shouldLog(tagArray)) {
      return;
    }

    const message = args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(' ');

    const timestamp = this.timestamp ? this.formatTimestamp(new Date()) : '';

    const logMessage: LogMessage = {
      level,
      tags: tagArray,
      message,
      timestamp,
      prefix: this.prefix,
      data: args.length > 1 ? args.slice(1) : undefined,
    };

    // Use pino for all output - it handles pretty printing in development
    // Map 'success' to 'info' since pino doesn't have a success level
    const pinoLevel = level === 'success' ? 'info' : level;

    // Create a pino-compatible log object with colored message
    const isProduction = process.env.NODE_ENV === 'production';
    const coloredMessage = isProduction
      ? message
      : this.getColoredMessage(level, message);

    const pinoLogObj = {
      level,
      tags: tagArray,
      message: message,
      timestamp,
      prefix: this.prefix,
      emoji: this.getEmoji(level),
      ...(args.length > 1 && { data: args.slice(1) }),
    };

    this.pinoLogger[pinoLevel](pinoLogObj);

    // File output - always use our custom formatting for consistency
    if (this.fileStream) {
      const fileMessage = this.formatMessage(logMessage);
      this.fileStream.write(fileMessage + '\n');
    }
  }

  public info(tag: string | string[], ...args: any[]): void {
    this.log('info', Array.isArray(tag) ? tag : [tag], ...args);
  }

  public warn(tag: string | string[], ...args: any[]): void {
    this.log('warn', Array.isArray(tag) ? tag : [tag], ...args);
  }

  public error(tag: string | string[], ...args: any[]): void {
    this.log('error', Array.isArray(tag) ? tag : [tag], ...args);
  }

  public success(tag: string | string[], ...args: any[]): void {
    this.log('success', Array.isArray(tag) ? tag : [tag], ...args);
  }

  public setEnabledTags(tags: string[]): void {
    this.enabledTags.clear();
    tags.forEach((tag) => this.enabledTags.add(tag));
  }

  public destroy(): void {
    if (this.fileStream) {
      this.fileStream.end();
    }
  }
}
