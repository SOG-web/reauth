import { AwilixContainer } from 'awilix';
import { ReAuthEngine } from '../../auth-engine';
import { AuthInput, AuthOutput, ReAuthCradle } from '../../types';

/**
 * Error thrown when a banned user tries to authenticate
 */
export class UserBannedError extends Error {
  public readonly code = 'USER_BANNED';
  public readonly statusCode = 403;

  constructor(
    public entityId: string,
    public reason?: string,
    public bannedAt?: Date,
    public bannedBy?: string,
  ) {
    super(`User ${entityId} is banned${reason ? `: ${reason}` : ''}`);
    this.name = 'UserBannedError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      entityId: this.entityId,
      reason: this.reason,
      bannedAt: this.bannedAt,
      bannedBy: this.bannedBy,
    };
  }
}

/**
 * Helper function to extract entity ID from various input sources
 */
export async function extractEntityId(
  input: AuthInput,
  container: AwilixContainer<ReAuthCradle>,
): Promise<string | null> {
  // Direct entity ID
  if (input.entity?.id) {
    return input.entity.id;
  }

  // Entity ID from token (session validation)
  if (input.token) {
    try {
      const sessionService = container.cradle.sessionService;
      const result = await sessionService.verifySession(input.token);
      return result.entity?.id || null;
    } catch (error) {
      // Token is invalid, let the original step handle it
      return null;
    }
  }

  // Look up by email
  if (input.email) {
    try {
      const entityService = container.cradle.entityService;
      const entity = await entityService.findEntity(input.email, 'email');
      return entity?.id || null;
    } catch (error) {
      return null;
    }
  }

  // Look up by phone
  if (input.phone) {
    try {
      const entityService = container.cradle.entityService;
      const entity = await entityService.findEntity(input.phone, 'phone');
      return entity?.id || null;
    } catch (error) {
      return null;
    }
  }

  return null;
}

/**
 * Performs ban check for a given entity ID
 */
export async function performBanCheck(
  entityId: string,
  container: AwilixContainer<ReAuthCradle>,
): Promise<void> {
  try {
    const banCheckService = container.cradle.banCheckService;
    if (!banCheckService) {
      return; // No ban check service available
    }

    const banInfo = await banCheckService.checkBanStatus(entityId);
    if (banInfo && banInfo.banned) {
      throw new UserBannedError(
        entityId,
        banInfo.reason,
        banInfo.banned_at,
        banInfo.banned_by,
      );
    }
  } catch (error) {
    if (error instanceof UserBannedError) {
      throw error;
    }
    // Log other errors but don't block authentication
    console.warn('Ban check failed:', error);
  }
}

/**
 * Registers ban check hooks on authentication steps across all plugins
 * This function should be called after all plugins are registered
 */
export function registerBanInterceptor(reAuthEngine: ReAuthEngine) {
  // Get all plugins
  const plugins = reAuthEngine.getAllPlugins();

  // Steps that should check for banned users (authentication-related steps)
  const authStepsToIntercept = [
    'login',
    'register',
    'verify-email',
    'reset-password',
    'change-password',
    'verify-magiclink',
    'verify-otp',
    'refresh-token',
  ];

  // Register hooks on relevant steps
  plugins.forEach((plugin) => {
    plugin.steps.forEach((step) => {
      if (authStepsToIntercept.includes(step.name)) {
        // Register a 'before' hook to check ban status
        reAuthEngine.registerHook(
          plugin.name,
          step.name,
          'before',
          async (
            data: AuthInput | AuthOutput,
            container: AwilixContainer<ReAuthCradle>,
          ) => {
            const input = data as AuthInput;

            // Extract entity ID from various sources
            const entityId = await extractEntityId(input, container);

            // If we have an entity ID, check ban status
            if (entityId) {
              await performBanCheck(entityId, container);
            }

            return input;
          },
        );
      }
    });
  });
}

/**
 * Convenience function to register ban interceptor for specific plugins and steps
 */
export function registerSelectiveBanInterceptor(
  reAuthEngine: ReAuthEngine,
  interceptConfig: Array<{
    pluginName: string;
    stepNames: string[];
  }>,
) {
  interceptConfig.forEach(({ pluginName, stepNames }) => {
    stepNames.forEach((stepName) => {
      try {
        reAuthEngine.registerHook(
          pluginName,
          stepName,
          'before',
          async (
            data: AuthInput | AuthOutput,
            container: AwilixContainer<ReAuthCradle>,
          ) => {
            const input = data as AuthInput;

            // Extract entity ID from various sources
            const entityId = await extractEntityId(input, container);

            // If we have an entity ID, check ban status
            if (entityId) {
              await performBanCheck(entityId, container);
            }

            return input;
          },
        );
      } catch (error) {
        console.warn(
          `Failed to register ban interceptor for ${pluginName}.${stepName}:`,
          error,
        );
      }
    });
  });
}

/**
 * Register a session validation hook that checks for banned users
 * This can be used for steps that validate existing sessions
 */
export function registerSessionBanInterceptor(reAuthEngine: ReAuthEngine) {
  // Get all plugins
  const plugins = reAuthEngine.getAllPlugins();

  // Steps that validate sessions
  const sessionStepsToIntercept = [
    'validate-session',
    'check-session',
    'verify-token',
    'refresh-token',
  ];

  // Register hooks on session validation steps
  plugins.forEach((plugin) => {
    plugin.steps.forEach((step) => {
      if (sessionStepsToIntercept.includes(step.name)) {
        // Register an 'after' hook to check ban status after session validation
        reAuthEngine.registerHook(
          plugin.name,
          step.name,
          'after',
          async (
            data: AuthInput | AuthOutput,
            container: AwilixContainer<ReAuthCradle>,
          ) => {
            const output = data as AuthOutput;

            // If session validation was successful and we have an entity
            if (output.success && output.entity?.id) {
              await performBanCheck(output.entity.id, container);
            }

            return output;
          },
        );
      }
    });
  });
}
