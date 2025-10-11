/**
 * Comprehensive log tags for ReAuth authentication system
 * 
 * This module defines all available log tags with JSDoc documentation
 * to help developers understand when and why to use each tag.
 * 
 * @example
 * ```typescript
 * // Using tags in logging
 * logger.info('auth', 'User authentication started');
 * logger.warn('session', 'Session token expired');
 * logger.error('database', 'Connection failed', error);
 * ```
 * 
 * @example
 * ```bash
 * # Environment variable control
 * REAUTH_DEBUG=auth,session,database
 * REAUTH_DEBUG=*  # Enable all tags
 * ```
 */

/**
 * **AUTHENTICATION TAGS**
 * 
 * Core authentication flow and user verification tags
 */

/**
 * @tag auth
 * @description Core authentication operations and user verification
 * @usage User login, logout, password verification, token generation
 * @example logger.info('auth', 'User authentication successful', { userId: '123' })
 * @example logger.error('auth', 'Authentication failed', { reason: 'invalid_password' })
 */
export const AUTH_TAGS = {
  /** Core authentication flow - login, logout, verification */
  AUTH: 'auth',
  /** Session management - creation, validation, expiration */
  SESSION: 'session', 
  /** Token operations - generation, validation, refresh, blacklist */
  TOKEN: 'token',
  /** JWT-specific operations - signing, verification, rotation */
  JWT: 'jwt',
} as const;

/**
 * **PLUGIN TAGS**
 * 
 * Authentication plugin-specific operations
 */

/**
 * @tag plugin
 * @description General plugin operations and lifecycle
 * @usage Plugin initialization, step execution, plugin-specific logic
 * @example logger.info('plugin', 'Plugin initialized', { pluginName: 'email-password' })
 * @example logger.warn('plugin', 'Plugin step failed', { plugin: 'oauth', step: 'callback' })
 */
export const PLUGIN_TAGS = {
  /** General plugin operations */
  PLUGIN: 'plugin',
  /** OAuth provider operations */
  OAUTH: 'oauth',
  /** Email-based authentication */
  EMAIL: 'email',
  /** Phone/SMS authentication */
  PHONE: 'phone',
  /** API key authentication */
  API_KEY: 'api-key',
  /** Username-based authentication */
  USERNAME: 'username',
  /** Passwordless authentication (magic links, etc.) */
  PASSWORDLESS: 'passwordless',
  /** Anonymous user operations */
  ANONYMOUS: 'anonymous',
  /** Organization/multi-tenant operations */
  ORGANIZATION: 'organization',
  /** Admin operations */
  ADMIN: 'admin',
} as const;

/**
 * **HTTP ADAPTER TAGS**
 * 
 * HTTP protocol adapter and middleware operations
 */

/**
 * @tag http
 * @description HTTP adapter operations and middleware
 * @usage Request/response handling, middleware execution, adapter lifecycle
 * @example logger.info('http', 'Request received', { method: 'POST', path: '/auth/login' })
 * @example logger.error('http', 'Middleware error', { middleware: 'cors', error: '...' })
 */
export const HTTP_TAGS = {
  /** HTTP adapter general operations */
  HTTP: 'http',
  /** HTTP request handling */
  REQUEST: 'request',
  /** HTTP response handling */
  RESPONSE: 'response',
  /** HTTP error handling */
  ERROR: 'error',
  /** HTTP middleware operations */
  MIDDLEWARE: 'middleware',
} as const;

/**
 * **ENGINE OPERATION TAGS**
 * 
 * Core engine operations and system-level functionality
 */

/**
 * @tag engine
 * @description Core engine operations and system-level functionality
 * @usage Engine initialization, step execution, system operations
 * @example logger.info('engine', 'Engine initialized', { plugins: ['email-password'] })
 * @example logger.info('step', 'Step executed', { plugin: 'oauth', step: 'login' })
 */
export const ENGINE_TAGS = {
  /** Core engine operations */
  ENGINE: 'engine',
  /** Step execution within plugins */
  STEP: 'step',
  /** Input/output validation */
  VALIDATION: 'validation',
  /** Database operations */
  DATABASE: 'database',
  /** Cleanup and maintenance operations */
  CLEANUP: 'cleanup',
  /** Performance and timing operations */
  PERFORMANCE: 'performance',
} as const;

/**
 * **SERVICE TAGS**
 * 
 * Core service operations (session, JWT, cleanup, etc.)
 */

/**
 * @tag service
 * @description Core service operations and lifecycle
 * @usage Service initialization, operations, cleanup, health checks
 * @example logger.info('service', 'Service started', { serviceName: 'session-service' })
 * @example logger.warn('service', 'Service degraded', { serviceName: 'jwt-service' })
 */
export const SERVICE_TAGS = {
  /** General service operations */
  SERVICE: 'service',
  /** Session service operations */
  SESSION_SERVICE: 'session-service',
  /** JWT service operations */
  JWT_SERVICE: 'jwt-service',
  /** Cleanup service operations */
  CLEANUP_SERVICE: 'cleanup-service',
} as const;

/**
 * **SECURITY TAGS**
 * 
 * Security-related operations and monitoring
 */

/**
 * @tag security
 * @description Security operations and threat monitoring
 * @usage Security checks, threat detection, access control
 * @example logger.warn('security', 'Suspicious login attempt', { ip: '192.168.1.1' })
 * @example logger.error('security', 'Security violation', { type: 'rate_limit_exceeded' })
 */
export const SECURITY_TAGS = {
  /** General security operations */
  SECURITY: 'security',
  /** Rate limiting operations */
  RATE_LIMIT: 'rate-limit',
  /** Device validation and tracking */
  DEVICE: 'device',
  /** Access control and permissions */
  ACCESS_CONTROL: 'access-control',
  /** Threat detection and monitoring */
  THREAT_DETECTION: 'threat-detection',
} as const;

/**
 * **ALL AVAILABLE TAGS**
 * 
 * Complete list of all available log tags for easy reference
 */
export const ALL_TAGS = {
  ...AUTH_TAGS,
  ...PLUGIN_TAGS,
  ...HTTP_TAGS,
  ...ENGINE_TAGS,
  ...SERVICE_TAGS,
  ...SECURITY_TAGS,
} as const;

/**
 * **TAG CATEGORIES**
 * 
 * Organized by functional area for easy discovery
 */
export const TAG_CATEGORIES = {
  /** Authentication and session management */
  AUTHENTICATION: AUTH_TAGS,
  /** Plugin-specific operations */
  PLUGINS: PLUGIN_TAGS,
  /** HTTP adapter and middleware */
  HTTP: HTTP_TAGS,
  /** Core engine operations */
  ENGINE: ENGINE_TAGS,
  /** Core services */
  SERVICES: SERVICE_TAGS,
  /** Security and monitoring */
  SECURITY: SECURITY_TAGS,
} as const;

/**
 * **USAGE EXAMPLES**
 * 
 * Common logging patterns and examples
 */
export const LOGGING_EXAMPLES = {
  /**
   * Authentication flow logging
   * @example
   * logger.info('auth', 'User login attempt', { email: 'user@example.com' });
   * logger.success('auth', 'User authenticated successfully', { userId: '123' });
   * logger.error('auth', 'Authentication failed', { reason: 'invalid_password' });
   */
  AUTHENTICATION: 'auth',

  /**
   * Session management logging
   * @example
   * logger.info('session', 'Session created', { sessionId: 'sess_123' });
   * logger.warn('session', 'Session expired', { sessionId: 'sess_123' });
   * logger.info('session', 'Session refreshed', { sessionId: 'sess_123' });
   */
  SESSION: 'session',

  /**
   * Plugin operation logging
   * @example
   * logger.info('plugin', 'Plugin initialized', { pluginName: 'email-password' });
   * logger.info('step', 'Step executed', { plugin: 'oauth', step: 'callback' });
   * logger.error('plugin', 'Plugin error', { plugin: 'oauth', error: '...' });
   */
  PLUGIN: 'plugin',

  /**
   * HTTP adapter logging
   * @example
   * logger.info('request', 'Request received', { method: 'POST', path: '/auth/login' });
   * logger.info('response', 'Response sent', { status: 200, duration: 150 });
   * logger.error('error', 'Request failed', { error: 'validation_error' });
   */
  HTTP: 'http',

  /**
   * Database operation logging
   * @example
   * logger.info('database', 'Query executed', { table: 'users', operation: 'select' });
   * logger.warn('database', 'Query slow', { table: 'sessions', duration: 5000 });
   * logger.error('database', 'Connection failed', { error: 'timeout' });
   */
  DATABASE: 'database',
} as const;

/**
 * **ENVIRONMENT VARIABLE CONTROL**
 * 
 * Control logging via environment variables
 */
export const ENV_CONTROL = {
  /**
   * Enable specific tags
   * @example
   * REAUTH_DEBUG=auth,session,plugin
   */
  ENABLE_TAGS: 'REAUTH_DEBUG',

  /**
   * Enable all tags
   * @example
   * REAUTH_DEBUG=*
   */
  ENABLE_ALL: '*',

  /**
   * Common tag combinations
   */
  COMBINATIONS: {
    /** Basic authentication flow */
    BASIC_AUTH: 'auth,session,token',
    /** Full plugin operations */
    FULL_PLUGINS: 'plugin,oauth,email,phone,api-key',
    /** HTTP adapter debugging */
    HTTP_DEBUG: 'http,request,response,error,middleware',
    /** Engine operations */
    ENGINE_DEBUG: 'engine,step,validation,database',
    /** Service monitoring */
    SERVICE_MONITOR: 'service,session-service,jwt-service,cleanup-service',
    /** Security monitoring */
    SECURITY_MONITOR: 'security,rate-limit,device,access-control',
  },
} as const;
