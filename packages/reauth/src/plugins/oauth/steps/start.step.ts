import { type } from 'arktype';
import * as arctic from 'arctic';
import type { AuthStep, AuthInput, AuthOutput } from '../../../types';
import type { OAuthPluginConfig } from '../types';

export type StartOAuthInput = {
  provider: string;
};

export const startOAuthValidation = type({
  provider: 'string',
});

export const startOAuthStep: AuthStep<
  OAuthPluginConfig,
  'start',
  StartOAuthInput,
  AuthOutput
> = {
  name: 'start',
  description: 'Initiate OAuth flow',
  validationSchema: startOAuthValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { redirect: 302, success: 200, ip: 500, nf: 404 },
    },
  },
  inputs: ['provider'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'redirect?': ' string | undefined',
    'secret?': 'object | undefined',
  }),
  async run(input: StartOAuthInput, ctx): Promise<AuthOutput> {
    const { provider: providerName } = input;

    // Find the provider configuration
    const provider = ctx.config.providers?.find((p) => p.name === providerName);
    if (!provider) {
      return {
        success: false,
        message: `OAuth provider '${providerName}' not found`,
        status: 'nf', // not found - though we don't have this in codes mapping
      };
    }

    try {
      const client = provider.clientFactory(provider.config);
      const scopes = provider.config.scopes || provider.defaultScopes;

      const state = arctic.generateState();
      let url: string;
      const cookiesToSet: Record<string, string> = { oauth_state: state };

      if (provider.type === 'pkce') {
        const codeVerifier = arctic.generateCodeVerifier();
        url = client.createAuthorizationURL(state, codeVerifier, scopes);
        cookiesToSet.oauth_code_verifier = codeVerifier;
      } else {
        url = client.createAuthorizationURL(state, scopes);
      }

      cookiesToSet.oauth_provider = providerName;

      return {
        success: true,
        message: `Redirecting to ${providerName}`,
        redirect: url,
        status: 'redirect',
        secret: cookiesToSet,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to start ${providerName} OAuth flow: ${error.message}`,
        status: 'ip',
      };
    }
  },
};
