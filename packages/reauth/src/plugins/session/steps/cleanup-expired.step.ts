import { type } from 'arktype';
import type { AuthStep, AuthOutput } from '../../../types';
import type { SessionConfig } from '../types';

export type CleanupExpiredInput = {
  retentionDays?: number;
  batchSize?: number;
  others?: Record<string, any>;
};

export const cleanupExpiredValidation = type({
  retentionDays: 'number?',
  batchSize: 'number?',
  'others?': 'object | undefined',
});

export type CleanupExpiredOutput = AuthOutput & {
  cleaned?: {
    sessionsDeleted: number;
    devicesDeleted: number;
    metadataDeleted: number;
    totalCleaned: number;
  };
  retentionDays?: number;
  batchSize?: number;
  cleanupTime?: string;
};

export const cleanupExpiredStep: AuthStep<
  SessionConfig,
  'cleanup-expired',
  CleanupExpiredInput,
  CleanupExpiredOutput
> = {
  name: 'cleanup-expired',
  description: 'Clean up expired sessions, devices, and metadata',
  validationSchema: cleanupExpiredValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, disabled: 409 },
    },
  },
  inputs: ['retentionDays', 'batchSize', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    'error?': 'string | object',
    status: 'string',
    'cleaned?': 'object',
    'cleanupTime?': 'string',
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { retentionDays, batchSize, others } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config || {};
    const startTime = new Date();

    try {
      // Check if cleanup is enabled
      //TODO: fix
      const sessionService = ctx.engine.getSessionService();

      // Perform cleanup
      const result = {} as any;

      const totalCleaned =
        result.sessionsDeleted + result.devicesDeleted + result.metadataDeleted;
      const endTime = new Date();
      const cleanupDuration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        message: `Cleanup completed: ${totalCleaned} items cleaned in ${cleanupDuration}ms`,
        status: 'su',
        cleaned: {
          sessionsDeleted: result.sessionsDeleted,
          devicesDeleted: result.devicesDeleted,
          metadataDeleted: result.metadataDeleted,
          totalCleaned,
        },
        cleanupTime: endTime.toISOString(),
        others,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Cleanup failed',
        status: 'ic',
        error: error instanceof Error ? error.message : 'Unknown error',
        others,
      };
    }
  },
};
