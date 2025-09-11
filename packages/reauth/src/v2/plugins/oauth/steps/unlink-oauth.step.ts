import { type } from 'arktype';
import type { AuthStepV2, OrmLike } from '../../../../types.v2';
import type { OAuthConfigV2 } from '../types';
import { getOAuthProvider } from '../utils';

export const unlinkOAuthStep: AuthStepV2<
  typeof unlinkOAuthInputSchema.infer,
  typeof unlinkOAuthOutputSchema.infer,
  OAuthConfigV2,
  OrmLike
> = {
  name: 'unlink-oauth',
  inputs: type({
    provider: 'string',
    'token?': 'string',
  }),
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'unlinkedProvider?': 'string',
  }),
  protocol: {
    type: 'oauth-unlink',
    description: 'Remove OAuth provider from user account',
    method: 'DELETE',
    path: '/oauth/unlink',
    requiresAuth: true,
  },
  
  async handler(input, { orm, config, container }) {
    const { provider, token } = input;
    
    try {
      // Verify user is authenticated
      if (!token) {
        return {
          success: false,
          message: 'Authentication required for unlinking OAuth account',
          status: 'authentication_required',
        };
      }

      // Verify session and get current user
      const sessionService = container.resolve('sessionService');
      const sessionResult = await sessionService.verifySession(token);
      if (!sessionResult.subject) {
        return {
          success: false,
          message: 'Invalid session token',
          status: 'invalid_session',
        };
      }

      const currentSubjectId = sessionResult.subject.id;

      // Get provider configuration
      const oauthProvider = await getOAuthProvider(orm, provider);
      if (!oauthProvider) {
        return {
          success: false,
          message: `OAuth provider '${provider}' not found or inactive`,
          status: 'provider_not_found',
        };
      }

      // Check if user has this provider linked
      const linkedProfile = await orm.findFirst('oauth_profiles', {
        where: (b: any) => b('subject_id', '=', currentSubjectId)
          .and(b('provider_id', '=', oauthProvider.id)),
      });

      if (!linkedProfile) {
        return {
          success: false,
          message: `No ${provider} account linked to your account`,
          status: 'provider_not_linked',
        };
      }

      // Check if this is the only authentication method for the user
      // Count total authentication methods (passwords, OAuth providers, etc.)
      const oauthCount = await orm.count('oauth_profiles', {
        where: (b: any) => b('subject_id', '=', currentSubjectId),
      });

      const emailIdentityCount = await orm.count('email_identities', {
        where: (b: any) => b('identity_id', '=', currentSubjectId),
      });

      // If this is their only auth method, don't allow unlinking
      if (oauthCount === 1 && emailIdentityCount === 0) {
        return {
          success: false,
          message: 'Cannot unlink your only authentication method. Please add a password or link another account first.',
          status: 'last_auth_method',
        };
      }

      // Remove OAuth profile and tokens
      await orm.delete('oauth_profiles', {
        where: (b: any) => b('id', '=', linkedProfile.id),
      });

      await orm.delete('oauth_tokens', {
        where: (b: any) => b('subject_id', '=', currentSubjectId)
          .and(b('provider_id', '=', oauthProvider.id)),
      });

      return {
        success: true,
        message: `${provider} account unlinked successfully`,
        status: 'oauth_unlinked',
        unlinkedProvider: provider,
      };
    } catch (error) {
      console.error('OAuth unlinking error:', error);
      return {
        success: false,
        message: 'Failed to unlink OAuth account',
        status: 'oauth_unlinking_failed',
      };
    }
  },
};

const unlinkOAuthInputSchema = unlinkOAuthStep.inputs;
const unlinkOAuthOutputSchema = unlinkOAuthStep.outputs;