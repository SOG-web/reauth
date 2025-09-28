import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2, ListMethodsInput, ListMethodsOutput } from '../types';

export const listMethodsValidation = type({
  userId: 'string',
});

export const listMethodsStep: AuthStepV2<
  ListMethodsInput,
  ListMethodsOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'list-methods',
  description: 'List enabled 2FA methods for user',
  validationSchema: listMethodsValidation,
  protocol: {
    http: {
      method: 'GET',
      codes: { su: 200, ic: 400 },
    },
  },
  inputs: ['userId'],
  outputs: type({
    methods: 'object[]',
  }),

  async run(input, ctx) {
    const { userId } = input;
    const orm = await ctx.engine.getOrm();

    try {
      // Get all 2FA methods for the user
      const methods = await orm.findMany('two_factor_methods', {
        where: (b: any) => b('user_id', '=', userId),
        orderBy: [['created_at', 'desc']],
      });

      // Transform methods for safe output (mask sensitive data)
      const safeMethods = methods.map((method: any) => ({
        id: method.id,
        methodType: method.method_type,
        isPrimary: method.is_primary,
        isVerified: method.is_verified,
        lastUsedAt: method.last_used_at,
        maskedIdentifier: maskSensitiveIdentifier(method),
        createdAt: method.created_at,
      }));

      return {
        methods: safeMethods,
        success: true,
        message: `Found ${safeMethods.length} 2FA methods`,
        status: 'su',
      } as ListMethodsOutput & AuthOutput;

    } catch (error) {
      return {
        methods: [],
        success: false,
        message: `Failed to list 2FA methods: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'ic',
      } as ListMethodsOutput & AuthOutput;
    }
  },
};

/**
 * Mask sensitive identifiers for safe display
 */
function maskSensitiveIdentifier(method: any): string | undefined {
  if (method.method_type === 'totp') {
    return 'Authenticator App';
  } else if (method.method_type === 'sms' && method.phone_number_encrypted) {
    // In production, decrypt first then mask
    const phone = method.phone_number_encrypted; // TODO: Decrypt
    return phone.length > 4 ? `***-***-${phone.slice(-4)}` : '***-***';
  } else if (method.method_type === 'email' && method.email_encrypted) {
    // In production, decrypt first then mask
    const email = method.email_encrypted; // TODO: Decrypt
    const [localPart, domain] = email.split('@');
    if (localPart && domain) {
      const maskedLocal = localPart.length > 2 ? 
        `${localPart.charAt(0)}***${localPart.slice(-1)}` : 
        '***';
      return `${maskedLocal}@${domain}`;
    }
    return '***@***';
  } else if (method.method_type === 'hardware') {
    return `Security Key (${method.name || 'Unnamed'})`;
  }
  
  return undefined;
}