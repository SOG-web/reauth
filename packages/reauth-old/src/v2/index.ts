// Public entrypoint for V2 experimental API (kept separate from existing exports)

export { reauthDbV2 } from './db.v2';
export { default as buildSchemaV2 } from './base.schema.v2';
export { sessionsV2 } from './session.schema.v2';

export { InMemorySessionResolvers } from './session-resolvers.v2';
export { FumaSessionServiceV2 } from './session-service.v2';
export { ReAuthEngineV2 } from './engine.v2';
export { emailPasswordSchemaV2 } from './plugins/email-password/schema.v2';

export { anonymousSchemaV2 } from './plugins/anonymous/schema.v2';
export { default as anonymousPluginV2, type AnonymousConfigV2 } from './plugins/anonymous/plugin.v2';

export { passwordlessSchemaV2 } from './plugins/passwordless/schema.v2';
export { default as passwordlessPluginV2, createPasswordlessPluginV2, type PasswordlessConfigV2 } from './plugins/passwordless/plugin.v2';

// Email plugin
export { default as emailPasswordPluginV2, baseEmailPasswordPluginV2, type EmailPasswordConfigV2 } from './plugins/email-password/plugin.v2';
export { apiKeySchemaV2 } from './plugins/api-key/schema.v2';
export { default as apiKeyPluginV2, type ApiKeyConfigV2 } from './plugins/api-key/plugin.v2';

// Phone plugin
export { phonePasswordSchemaV2 } from './plugins/phone/schema.v2';
export { basePhonePasswordPluginV2, type PhonePasswordConfigV2 } from './plugins/phone/plugin.v2';

// Username plugin
export { usernamePasswordSchemaV2 } from './plugins/username/schema.v2';
export { baseUsernamePasswordPluginV2, type UsernamePasswordConfigV2 } from './plugins/username/plugin.v2';

// MCP plugin
export { mcpSchemaV2 } from './plugins/mcp/schema.v2';
export { default as mcpPluginV2, baseMcpPluginV2, type MCPConfigV2 } from './plugins/mcp/plugin.v2';

// Two-Factor Authentication plugin
export { twoFactorAuthSchema } from './plugins/two-factor-auth/schema.v2';
export { 
  default as twoFactorAuthPluginV2,
  baseTwoFactorAuthPluginV2,
  type TwoFactorAuthConfigV2 
} from './plugins/two-factor-auth/plugin.v2';

// OAuth Discovery plugin (preparation for advanced OIDC auth plugins)
export { 
  default as oAuthDiscoveryPluginV2,
  baseOAuthDiscoveryPluginV2,
  createOAuthDiscoveryPluginV2,
  type OAuthDiscoveryConfigV2,
  type OAuthDiscoveryMetadata,
  type OAuthProtectedResourceMetadata 
} from './plugins/oauth-discovery/plugin.v2';

// OAuth plugin (third-party authentication)
export { oauthSchemaV2 } from './plugins/oauth/schema.v2';
export { 
  default as oauthPluginV2,
  baseOAuthPluginV2,
  createOAuthPlugin,
  type OAuthConfigV2,
  type OAuthProviderConfig,
  type OAuthUserProfile,
  type OAuthTokenResponse,
  type OAuthState
} from './plugins/oauth';
export { createGoogleOAuthPlugin, type GoogleOAuthConfig } from './plugins/oauth/providers/google';
export { createGitHubOAuthPlugin, type GitHubOAuthConfig } from './plugins/oauth/providers/github';
// Email-or-username plugin
export { baseEmailOrUsernamePluginV2, type EmailOrUsernameConfigV2 } from './plugins/email-or-username/plugin.v2';

// Organization plugin
export { organizationSchemaV2 } from './plugins/organization/schema.v2';
export { default as organizationPluginV2, baseOrganizationPluginV2, type OrganizationConfigV2 } from './plugins/organization/plugin.v2';

// OIDC Provider plugin (OpenID Connect Identity Provider)
export { oidcProviderSchemaV2 } from './plugins/oidc-provider/schema.v2';
export {
  default as oidcProviderPluginV2,
  baseOIDCProviderPluginV2,
  createOIDCProviderPlugin,
  type OIDCProviderConfigV2
} from './plugins/oidc-provider/plugin.v2';

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

