// V2 Core exports
export * from './types.v2';
export * from './base.schema.v2';
export * from './session.schema.v2';
export * from './session-service.v2';
export * from './entity-service.v2';
export * from './engine.v2';

// Phone plugin exports
export { createPhonePlugin } from './plugins/phone/plugin.v2';
export type { PhoneConfigV2 } from './plugins/phone/types';
export { defaultPhoneConfig } from './plugins/phone/types';
export { phoneIdentitiesSchema } from './plugins/phone/schema.v2';
export {
  findTestUser as findPhoneTestUser,
  isTestEnvironmentAllowed as isPhoneTestEnvironmentAllowed,
  genCode as genPhoneCode,
  generateId as generatePhoneId
} from './plugins/phone/utils';

// Username plugin exports
export { createUsernamePlugin } from './plugins/username/plugin.v2';
export type { UsernameConfigV2 } from './plugins/username/types';
export { defaultUsernameConfig } from './plugins/username/types';
export { usernameIdentitiesSchema } from './plugins/username/schema.v2';
export {
  findTestUser as findUsernameTestUser,
  isTestEnvironmentAllowed as isUsernameTestEnvironmentAllowed,
  generateId as generateUsernameId
} from './plugins/username/utils';

// Email plugin exports (reference implementation)
export type { EmailConfigV2 } from './plugins/email-password/types';
export { defaultEmailConfig } from './plugins/email-password/types';
export { emailIdentitiesSchema } from './plugins/email-password/schema.v2';
export {
  findTestUser as findEmailTestUser,
  isTestEnvironmentAllowed as isEmailTestEnvironmentAllowed,
  genCode as genEmailCode,
  generateId as generateEmailId
} from './plugins/email-password/utils';