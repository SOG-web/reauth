import { randomBytes } from 'crypto';
import type { TestUsersConfigV2 } from '../../types.v2';

// Test user utilities
export function findTestUser(identifier: string, testUsers: TestUsersConfigV2): boolean {
  if (!testUsers.enabled) {
    return false;
  }
  return testUsers.users.includes(identifier);
}

export function isTestEnvironmentAllowed(testUsers: TestUsersConfigV2): boolean {
  if (!testUsers.enabled) {
    return false;
  }
  
  if (!testUsers.environmentGating) {
    return true;
  }
  
  const currentEnv = process.env.NODE_ENV || 'development';
  return testUsers.allowedEnvironments?.includes(currentEnv) || false;
}

// Generate secure ID
export function generateId(): string {
  return randomBytes(16).toString('hex');
}