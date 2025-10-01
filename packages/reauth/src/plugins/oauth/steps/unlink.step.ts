import { type } from 'arktype';
import type { AuthStep, AuthInput, AuthOutput, OrmLike } from '../../../types';
import type { OAuthPluginConfig } from '../types';

export type UnlinkOAuthInput = {
  provider: string;
  entity: any;
};

export const unlinkOAuthValidation = type({
  provider: 'string',
  entity: 'object',
});

export const unlinkOAuthStep: AuthStep<
  OAuthPluginConfig,
  UnlinkOAuthInput,
  AuthOutput
> = {
  name: 'unlink',
  description: 'Unlink OAuth account from user',
  validationSchema: unlinkOAuthValidation,
  protocol: {
    http: {
      method: 'POST',
      auth: true, // Requires authentication
      codes: { su: 200, ip: 400, nf: 404 },
    },
  },
  inputs: ['provider', 'entity'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'entity?': 'object',
  }),
  async run(input: UnlinkOAuthInput, ctx): Promise<AuthOutput> {
    const { provider: providerName, entity } = input;
    const orm = await ctx.engine.getOrm();

    try {
      if (!entity) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'ip',
        };
      }

      // Find the OAuth identity for this user and provider
      const identity = await orm.findFirst('identities', {
        where: (b) =>
          b.and(
            b('subject_id', '=', entity.id),
            b('provider', '=', `${providerName}-oauth`)
          ),
      });

      if (!identity) {
        return {
          success: false,
          message: `${providerName} account is not linked`,
          status: 'nf',
        };
      }

      // Remove OAuth identity data
      await orm.deleteMany('oauth_identities', {
        where: (b) => b('identity_id', '=', identity.id),
      });

      // Remove the identity record
      await orm.deleteMany('identities', {
        where: (b) => b('id', '=', identity.id),
      });

      // Get updated subject info
      const updatedEntity = await orm.findFirst('subjects', {
        where: (b) => b('id', '=', entity.id),
      });

      const serializedEntity = updatedEntity ? {
        id: updatedEntity.id,
        ...updatedEntity,
      } : entity;

      return {
        success: true,
        message: `${providerName} account unlinked successfully`,
        entity: serializedEntity,
        status: 'su',
      };
    } catch (error: any) {
      console.error(`${providerName} OAuth unlink error:`, error);
      return {
        success: false,
        message: `Failed to unlink ${providerName} account: ${error.message}`,
        status: 'ip',
      };
    }
  },
};
