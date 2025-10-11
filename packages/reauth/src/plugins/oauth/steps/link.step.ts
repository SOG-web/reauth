import { type } from 'arktype';
import * as arctic from 'arctic';
import type { AuthStep, AuthInput, AuthOutput, OrmLike } from '../../../types';
import type { OAuthPluginConfig } from '../types';
import { defaultUserInfoFetchers } from '../utils';

export type LinkOAuthInput = {
  code: string;
  state: string;
  oauth_state: string;
  oauth_code_verifier?: string;
  oauth_provider: string;
  entity: any;
};

export const linkOAuthValidation = type({
  code: 'string',
  state: 'string',
  oauth_state: 'string',
  'oauth_code_verifier?': 'string',
  oauth_provider: 'string',
  'entity?': 'object',
});

export const linkOAuthStep: AuthStep<
  OAuthPluginConfig,
  'link',
  LinkOAuthInput,
  AuthOutput
> = {
  name: 'link',
  description: 'Link OAuth account to existing user',
  validationSchema: linkOAuthValidation,
  protocol: {
    http: {
      method: 'POST',
      auth: true, // Requires authentication
      codes: { su: 200, ip: 400, cf: 409 },
    },
  },
  inputs: [
    'code',
    'state',
    'oauth_state',
    'oauth_code_verifier',
    'oauth_provider',
    'entity',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'entity?': 'object',
  }),
  async run(input: LinkOAuthInput, ctx): Promise<AuthOutput> {
    const {
      code,
      state,
      oauth_state,
      oauth_code_verifier,
      oauth_provider,
      entity,
    } = input;
    const orm = await ctx.engine.getOrm();

    try {
      if (!entity) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'ip',
        };
      }

      // Verify state
      if (state !== oauth_state) {
        return {
          success: false,
          message: 'Invalid state parameter',
          status: 'ip',
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

      // Check if OAuth account is already linked to another user
      const existingIdentity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('provider', '=', `${provider.name}-oauth`),
            b('identifier', '=', oauthUser.id),
          ),
      });

      if (existingIdentity && existingIdentity.subject_id !== entity.id) {
        return {
          success: false,
          message: `${provider.name} account is already linked to another user`,
          status: 'cf',
        };
      }

      if (existingIdentity && existingIdentity.subject_id === entity.id) {
        return {
          success: false,
          message: `${provider.name} account is already linked to this user`,
          status: 'cf',
        };
      }

      // Create OAuth identity linked to current user
      const identity = await orm.create('identities', {
        subject_id: entity.id,
        provider: `${provider.name}-oauth`,
        identifier: oauthUser.id,
        verified: true,
      });

      // Create OAuth-specific data
      await orm.create('oauth_identities', {
        identity_id: identity.id,
        provider: provider.name,
        provider_user_id: oauthUser.id,
        access_token: accessToken,
        refresh_token: idToken,
        provider_data: JSON.stringify(oauthUser),
      });

      // Get updated subject info
      const updatedEntity = await orm.findFirst('subjects', {
        where: (b) => b('id', '=', entity.id),
      });

      const serializedEntity = updatedEntity
        ? {
            id: updatedEntity.id,
            ...updatedEntity,
          }
        : entity;

      return {
        success: true,
        message: `${provider.name} account linked successfully`,
        entity: serializedEntity,
        status: 'su',
      };
    } catch (error: any) {
      const logger = ctx.engine.getContainer().resolve('logger');
      logger.error('oauth', `${oauth_provider} OAuth link error`, {
        error,
        provider: oauth_provider,
      });
      return {
        success: false,
        message: `Failed to link ${oauth_provider} account: ${error.message}`,
        status: 'ip',
      };
    }
  },
};
