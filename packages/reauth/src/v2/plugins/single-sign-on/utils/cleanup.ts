/**
 * SSO Plugin Cleanup Utilities
 * Background cleanup tasks for expired SSO entities
 */

import type { OrmLike } from '../../../types.v2';
import type { SingleSignOnConfigV2 } from '../types';

/**
 * Clean up expired SAML assertions
 */
export async function cleanupExpiredAssertions(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  assertionsDeleted: number;
  errors?: string[];
}> {
  try {
    const retentionHours = config.cleanup?.expiredAssertionRetentionHours || 24;
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    const result = await orm.delete('sso_saml_assertions', {
      where: (builder: any) => 
        builder('expires_at', '<', cutoffDate.toISOString())
          .and('consumed_at', 'is not', null),
    });

    return {
      assertionsDeleted: result?.deletedCount || 0,
    };
  } catch (error) {
    return {
      assertionsDeleted: 0,
      errors: [`Failed to cleanup expired assertions: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Clean up expired SSO sessions
 */
export async function cleanupExpiredSsoSessions(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  sessionsDeleted: number;
  errors?: string[];
}> {
  try {
    const now = new Date();

    const result = await orm.delete('sso_sessions', {
      where: (builder: any) => builder('expires_at', '<', now.toISOString()),
    });

    return {
      sessionsDeleted: result?.deletedCount || 0,
    };
  } catch (error) {
    return {
      sessionsDeleted: 0,
      errors: [`Failed to cleanup expired SSO sessions: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Clean up expired federated sessions
 */
export async function cleanupExpiredFederatedSessions(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  federatedSessionsDeleted: number;
  errors?: string[];
}> {
  try {
    const retentionDays = config.cleanup?.expiredSessionRetentionDays || 7;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await orm.delete('sso_federated_sessions', {
      where: (builder: any) => builder('expires_at', '<', cutoffDate.toISOString()),
    });

    return {
      federatedSessionsDeleted: result?.deletedCount || 0,
    };
  } catch (error) {
    return {
      federatedSessionsDeleted: 0,
      errors: [`Failed to cleanup expired federated sessions: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Clean up completed SSO requests
 */
export async function cleanupCompletedSsoRequests(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  requestsDeleted: number;
  errors?: string[];
}> {
  try {
    const retentionHours = config.cleanup?.logoutRequestRetentionHours || 48;
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    // Clean up completed or expired requests
    const result = await orm.delete('sso_requests', {
      where: (builder: any) => 
        builder('expires_at', '<', cutoffDate.toISOString())
          .or('status', 'in', ['completed', 'failed', 'timeout'])
          .and('completed_at', '<', cutoffDate.toISOString()),
    });

    return {
      requestsDeleted: result?.deletedCount || 0,
    };
  } catch (error) {
    return {
      requestsDeleted: 0,
      errors: [`Failed to cleanup completed SSO requests: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Clean up completed logout requests
 */
export async function cleanupCompletedLogoutRequests(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  logoutRequestsDeleted: number;
  errors?: string[];
}> {
  try {
    const retentionHours = config.cleanup?.logoutRequestRetentionHours || 48;
    const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    // Clean up completed logout requests
    const result = await orm.delete('sso_logout_requests', {
      where: (builder: any) => 
        builder('expires_at', '<', cutoffDate.toISOString())
          .or('status', 'in', ['completed', 'failed'])
          .and('completed_at', '<', cutoffDate.toISOString()),
    });

    return {
      logoutRequestsDeleted: result?.deletedCount || 0,
    };
  } catch (error) {
    return {
      logoutRequestsDeleted: 0,
      errors: [`Failed to cleanup completed logout requests: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Comprehensive SSO cleanup function
 * Runs all cleanup tasks and returns aggregated results
 */
export async function cleanupAllSsoEntities(
  orm: OrmLike,
  config: Partial<SingleSignOnConfigV2>
): Promise<{
  totalCleaned: number;
  assertionsDeleted: number;
  sessionsDeleted: number;
  federatedSessionsDeleted: number;
  requestsDeleted: number;
  logoutRequestsDeleted: number;
  errors?: string[];
}> {
  const results = {
    totalCleaned: 0,
    assertionsDeleted: 0,
    sessionsDeleted: 0,
    federatedSessionsDeleted: 0,
    requestsDeleted: 0,
    logoutRequestsDeleted: 0,
    errors: [] as string[],
  };

  // Clean up expired assertions
  try {
    const assertionResult = await cleanupExpiredAssertions(orm, config);
    results.assertionsDeleted = assertionResult.assertionsDeleted;
    if (assertionResult.errors) {
      results.errors.push(...assertionResult.errors);
    }
  } catch (error) {
    results.errors.push(`Assertion cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Clean up expired SSO sessions
  try {
    const sessionResult = await cleanupExpiredSsoSessions(orm, config);
    results.sessionsDeleted = sessionResult.sessionsDeleted;
    if (sessionResult.errors) {
      results.errors.push(...sessionResult.errors);
    }
  } catch (error) {
    results.errors.push(`SSO session cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Clean up expired federated sessions
  try {
    const federatedResult = await cleanupExpiredFederatedSessions(orm, config);
    results.federatedSessionsDeleted = federatedResult.federatedSessionsDeleted;
    if (federatedResult.errors) {
      results.errors.push(...federatedResult.errors);
    }
  } catch (error) {
    results.errors.push(`Federated session cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Clean up completed SSO requests
  try {
    const requestResult = await cleanupCompletedSsoRequests(orm, config);
    results.requestsDeleted = requestResult.requestsDeleted;
    if (requestResult.errors) {
      results.errors.push(...requestResult.errors);
    }
  } catch (error) {
    results.errors.push(`SSO request cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Clean up completed logout requests
  try {
    const logoutResult = await cleanupCompletedLogoutRequests(orm, config);
    results.logoutRequestsDeleted = logoutResult.logoutRequestsDeleted;
    if (logoutResult.errors) {
      results.errors.push(...logoutResult.errors);
    }
  } catch (error) {
    results.errors.push(`Logout request cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Calculate total cleaned
  results.totalCleaned = 
    results.assertionsDeleted +
    results.sessionsDeleted +
    results.federatedSessionsDeleted +
    results.requestsDeleted +
    results.logoutRequestsDeleted;

  // Remove errors array if empty
  if (results.errors.length === 0) {
    delete results.errors;
  }

  return results;
}