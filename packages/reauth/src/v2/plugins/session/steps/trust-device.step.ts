import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { createSessionStorage } from '../utils';

export type TrustDeviceInput = {
  token: string; // Required for authentication
  sessionId?: string; // Optional specific session ID (defaults to current session)
  trusted: boolean; // Whether to trust or untrust the device
  deviceName?: string; // Optional user-friendly device name
  others?: Record<string, any>;
};

export const trustDeviceValidation = type({
  token: 'string',
  sessionId: 'string?',
  trusted: 'boolean',
  deviceName: 'string?',
  others: 'object?',
});

export type TrustDeviceOutput = AuthOutput & {
  sessionId?: string;
  deviceTrusted?: boolean;
  deviceName?: string;
  updatedAt?: string;
};

export const trustDeviceStep: AuthStepV2<
  TrustDeviceInput,
  TrustDeviceOutput,
  SessionConfigV2
> = {
  name: 'trust-device',
  description: 'Mark a device as trusted or untrusted for the session',
  validationSchema: trustDeviceValidation,
  protocol: {
    http: {
      method: 'PATCH',
      codes: { unf: 401, nf: 404, su: 200, ic: 400, denied: 403, disabled: 409 },
    },
  },
  inputs: ['token', 'sessionId', 'trusted', 'deviceName', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'sessionId?': 'string',
    'deviceTrusted?': 'boolean',
    'deviceName?': 'string',
    'updatedAt?': 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { token, sessionId, trusted, deviceName, others } = input;
    const orm = await ctx.engine.getOrm();
    const storage = createSessionStorage(ctx.config || {}, orm);
    const config = ctx.config || {};

    try {
      // Check if device tracking is enabled
      if (config.deviceTrackingEnabled === false) {
        return {
          success: false,
          message: 'Device tracking is disabled',
          status: 'disabled',
          error: 'Device tracking must be enabled to trust/untrust devices',
          others,
        };
      }

      // Verify the session to get user info
      const sessionService = ctx.engine.getSessionService();
      const { subject } = await sessionService.verifySession(token);
      
      if (!subject) {
        return {
          success: false,
          message: 'Authentication required',
          status: 'unf',
          error: 'Invalid or expired session',
          others,
        };
      }

      // Get current session ID from token
      const currentSession = await orm.findFirst('sessions', {
        where: (b: any) => b('token', '=', token),
      });
      const currentSessionId = currentSession?.id;

      // Determine target session ID (current session if not specified)
      const targetSessionId = sessionId || currentSessionId;
      
      if (!targetSessionId) {
        return {
          success: false,
          message: 'Session ID required',
          status: 'ic',
          error: 'Could not determine session ID',
          others,
        };
      }

      // Get session info to verify ownership
      const session = await storage.getSession(targetSessionId);
      if (!session) {
        return {
          success: false,
          message: 'Session not found',
          status: 'nf',
          error: 'The specified session does not exist',
          others,
        };
      }

      // Verify the user owns the session
      if (session.subjectType !== (subject.type || 'subject') || 
          session.subjectId !== subject.id) {
        return {
          success: false,
          message: 'Permission denied',
          status: 'denied',
          error: 'You can only modify trust for your own devices',
          others,
        };
      }

      // Get existing device data
      let device = await storage.getDevice(targetSessionId);
      
      if (!device) {
        // If no device data exists, we can't trust/untrust it
        return {
          success: false,
          message: 'No device data found',
          status: 'nf',
          error: 'Device information not available for this session',
          others,
        };
      }

      // Update device trust status and name
      const updates: any = {
        isTrusted: trusted,
        lastSeenAt: new Date(),
      };

      if (deviceName !== undefined) {
        updates.deviceName = deviceName;
      }

      await storage.updateDevice(targetSessionId, updates);

      const updatedAt = new Date();

      return {
        success: true,
        message: trusted 
          ? 'Device marked as trusted' 
          : 'Device marked as untrusted',
        status: 'su',
        sessionId: targetSessionId,
        deviceTrusted: trusted,
        deviceName: deviceName || device.deviceName,
        updatedAt: updatedAt.toISOString(),
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update device trust',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};