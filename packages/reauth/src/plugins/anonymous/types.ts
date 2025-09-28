import type { Type } from 'arktype';
import type { StepContext } from '../../types';

export type ConversionTargetDefinition = {
  // Name of the step to call for conversion in the target plugin (e.g., 'register').
  step: string;
  // Optional validation for the incoming conversionData payload from the client.
  inputValidation?: Type<any>;
  // Map incoming conversionData and guest info to the exact input expected by the target step.
  mapInput?: (args: {
    conversionData: Record<string, any>;
    guest: { id: string; metadata?: any };
    ctx: StepContext<AnonymousConfig>;
  }) => Promise<Record<string, any>> | Record<string, any>;
  // Extract fields from the target step output.
  extract?: {
    subjectId?: (output: any) => string | undefined;
    token?: (output: any) => string | undefined;
  };
};
export type AnonymousConfig = {
  sessionTtlSeconds?: number; // default shorter than regular sessions (e.g., 1800 = 30 minutes)
  maxGuestsPerFingerprint?: number; // limit concurrent guests per device (default 3)
  guestDataRetentionDays?: number; // how long to keep guest data (default 7 days)
  guestSubjectRetentionDays?: number; // how long to keep orphaned guest subjects (default same as guestDataRetentionDays)
  allowSessionExtension?: boolean; // whether guests can extend their session (default true)
  maxSessionExtensions?: number; // max number of extensions per session (default 3)
  fingerprintRequired?: boolean; // whether device fingerprint is required (default true)
  cleanupIntervalMs?: number; // how often to run cleanup in background (default 300000 = 5 minutes)
  enableBackgroundCleanup?: boolean; // whether to enable automatic background cleanup (default true)
  // List of plugin names allowed as conversion targets (e.g., ['email-password','username','phone','email-or-username'])
  allowedConversionPlugins?: string[];
  // Configuration for each target plugin defining how conversion should be performed.
  // Key is the target plugin name.
  conversionTargets?: Record<string, ConversionTargetDefinition>;
};
