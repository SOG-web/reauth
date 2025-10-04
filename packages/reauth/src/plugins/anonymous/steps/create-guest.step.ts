import { type } from 'arktype';
import { createHash } from 'crypto';
import { type AuthStep, type AuthOutput, tokenType } from '../../../types';
import type { AnonymousConfig } from '../types';
import {
  generateFingerprint,
  calculateExpiresAt,
  canCreateGuestSession,
  cleanupExpiredSessions,
} from '../utils';
import { attachNewTokenIfDifferent } from '../../../utils/token-utils';

export type CreateGuestInput = {
  fingerprint?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, any>;
  others?: Record<string, any>;
};

export const createGuestValidation = type({
  fingerprint: 'string?',
  userAgent: 'string?',
  ip: 'string?',
  metadata: 'object?',
  'others?': 'object | undefined',
});

export const createGuestStep: AuthStep<
  AnonymousConfig,
  'create-guest',
  CreateGuestInput,
  AuthOutput
> = {
  name: 'create-guest',
  description: 'Create a new anonymous guest session',
  validationSchema: createGuestValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 201, ic: 400, tl: 429 },
    },
  },
  inputs: ['fingerprint', 'userAgent', 'ip', 'metadata', 'others'],
  outputs: type({
    success: 'boolean',
    message: 'string',
    status: 'string',
    'token?': tokenType,
    'subject?': type({
      id: 'string',
      type: 'string',
      fingerprint: 'string',
      temporary: 'boolean',
      expiresAt: 'string',
      metadata: 'object?',
    }),
    'guestId?': 'string',
    'expiresAt?': 'string',
    'others?': 'object | undefined',
  }),
  async run(input, ctx) {
    const { fingerprint, userAgent, ip, metadata, others } = input;
    const orm = await ctx.engine.getOrm();

    // Opportunistic cleanup of expired sessions
    try {
      await cleanupExpiredSessions(orm, ctx.config);
    } catch (error) {
      // Best effort cleanup; never block guest creation
    }

    // Generate or validate fingerprint
    const deviceFingerprint =
      fingerprint || generateFingerprint(userAgent, ip, { userAgent, ip });

    if (ctx.config?.fingerprintRequired !== false && !deviceFingerprint) {
      return {
        success: false,
        message: 'Device fingerprint is required for guest access',
        status: 'ic',
        others,
      };
    }

    // Hash fingerprint before any use/storage to ensure it is one-way & non-reversible
    // NOTE: We intentionally do not expose the raw fingerprint. The SHA-256 hash prevents
    // reversing to the original components (UA/IP/metadata). This value is used consistently
    // for rate limits and response payloads.
    const safeFingerprint = deviceFingerprint
      ? createHash('sha256').update(String(deviceFingerprint)).digest('hex')
      : undefined;

    // Check if this fingerprint can create more guest sessions
    const canCreate = await canCreateGuestSession(
      safeFingerprint as string,
      orm,
      ctx.config,
    );
    if (!canCreate) {
      return {
        success: false,
        message: 'Maximum number of guest sessions reached for this device',
        status: 'tl',
        others,
      };
    }

    // Generate unique guest subject ID
    const expiresAt = calculateExpiresAt(ctx.config);

    try {
      // Create subject record for the guest
      const subject = await orm.create('subjects', {});

      // Track this subject as created by anonymous plugin for safe cleanup
      await orm.create('anonymous_subjects', {
        subject_id: subject.id,
      });

      // Create anonymous session record (store only hashed fingerprint)
      await orm.create('anonymous_sessions', {
        subject_id: subject.id,
        fingerprint: safeFingerprint,
        metadata: metadata || null,
        extension_count: 0,
        expires_at: expiresAt,
      });

      // Create session token
      const ttl = ctx.config?.sessionTtlSeconds ?? 1800;
      const subjectId = String(subject.id);
      const token = await ctx.engine.createSessionFor('guest', subjectId, ttl);

      const guestSubject = {
        id: subjectId,
        type: 'guest',
        // Exposing hashed fingerprint only (non-reversible)
        fingerprint: safeFingerprint as string,
        temporary: true,
        expiresAt: expiresAt.toISOString(),
        metadata: metadata || {},
      };

      const baseResult = {
        success: true,
        message: 'Guest session created successfully',
        status: 'su',
        subject: guestSubject,
        guestId: subjectId,
        expiresAt: expiresAt.toISOString(),
        others,
      };

      return attachNewTokenIfDifferent(baseResult, undefined as any, token);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create guest session',
        status: 'ic',
        others,
      };
    }
  },
};
