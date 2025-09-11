import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { SessionConfigV2 } from '../types';
import { cleanupExpiredSessionData, createSessionManager } from '../utils';

export type CleanupExpiredInput = {
  retentionDays?: number;
  batchSize?: number;
  others?: Record<string, any>;
};

export const cleanupExpiredValidation = type({
  retentionDays: 'number?',
  batchSize: 'number?',
  others: 'object?',
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

export const cleanupExpiredStep: AuthStepV2<
  CleanupExpiredInput,
  CleanupExpiredOutput,
  SessionConfigV2
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
    'retentionDays?': 'number',
    'batchSize?': 'number',
    'cleanupTime?': 'string',
    'others?': 'object',
  }),
  async run(input, ctx) {
    const { retentionDays, batchSize, others } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config || {};
    const startTime = new Date();

    try {
      // Check if cleanup is enabled
      if (config.cleanupEnabled === false) {
        return {
          success: false,
          message: 'Cleanup is disabled',
          status: 'disabled',
          error: 'Session cleanup is disabled in configuration',
          others,
        };
      }

      const manager = createSessionManager(config, orm);

      // Use provided values or fall back to config defaults
      const effectiveRetentionDays =
        retentionDays ?? config.sessionRetentionDays ?? 7;
      const effectiveBatchSize = batchSize ?? config.cleanupBatchSize ?? 100;

      // Validate parameters
      if (effectiveRetentionDays < 1) {
        return {
          success: false,
          message: 'Invalid retention days',
          status: 'ic',
          error: 'Retention days must be at least 1',
          others,
        };
      }

      if (effectiveBatchSize < 1 || effectiveBatchSize > 1000) {
        return {
          success: false,
          message: 'Invalid batch size',
          status: 'ic',
          error: 'Batch size must be between 1 and 1000',
          others,
        };
      }

      // Perform cleanup
      const result = await cleanupExpiredSessionData(manager, {
        ...config,
        sessionRetentionDays: effectiveRetentionDays,
        cleanupBatchSize: effectiveBatchSize,
      });

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
        retentionDays: effectiveRetentionDays,
        batchSize: effectiveBatchSize,
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
