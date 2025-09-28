// Public entrypoint for  experimental API (kept separate from existing exports)

export { reauthDb } from './db';
export { default as buildSchema } from './base.schema';
export { sessions } from './session.schema';

export { InMemorySessionResolvers } from './session-resolvers';
export { FumaSessionService } from './session-service';
export { ReAuthEngine } from './engine';
export { emailPasswordSchema } from './plugins/email-password/schema';

export { anonymousSchema } from './plugins/anonymous/schema';
export {
  default as anonymousPlugin,
  type AnonymousConfig,
} from './plugins/anonymous/plugin';

export { passwordlessSchema } from './plugins/passwordless/schema';
export {
  default as passwordlessPlugin,
  createPasswordlessPlugin,
  type PasswordlessConfig,
} from './plugins/passwordless/plugin';

// Email plugin
export {
  default as emailPasswordPlugin,
  baseEmailPasswordPlugin,
  type EmailPasswordConfig,
} from './plugins/email-password/plugin';
export { apiKeySchema } from './plugins/api-key/schema';
export {
  default as apiKeyPlugin,
  type ApiKeyConfig,
} from './plugins/api-key/plugin';

// Phone plugin
export { phonePasswordSchema } from './plugins/phone/schema';
export {
  basePhonePasswordPlugin,
  type PhonePasswordConfig,
} from './plugins/phone/plugin';

// Username plugin
export { usernamePasswordSchema } from './plugins/username/schema';
export {
  baseUsernamePasswordPlugin,
  type UsernamePasswordConfig,
} from './plugins/username/plugin';

// MCP plugin
export { mcpSchema } from './plugins/mcp/schema';
export {
  default as mcpPlugin,
  baseMcpPlugin,
  type MCPConfig,
} from './plugins/mcp/plugin';

// Two-Factor Authentication plugin
export { twoFactorAuthSchema } from './plugins/two-factor-auth/schema';
export {
  default as twoFactorAuthPlugin,
  baseTwoFactorAuthPlugin,
  type TwoFactorAuthConfig,
} from './plugins/two-factor-auth/plugin';

// OAuth plugin (third-party authentication)
export { oauthSchema } from './plugins/oauth/schema';
export {
  default as oauthPlugin,
  baseOAuthPlugin,
  createOAuthPlugin,
  type OAuthConfig,
  type OAuthProviderConfig,
  type OAuthUserProfile,
  type OAuthTokenResponse,
  type OAuthState,
} from './plugins/oauth';
export {
  createGoogleOAuthPlugin,
  type GoogleOAuthConfig,
} from './plugins/oauth/providers/google';
export {
  createGitHubOAuthPlugin,
  type GitHubOAuthConfig,
} from './plugins/oauth/providers/github';
// Email-or-username plugin
export {
  baseEmailOrUsernamePlugin,
  type EmailOrUsernameConfig,
} from './plugins/email-or-username/plugin';

// Organization plugin
export { organizationSchema } from './plugins/organization/schema';
export {
  default as organizationPlugin,
  baseOrganizationPlugin,
  type OrganizationConfig,
} from './plugins/organization/plugin';

// JWT plugin
export { jwtSchema } from './jwt.schema';
export {
  default as jwtPlugin,
  type JWTPluginConfig,
} from './plugins/jwt/plugin';

// JWT core functionality
export { EnhancedJWKSService } from './jwt-service';
export type {
  ReAuthJWTPayload,
  JWKSKey,
  EnhancedJWKSService as JWTService,
  ClientType,
  RotationReason,
  BlacklistReason,
} from './jwt.types';

export {
  createAuthPlugin,
  createAuthPluginLegacy,
} from './utils/create-plugin';

export type {
  FumaClient,
  SessionResolvers,
  SessionService,
  Subject,
  SubjectResolver,
  ReAuthCradle,
  AuthInput,
  AuthOutput,
} from './types';
