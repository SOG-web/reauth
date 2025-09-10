// Public entrypoint for V2 experimental API (kept separate from existing exports)

export { reauthDbV2 } from './db.v2';
export { default as buildSchemaV2 } from './base.schema.v2';
export { sessionsV2 } from './session.schema.v2';

export { InMemorySessionResolvers } from './session-resolvers.v2';
export { FumaSessionServiceV2 } from './session-service.v2';
export { ReAuthEngineV2 } from './engine.v2';
export { emailPasswordSchemaV2 } from './plugins/email-password/schema.v2';
export { default as emailPasswordPluginV2, type EmailPasswordConfigV2 } from './plugins/email-password/plugin.v2';
export { anonymousSchemaV2 } from './plugins/anonymous/schema.v2';
export { default as anonymousPluginV2, type AnonymousConfigV2 } from './plugins/anonymous/plugin.v2';
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

// Example helper (commented out until example file is created)
// export { runExample as runEmailPasswordExample } from './examples/email-password.example';
