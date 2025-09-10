import type { UsernamePasswordConfigV2 } from './types';

export const isTestEnvironmentAllowed = (
  config: UsernamePasswordConfigV2,
): boolean => {
  if (!config.testUsers?.enabled) return false;
  const env = config.testUsers.environment || 'development';
  if (env === 'all') return true;
  const nodeEnv = process.env.NODE_ENV;
  return (
    env === nodeEnv ||
    (env === 'development' && (!nodeEnv || nodeEnv === 'development'))
  );
};

export const findTestUser = (
  username: string,
  password: string,
  config: UsernamePasswordConfigV2,
): { username: string; password: string; profile: Record<string, any> } | null => {
  if (!isTestEnvironmentAllowed(config)) return null;
  return (
    config.testUsers?.users.find(
      (u) => u.username === username && u.password === password,
    ) || null
  );
};

export const genCode = (config?: UsernamePasswordConfigV2) => {
  const len = config?.codeLength ?? 4;
  const type = config?.codeType ?? 'numeric';
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  if (type === 'numeric')
    return Array(len)
      .fill(0)
      .map(() => String.fromCharCode(48 + rand(0, 9)))
      .join('');
  if (type === 'alphabet')
    return Array(len)
      .fill(0)
      .map(() => String.fromCharCode(97 + rand(0, 25)))
      .join('');
  // alphanumeric default
  return Array(len)
    .fill(0)
    .map(() => String.fromCharCode(48 + rand(0, 74)))
    .join('');
};