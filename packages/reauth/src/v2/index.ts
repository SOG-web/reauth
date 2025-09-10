// Public entrypoint for V2 experimental API (kept separate from existing exports)

export { reauthDbV2 } from './db.v2';
export { default as buildSchemaV2 } from './base.schema.v2';
export { sessionsV2 } from './session.schema.v2';

export { InMemorySessionResolvers } from './session-resolvers.v2';
export { FumaSessionServiceV2 } from './session-service.v2';
export { ReAuthEngineV2 } from './engine.v2';

// Email plugin
export { emailPasswordSchemaV2 } from './plugins/email-password/schema.v2';
export { baseEmailPasswordPluginV2, type EmailPasswordConfigV2 } from './plugins/email-password/plugin.v2';

// Phone plugin
export { phonePasswordSchemaV2 } from './plugins/phone/schema.v2';
export { basePhonePasswordPluginV2, type PhonePasswordConfigV2 } from './plugins/phone/plugin.v2';

// Username plugin
export { usernamePasswordSchemaV2 } from './plugins/username/schema.v2';
export { baseUsernamePasswordPluginV2, type UsernamePasswordConfigV2 } from './plugins/username/plugin.v2';

// Email-or-username plugin
export { emailOrUsernameSchemaV2 } from './plugins/email-or-username/schema.v2';
export { baseEmailOrUsernamePluginV2, type EmailOrUsernameConfigV2 } from './plugins/email-or-username/plugin.v2';

export { createAuthPluginV2, createAuthPluginLegacyV2 } from './utils/create-plugin.v2';

export type {
  FumaClient,
  SessionResolvers,
  SessionServiceV2,
  Subject,
  SubjectResolver,
  ReAuthCradleV2,
  AuthInput,
  AuthOutput,
} from './types.v2';
