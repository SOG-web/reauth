export { default as jwtPlugin } from './plugin';
export type { JWTPluginConfig } from '../../jwt.types';
export { jwtSchema } from '../../jwt.schema';

// Export steps for direct usage if needed
export { createJWTTokenStep } from './steps/create-jwt-token.step';
export { verifyJWTTokenStep } from './steps/verify-jwt-token.step';
export { blacklistJWTTokenStep } from './steps/blacklist-jwt-token.step';
export { getJWKSStep } from './steps/get-jwks.step';