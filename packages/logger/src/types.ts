export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export type TimestampFormat = 'iso' | 'human';

export type LoggerOptions = {
  prefix?: string;
  enabledTags?: string[];
  prefixEnv?: string;
  timestamp?: boolean;
  timestampFormat?: TimestampFormat;
  emojis?: boolean;
  fileOutput?: FileOutputOptions;
};

export type FileOutputOptions = {
  enabled: boolean;
  filePath?: string;
  fileName?: string;
};

export type LogMessage = {
  level: LogLevel;
  tags: string[];
  message: string;
  timestamp: string;
  prefix?: string;
  data?: any;
};

export type LoggerInterface = {
  info(tag: string | string[], ...args: any[]): void;
  warn(tag: string | string[], ...args: any[]): void;
  error(tag: string | string[], ...args: any[]): void;
  success(tag: string | string[], ...args: any[]): void;
  setEnabledTags(tags: string[]): void;
  destroy(): void;
};

export type CreateDefaultLoggerFunction = (
  options?: LoggerOptions,
) => LoggerInterface;
