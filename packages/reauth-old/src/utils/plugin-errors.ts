/**
 * Base class for all plugin-related errors
 */
export abstract class BasePluginError extends Error {
  public readonly pluginName: string;
  public readonly timestamp: Date;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    pluginName: string,
    metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.pluginName = pluginName;
    this.timestamp = new Date();
    this.metadata = metadata;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Get error details for logging
   */
  getErrorDetails(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      pluginName: this.pluginName,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      stack: this.stack,
    };
  }

  /**
   * Get sanitized error for client response (removes sensitive data)
   */
  getSanitizedError(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      pluginName: this.pluginName,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Plugin initialization errors
 */
export class PluginInitializationError extends BasePluginError {
  public readonly reason: string;

  constructor(
    pluginName: string,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    super(
      `Plugin ${pluginName} failed to initialize: ${reason}`,
      pluginName,
      metadata,
    );
    this.reason = reason;
  }
}

/**
 * Plugin configuration errors
 */
export class PluginConfigurationError extends BasePluginError {
  public readonly configField?: string;
  public readonly expectedType?: string;
  public readonly receivedValue?: any;

  constructor(
    pluginName: string,
    message: string,
    configField?: string,
    expectedType?: string,
    receivedValue?: any,
    metadata?: Record<string, any>,
  ) {
    super(
      `Configuration error in plugin ${pluginName}: ${message}`,
      pluginName,
      metadata,
    );
    this.configField = configField;
    this.expectedType = expectedType;
    this.receivedValue = receivedValue;
  }
}

/**
 * Plugin dependency errors
 */
export class PluginDependencyError extends BasePluginError {
  public readonly missingDependencies: string[];

  constructor(
    pluginName: string,
    missingDependencies: string[],
    metadata?: Record<string, any>,
  ) {
    const deps = missingDependencies.join(', ');
    super(
      `Plugin ${pluginName} has missing dependencies: ${deps}`,
      pluginName,
      metadata,
    );
    this.missingDependencies = missingDependencies;
  }
}

/**
 * Plugin step execution errors
 */
export class PluginStepError extends BasePluginError {
  public readonly stepName: string;
  public readonly stepInput?: any;
  public readonly originalError?: Error;

  constructor(
    pluginName: string,
    stepName: string,
    message: string,
    stepInput?: any,
    originalError?: Error,
    metadata?: Record<string, any>,
  ) {
    super(
      `Step '${stepName}' failed in plugin ${pluginName}: ${message}`,
      pluginName,
      metadata,
    );
    this.stepName = stepName;
    this.stepInput = stepInput;
    this.originalError = originalError;
  }
}

/**
 * Plugin security violation errors
 */
export class PluginSecurityError extends BasePluginError {
  public readonly violationType: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    pluginName: string,
    violationType: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: Record<string, any>,
  ) {
    super(
      `Security violation in plugin ${pluginName} (${violationType}): ${message}`,
      pluginName,
      metadata,
    );
    this.violationType = violationType;
    this.severity = severity;
  }
}

/**
 * Plugin validation errors
 */
export class PluginValidationError extends BasePluginError {
  public readonly stepName?: string;
  public readonly validationErrors: Record<string, string>;

  constructor(
    pluginName: string,
    validationErrors: Record<string, string>,
    stepName?: string,
    metadata?: Record<string, any>,
  ) {
    const errorMessages = Object.entries(validationErrors)
      .map(([field, error]) => `${field}: ${error}`)
      .join(', ');

    const stepInfo = stepName ? ` in step '${stepName}'` : '';
    super(
      `Validation failed for plugin ${pluginName}${stepInfo}: ${errorMessages}`,
      pluginName,
      metadata,
    );
    this.stepName = stepName;
    this.validationErrors = validationErrors;
  }
}

/**
 * Plugin authentication errors
 */
export class PluginAuthenticationError extends BasePluginError {
  public readonly authType: string;
  public readonly entityId?: string;

  constructor(
    pluginName: string,
    authType: string,
    message: string,
    entityId?: string,
    metadata?: Record<string, any>,
  ) {
    super(
      `Authentication failed in plugin ${pluginName} (${authType}): ${message}`,
      pluginName,
      metadata,
    );
    this.authType = authType;
    this.entityId = entityId;
  }
}

/**
 * Plugin authorization errors
 */
export class PluginAuthorizationError extends BasePluginError {
  public readonly requiredPermission: string;
  public readonly entityId?: string;

  constructor(
    pluginName: string,
    requiredPermission: string,
    message: string,
    entityId?: string,
    metadata?: Record<string, any>,
  ) {
    super(
      `Authorization failed in plugin ${pluginName}: ${message}`,
      pluginName,
      metadata,
    );
    this.requiredPermission = requiredPermission;
    this.entityId = entityId;
  }
}

/**
 * Plugin timeout errors
 */
export class PluginTimeoutError extends BasePluginError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(
    pluginName: string,
    operation: string,
    timeoutMs: number,
    metadata?: Record<string, any>,
  ) {
    super(
      `Operation '${operation}' timed out in plugin ${pluginName} after ${timeoutMs}ms`,
      pluginName,
      metadata,
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Plugin external service errors
 */
export class PluginExternalServiceError extends BasePluginError {
  public readonly serviceName: string;
  public readonly serviceError?: Error;
  public readonly statusCode?: number;

  constructor(
    pluginName: string,
    serviceName: string,
    message: string,
    serviceError?: Error,
    statusCode?: number,
    metadata?: Record<string, any>,
  ) {
    super(
      `External service error in plugin ${pluginName} (${serviceName}): ${message}`,
      pluginName,
      metadata,
    );
    this.serviceName = serviceName;
    this.serviceError = serviceError;
    this.statusCode = statusCode;
  }
}

/**
 * Utility function to wrap errors with plugin context
 */
export function wrapPluginError(
  error: Error,
  pluginName: string,
  context?: {
    stepName?: string;
    operation?: string;
    metadata?: Record<string, any>;
  },
): BasePluginError {
  if (error instanceof BasePluginError) {
    return error;
  }

  // Determine the most appropriate error type based on error message/type
  if (
    error.name === 'ValidationError' ||
    error.message.includes('validation')
  ) {
    return new PluginValidationError(
      pluginName,
      { general: error.message },
      context?.stepName,
      context?.metadata,
    );
  }

  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    return new PluginTimeoutError(
      pluginName,
      context?.operation || 'unknown',
      5000, // default timeout
      context?.metadata,
    );
  }

  // Default to step error
  return new PluginStepError(
    pluginName,
    context?.stepName || 'unknown',
    error.message,
    undefined,
    error,
    context?.metadata,
  );
}

/**
 * Error handler utility for plugins
 */
export class PluginErrorHandler {
  /**
   * Handle and log plugin errors appropriately
   */
  static async handleError(
    error: BasePluginError,
    logFunction?: (error: BasePluginError) => Promise<void>,
  ): Promise<void> {
    // Log the error
    if (logFunction) {
      await logFunction(error);
    } else {
      console.error('[PLUGIN ERROR]', error.getErrorDetails());
    }

    // Additional handling based on error type
    if (error instanceof PluginSecurityError && error.severity === 'critical') {
      // Could trigger alerts, notifications, etc.
      console.error('[CRITICAL SECURITY ERROR]', error.getSanitizedError());
    }
  }

  /**
   * Create a safe error response for clients
   */
  static createSafeErrorResponse(error: BasePluginError): Record<string, any> {
    const baseResponse = error.getSanitizedError();

    // Add specific fields based on error type
    if (error instanceof PluginValidationError) {
      return {
        ...baseResponse,
        validationErrors: error.validationErrors,
      };
    }

    return baseResponse;
  }
}
