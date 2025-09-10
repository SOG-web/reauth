import type { EmailPasswordConfigV2 } from './types';

export const isTestEnvironmentAllowed = (config: EmailPasswordConfigV2): boolean => {
  if (!config.testUsers?.enabled) return false;
  const env = config.testUsers.environment || 'development';
  if (env === 'all') return true;
  const nodeEnv = process.env.NODE_ENV;
  return env === nodeEnv || (env === 'development' && (!nodeEnv || nodeEnv === 'development'));
};

export const findTestUser = (
  email: string,
  password: string,
  config: EmailPasswordConfigV2,
): { email: string; password: string; profile: Record<string, any> } | null => {
  if (!isTestEnvironmentAllowed(config)) return null;
  return (
    config.testUsers?.users.find((u) => u.email === email && u.password === password) || null
  );
};

export const genCode = (config?: EmailPasswordConfigV2) => {
  const len = config?.codeLenght ?? 4;
  const type = config?.codeType ?? 'numeric';
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  if (type === 'numeric') return Array(len).fill(0).map(() => String.fromCharCode(48 + rand(0, 9))).join('');
  if (type === 'alphabet') return Array(len).fill(0).map(() => String.fromCharCode(97 + rand(0, 25))).join('');
  // alphanumeric default
  return Array(len).fill(0).map(() => String.fromCharCode(48 + rand(0, 74))).join('');
};
