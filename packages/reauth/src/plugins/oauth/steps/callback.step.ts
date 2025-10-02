import { type } from 'arktype';
import * as arctic from 'arctic';
import type { AuthStep, AuthInput, AuthOutput, OrmLike } from '../../../types';
import type { OAuthPluginConfig, OAuthUserInfo } from '../types';
import { defaultUserInfoFetchers } from '../utils';
import { tokenType } from '../../../types';

export type CallbackOAuthInput = {
  code: string;
  state: string;
  oauth_state: string;
  oauth_code_verifier?: string;
  oauth_provider: string;
};

export const callbackOAuthValidation = type({
  code: 'string',
  state: 'string',
  oauth_state: 'string',
  'oauth_code_verifier?': 'string',
  oauth_provider: 'string',
});

export const callbackOAuthStep: AuthStep<
  OAuthPluginConfig,
  CallbackOAuthInput,
  AuthOutput
> = {
  name: 'callback',
  description: 'Handle OAuth callback and complete authentication',
  validationSchema: callbackOAuthValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 400, error: 500 },
    },
  },
  inputs: [
    'code',
    'state',
    'oauth_state',
    'oauth_code_verifier',
    'oauth_provider',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      email: 'string',
      name: 'string',
      picture: 'string',
      provider: 'string',
      verified: 'boolean',
    }),
  }),
  async run(input: CallbackOAuthInput, ctx): Promise<AuthOutput> {
    const { code, state, oauth_state, oauth_code_verifier, oauth_provider } =
      input;
    const orm = await ctx.engine.getOrm();

    try {
      // Verify state
      if (state !== oauth_state) {
        return {
          success: false,
          message: 'Invalid state parameter',
          status: 'error',
        };
      }

      // Find the provider configuration
      const provider = ctx.config.providers?.find(
        (p) => p.name === oauth_provider,
      );
      if (!provider) {
        return {
          success: false,
          message: `OAuth provider '${oauth_provider}' not configured`,
          status: 'ip',
        };
      }

      // Exchange code for tokens
      let tokens: any;
      if (provider.type === 'pkce') {
        if (!oauth_code_verifier) {
          return {
            success: false,
            message: 'Code verifier not found',
            status: 'ip',
          };
        }
        tokens = await provider.client.validateAuthorizationCode(
          code,
          oauth_code_verifier,
        );
      } else {
        tokens = await provider.client.validateAuthorizationCode(code);
      }

      const accessToken = tokens.accessToken();
      const idToken = tokens.idToken?.();

      // Get user info from provider
      const getUserInfo =
        provider.config.getUserInfo ||
        defaultUserInfoFetchers[provider.name.toLowerCase()];

      if (!getUserInfo) {
        throw new Error(`No getUserInfo function for ${provider.name}`);
      }

      const oauthUser = await getUserInfo(accessToken, idToken);

      // Check if OAuth account already exists
      const existingIdentity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('provider', '=', `${provider.name}-oauth`),
            b('identifier', '=', oauthUser.id),
          ),
      });

      let subjectId: string;
      let isNewAccount = false;

      if (existingIdentity) {
        // Account exists, use existing subject
        subjectId = existingIdentity.subject_id as string;

        // Update OAuth data
        await updateOAuthIdentity(orm, existingIdentity.id as string, {
          accessToken,
          idToken,
          oauthUser,
          provider: provider.name,
        });
      } else {
        // Check for existing account by email to link
        let existingSubjectByEmail: string | null = null;
        if (oauthUser.email) {
          const emailIdentity = await orm.findFirst('identities', {
            where: (b) =>
              b.and(
                b('provider', '=', 'email'),
                b('identifier', '=', oauthUser.email),
              ),
          });
          existingSubjectByEmail =
            (emailIdentity?.subject_id as string) || null;
        }

        if (existingSubjectByEmail) {
          // Link to existing account
          subjectId = existingSubjectByEmail as string;

          // Create OAuth identity linked to existing subject
          await createOAuthIdentity(orm, {
            subjectId,
            provider: provider.name,
            oauthUser,
            accessToken,
            idToken,
          });
        } else {
          // Create new account
          isNewAccount = true;
          const subject = await orm.create('subjects', {});
          subjectId = subject.id as string;

          // Create OAuth identity
          await createOAuthIdentity(orm, {
            subjectId,
            provider: provider.name,
            oauthUser,
            accessToken,
            idToken,
          });

          // Create email identity if email provided
          if (oauthUser.email) {
            await orm.create('identities', {
              subject_id: subjectId,
              provider: 'email',
              identifier: oauthUser.email,
              verified: oauthUser.verified_email || false,
            });
          }
        }
      }

      // Create session
      const ttl = ctx.config?.sessionTtlSeconds ?? 3600;
      const token = await ctx.engine.createSessionFor(
        'subject',
        subjectId,
        ttl,
      );

      const outSubject = {
        id: subjectId,
        email: oauthUser.email,
        name: oauthUser.name,
        picture: oauthUser.picture,
        provider: `${provider.name}-oauth`,
        verified: true, // OAuth accounts are considered verified
      };

      return {
        success: true,
        message: isNewAccount
          ? `${provider.name} account created successfully`
          : `${provider.name} login successful`,
        token,
        subject: outSubject,
        status: 'su',
      };
    } catch (error: any) {
      console.error(`${oauth_provider} OAuth callback error:`, error);
      return {
        success: false,
        message: `OAuth authentication failed: ${error.message}`,
        status: 'ip',
      };
    }
  },
};

/**
 * Helper to create OAuth identity record
 */
async function createOAuthIdentity(
  orm: OrmLike,
  params: {
    subjectId: string;
    provider: string;
    oauthUser: OAuthUserInfo;
    accessToken: string;
    idToken?: string;
  },
) {
  // Create base identity record
  const identity = await orm.create('identities', {
    subject_id: params.subjectId,
    provider: `${params.provider}-oauth`,
    identifier: params.oauthUser.id,
    verified: true, // OAuth accounts are verified
  });

  // Create OAuth-specific data
  await orm.create('oauth_identities', {
    identity_id: identity.id,
    provider: params.provider,
    provider_user_id: params.oauthUser.id,
    access_token: params.accessToken,
    refresh_token: params.idToken, // Store ID token as refresh token for simplicity
    provider_data: JSON.stringify(params.oauthUser),
  });
}

/**
 * Helper to update OAuth identity record
 */
async function updateOAuthIdentity(
  orm: OrmLike,
  identityId: string,
  params: {
    accessToken: string;
    idToken?: string;
    oauthUser: OAuthUserInfo;
    provider: string;
  },
) {
  // Update OAuth-specific data
  await orm.upsert('oauth_identities', {
    where: (b) => b('identity_id', '=', identityId),
    create: {
      identity_id: identityId,
      provider: params.provider,
      provider_user_id: params.oauthUser.id,
      access_token: params.accessToken,
      refresh_token: params.idToken,
      provider_data: JSON.stringify(params.oauthUser),
    },
    update: {
      access_token: params.accessToken,
      refresh_token: params.idToken,
      provider_data: JSON.stringify(params.oauthUser),
      updated_at: new Date(),
    },
  });
}
