import { type } from 'arktype';
import { AuthOutput, AuthStep, Token, tokenType } from '../../../types';
import { JWTPluginConfig } from '../../../services';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type RegisterClientInput = {
  client_type: 'public' | 'confidential';
  name: string;
  description?: string;
  is_active?: boolean;
  others?: Record<string, any>;
  token: Token;
};

export const registerClientValidation = type({
  client_type: 'string',
  name: 'string',
  description: 'string?',
  is_active: 'boolean?',
  'others?': 'object | undefined',
  token: tokenType,
});

export type RegisterClientOutput = {
  client?: {
    id: string;
    client_secret: string;
    name: string;
    description?: string;
    is_active?: boolean;
  };
} & AuthOutput;

export const registerClientStep: AuthStep<
  JWTPluginConfig,
  RegisterClientInput,
  RegisterClientOutput
> = {
  name: 'register-client',
  description: 'Register a new client',
  validationSchema: registerClientValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unf: 404, eq: 409 },
      auth: true,
    },
  },
  inputs: [
    'client_type',
    'name',
    'description',
    'is_active',
    'others',
    'token',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'client?': type({
      id: 'string',
      client_secret: 'string',
      name: 'string',
      description: 'string?',
      is_active: 'boolean?',
    }),
    'others?': 'object | undefined',
    token: tokenType,
  }),
  run: async (input, ctx) => {
    const others = input.others || {};
    const session = await ctx.engine.checkSession(input.token);

    if (!session || !session.subject) {
      return {
        success: false,
        status: 'ip',
        message: 'Invalid session',
        others,
      };
    }

    try {
      const sessionService = ctx.engine.getSessionService();
      const jwksService = sessionService.getJwkService();

      if (!jwksService) {
        return attachNewTokenIfDifferent(
          {
            success: false,
            status: 'ic',
            message: 'JWT functionality not enabled',
            others,
          },
          input.token,
          session.token,
        );
      }

      const new_client = await jwksService.registerClient({
        clientType: input.client_type,
        name: input.name,
        description: input.description,
        isActive: input.is_active,
        subjectId: session.subject.id as string,
      });

      delete new_client.client.clientSecretHash;

      return attachNewTokenIfDifferent(
        {
          success: true,
          status: 'su',
          message: 'JWKS retrieved successfully',
          client: {
            ...new_client.client,
            client_secret: new_client.apiKey,
          },
          others,
        },
        input.token,
        session.token,
      );
    } catch (error) {
      return attachNewTokenIfDifferent(
        {
          success: false,
          status: 'ic',
          message:
            error instanceof Error ? error.message : 'Failed to retrieve JWKS',
          others,
        },
        input.token,
        session.token,
      );
    }
  },
};
