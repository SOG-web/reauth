// Advanced plugins
export { default as sessionPlugin } from './session';
export { default as jwtPlugin } from './jwt';
export { default as createOAuthPlugin } from './oauth';
export { default as apiKeyPlugin } from './api-key';
export { default as organizationPlugin } from './organization';

// Admin plugin
export { default as adminPlugin } from './admin';

// Re-export types
export type { EmailPasswordConfig } from './email-password/types';
export type { SessionConfig } from './session/types';
export type { ApiKeyConfig } from './api-key/types';
export type { OrganizationConfig } from './organization/types';
export type { AdminConfig } from './admin/types';
