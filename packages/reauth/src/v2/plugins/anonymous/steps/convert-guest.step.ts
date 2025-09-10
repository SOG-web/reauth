import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { AnonymousConfigV2 } from '../types';

export type ConvertGuestInput = {
  token: string;
  conversionData: Record<string, any>; // Data needed for conversion (email, phone, etc.)
  targetPlugin: string; // The plugin to convert to (e.g., 'email-password')
  preserveMetadata?: boolean; // Whether to preserve guest metadata
  others?: Record<string, any>;
};

export const convertGuestValidation = type({
  token: 'string',
  conversionData: 'object',
  targetPlugin: 'string',
  preserveMetadata: 'boolean?',
  others: 'object?',
});

export const convertGuestStep: AuthStepV2<
  ConvertGuestInput,
  AuthOutput,
  AnonymousConfigV2
> = {
  name: 'convert-guest',
  description: 'Convert an anonymous guest session to a registered user account',
  validationSchema: convertGuestValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: ['token', 'conversionData', 'targetPlugin', 'preserveMetadata', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': 'string',
    'subject?': 'object',
    'convertedTo?': 'string',
    'preservedMetadata?': 'object',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, conversionData, targetPlugin, preserveMetadata = false, others } = input;
    const orm = await ctx.engine.getOrm();

    // Verify the current session
    const sessionCheck = await ctx.engine.checkSession(token);
    if (!sessionCheck.valid || !sessionCheck.subject) {
      return {
        success: false,
        message: 'Invalid or expired session',
        status: 'ip',
        others,
      };
    }

    const subjectId = sessionCheck.subject.id;

    // Check if this is a guest session
    const anonymousSession = await orm.findFirst('anonymous_sessions', {
      where: (b: any) => b('subject_id', '=', subjectId),
    });

    if (!anonymousSession) {
      return {
        success: false,
        message: 'Session is not a guest session',
        status: 'ic',
        others,
      };
    }

    // Check if session has not already expired
    if (new Date() > new Date(anonymousSession.expires_at as string)) {
      return {
        success: false,
        message: 'Session has already expired',
        status: 'ip',
        others,
      };
    }

    try {
      // Prepare metadata for preservation
      let metadata = null;
      if (preserveMetadata && anonymousSession.metadata) {
        metadata = typeof anonymousSession.metadata === 'string' 
          ? JSON.parse(anonymousSession.metadata)
          : anonymousSession.metadata;
      }

      // Note: In a real implementation, you would call the target plugin's registration step
      // This is a simplified conversion that just marks the subject as converted
      // The actual conversion logic would depend on the target plugin's API

      // Update subject to mark as converted (this is plugin-specific logic)
      await (orm as any).updateMany('subjects', {
        where: (b: any) => b('id', '=', subjectId),
        set: {
          // Add any conversion-specific fields here
          converted_from_guest: true,
          conversion_target: targetPlugin,
          conversion_data: conversionData,
          guest_metadata: metadata,
          updated_at: new Date(),
        },
      });

      // Clean up the anonymous session
      await orm.deleteMany('anonymous_sessions', {
        where: (b: any) => b('subject_id', '=', subjectId),
      });

      // Create a new session with appropriate TTL for registered users
      const registeredTtl = 3600; // 1 hour for registered users (vs 30 min for guests)
      const newToken = await ctx.engine.createSessionFor('subject', subjectId, registeredTtl);

      const convertedSubject = {
        id: subjectId,
        type: 'registered',
        convertedFrom: 'guest',
        targetPlugin,
        temporary: false,
        metadata: preserveMetadata ? metadata : undefined,
      };

      return {
        success: true,
        message: `Guest successfully converted to ${targetPlugin} user`,
        status: 'su',
        token: newToken,
        subject: convertedSubject,
        convertedTo: targetPlugin,
        preservedMetadata: preserveMetadata ? metadata : undefined,
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to convert guest session',
        status: 'ic',
        others,
      };
    }
  },
};