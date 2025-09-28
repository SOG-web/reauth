import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { AnonymousConfig } from '../types';

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

export const convertGuestStep: AuthStep<
  AnonymousConfig,
  ConvertGuestInput,
  AuthOutput
> = {
  name: 'convert-guest',
  description:
    'Convert an anonymous guest session to a registered user account',
  validationSchema: convertGuestValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ip: 401, ic: 400, unf: 404 },
      auth: true,
    },
  },
  inputs: [
    'token',
    'conversionData',
    'targetPlugin',
    'preserveMetadata',
    'others',
  ],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'error?': 'string | object',
    'token?': 'string',
    'subject?': type({
      id: 'string',
      type: 'string',
      convertedFrom: 'string',
      targetPlugin: 'string',
      temporary: 'boolean',
      metadata: 'object?',
    }),
    'convertedTo?': 'string',
    'preservedMetadata?': type({
      id: 'string',
      type: 'string',
      convertedFrom: 'string',
      targetPlugin: 'string',
      temporary: 'boolean',
      metadata: 'object?',
    }),
    'others?': 'object',
  }),
  async run(input, ctx) {
    const {
      token,
      conversionData,
      targetPlugin,
      preserveMetadata = false,
      others,
    } = input;
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
      // Validate target plugin against allowed list (if configured)
      const allowed = ctx.config?.allowedConversionPlugins;
      if (Array.isArray(allowed) && !allowed.includes(targetPlugin)) {
        return {
          success: false,
          message: `Target plugin '${targetPlugin}' is not allowed for conversion`,
          status: 'ic',
          others,
        };
      }

      // Ensure target plugin is registered
      const plugin = ctx.engine.getPlugin
        ? ctx.engine.getPlugin(targetPlugin)
        : undefined;
      if (!plugin) {
        return {
          success: false,
          message: `Target plugin '${targetPlugin}' is not available`,
          status: 'unf',
          others,
        };
      }

      // Prepare metadata for preservation
      let metadata = null as any;
      if (preserveMetadata && anonymousSession.metadata) {
        metadata =
          typeof anonymousSession.metadata === 'string'
            ? JSON.parse(anonymousSession.metadata)
            : anonymousSession.metadata;
      }

      // Use developer-provided conversion target configuration
      const configTargets = ctx.config?.conversionTargets;
      const targetDef = configTargets ? configTargets[targetPlugin] : undefined;
      if (!targetDef || !targetDef.step) {
        return {
          success: false,
          message: `No conversion target config provided for plugin '${targetPlugin}'`,
          status: 'ic',
          others,
        };
      }

      // Validate incoming conversionData if a schema is provided
      if (targetDef.inputValidation) {
        try {
          targetDef.inputValidation.assert(conversionData as unknown);
        } catch (e) {
          return {
            success: false,
            message: `Invalid conversion data: ${String(e)}`,
            status: 'ic',
            others,
          };
        }
      }

      // Ensure the configured step exists on the target plugin
      const stepExists =
        Array.isArray(plugin.steps) &&
        plugin.steps.some(
          (s) => s && typeof s === 'object' && s.name === targetDef.step,
        );
      if (!stepExists) {
        return {
          success: false,
          message: `Configured step '${targetDef.step}' not found on plugin '${targetPlugin}'`,
          status: 'unf',
          others,
        };
      }

      // Map input for the target step
      let mappedInput;
      try {
        mappedInput = targetDef.mapInput
          ? await targetDef.mapInput({
              conversionData: conversionData || {},
              guest: { id: subjectId, metadata },
              ctx: ctx,
            })
          : { ...(conversionData || {}), others };
      } catch (error) {
        return {
          success: false,
          message: `Failed to map input for conversion: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'ic',
          others,
        };
      }

      let regOut;
      try {
        regOut = await ctx.engine.executeStep(
          targetPlugin,
          targetDef.step,
          mappedInput,
        );
      } catch (error) {
        return {
          success: false,
          message: `Target step execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'ic',
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          others,
        };
      }
      // Expect conventional shape; fallback to generic failure
      if (!regOut || regOut.success !== true) {
        return {
          success: false,
          message:
            regOut?.message ||
            `Conversion failed in target plugin '${targetPlugin}' via '${targetDef.step}'`,
          status: regOut?.status || 'ic',
          error: regOut?.error,
          others,
        };
      }

      const newSubjectId: string | undefined = targetDef.extract?.subjectId
        ? targetDef.extract.subjectId(regOut)
        : (regOut.subject?.id ?? regOut.subjectId);
      if (!newSubjectId) {
        return {
          success: false,
          message: 'Conversion failed: target step did not return a subject id',
          status: 'ic',
          others,
        };
      }

      // Clean up the anonymous session for the old guest subject
      await orm.deleteMany('anonymous_sessions', {
        where: (b: any) => b('subject_id', '=', subjectId),
      });
      await orm.deleteMany('anonymous_subjects', {
        where: (b: any) => b('subject_id', '=', subjectId),
      });

      // Determine session token: prefer target plugin's token, otherwise create one
      const registeredTtl = 3600; // default 1 hour
      const extractedToken = targetDef.extract?.token
        ? targetDef.extract.token(regOut)
        : (regOut.token as string | null | undefined);
      const newToken =
        extractedToken ??
        (await ctx.engine.createSessionFor(
          'subject',
          newSubjectId,
          registeredTtl,
        ));

      const convertedSubject = {
        id: newSubjectId,
        type: 'registered',
        convertedFrom: 'guest',
        targetPlugin,
        temporary: false,
        metadata: preserveMetadata ? metadata : undefined,
      };

      return {
        success: true,
        message:
          regOut.message ||
          `Guest successfully converted to ${targetPlugin} user via '${targetDef.step}'`,
        status: regOut.status || 'su',
        token: newToken,
        subject: convertedSubject,
        convertedTo: targetPlugin,
        preservedMetadata: preserveMetadata ? metadata : undefined,
        others: { ...others, from: 'anonymous-convert', target: targetPlugin },
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
