// import { createReAuthEngine } from '../../auth-engine';
// import emailPasswordAuth from '../email-password/email-password.plugin';
// // import passwordlessAuth from '../passwordless/passwordless.plugin';
// import {
//   adminPlugin,
//   registerBanInterceptor,
//   registerSelectiveBanInterceptor,
//   registerSessionBanInterceptor,
//   UserBannedError,
// } from './index';
// import { KnexEntityService, KnexSessionService } from '../../services';
// import { Knex } from 'knex';
// import { AdminEntity } from './admin.plugin';

// // Example usage of the admin plugin with ban interceptor

// export function createAuthWithAdminPlugin(knex: Knex) {
//   // Create the ReAuth engine with plugins
//   const reAuth = createReAuthEngine({
//     plugins: [
//       // Regular auth plugins
//       emailPasswordAuth({
//         verifyEmail: true,
//         sendCode: async (entity, code, email, type) => {
//           console.log(`Sending ${type} code ${code} to ${email}`);
//         },
//       }),

//       // passwordlessAuth({
//       //   secret: 'your-secret-key',
//       //   send: async (entity, token, emailOrPhone, type) => {
//       //     console.log(`Sending ${type} token ${token} to ${emailOrPhone}`);
//       //   },
//       // }),

//       // Admin plugin for user management
//       adminPlugin({
//         // Optional: Custom ban check function
//         checkBanStatus: async (entityId, container) => {
//           const knex = container.cradle.knex;
//           const entity = await knex('entities').where('id', entityId).first();

//           if (entity && entity.banned) {
//             return {
//               banned: true,
//               reason: entity.ban_reason,
//               banned_at: entity.banned_at,
//               banned_by: entity.banned_by,
//             };
//           }
//           return null;
//         },

//         // Optional: Custom ban function with additional logic
//         banUser: async (entityId, reason, bannedBy, container) => {
//           const knex = container.cradle.knex;

//           // Ban the user
//           await knex('entities').where('id', entityId).update({
//             banned: true,
//             ban_reason: reason,
//             banned_at: new Date(),
//             banned_by: bannedBy,
//             updated_at: new Date(),
//           });

//           // Destroy all active sessions
//           const sessionService = container.cradle.sessionService;
//           await sessionService.destroyAllSessions(entityId);

//           // Log the ban action
//           console.log(`User ${entityId} banned by ${bannedBy}: ${reason}`);
//         },

//         // Optional: Custom unban function
//         unbanUser: async (entityId, unbannedBy, container) => {
//           const knex = container.cradle.knex;

//           await knex('entities').where('id', entityId).update({
//             banned: false,
//             ban_reason: null,
//             banned_at: null,
//             banned_by: null,
//             updated_at: new Date(),
//           });

//           console.log(`User ${entityId} unbanned by ${unbannedBy}`);
//         },
//         adminEntity: {
//           findEntity: function (
//             id: string,
//             field: string,
//           ): Promise<AdminEntity | null> {
//             throw new Error('Function not implemented.');
//           },
//           createEntity: function (
//             entity: Partial<AdminEntity>,
//           ): Promise<AdminEntity> {
//             throw new Error('Function not implemented.');
//           },
//           updateEntity: function (
//             id: string,
//             field: string,
//             entity: Partial<AdminEntity>,
//           ): Promise<AdminEntity> {
//             throw new Error('Function not implemented.');
//           },
//           deleteEntity: function (id: string, field: string): Promise<void> {
//             throw new Error('Function not implemented.');
//           },
//         },
//       }),
//     ],
//     entity: new KnexEntityService(knex, 'entities'),
//     session: new KnexSessionService(knex, 'sessions'),
//   });

//   // OPTION 1: Register ban interceptor for all common auth steps
//   registerBanInterceptor(reAuth);

//   // OPTION 2: Or register selective ban interceptor for specific plugins/steps
//   registerSelectiveBanInterceptor(reAuth, [
//     {
//       pluginName: 'email-password',
//       stepNames: ['login', 'register'],
//     },
//     {
//       pluginName: 'passwordless',
//       stepNames: ['verify-magiclink', 'verify-otp'],
//     },
//   ]);

//   // OPTION 3: Register session ban interceptor for session validation
//   registerSessionBanInterceptor(reAuth);

//   return reAuth;
// }

// // Example usage in your application
// export async function exampleUsage() {
//   // Assume you have a knex instance
//   const knex = {} as Knex; // Your actual knex instance

//   const reAuth = createAuthWithAdminPlugin(knex);

//   try {
//     // Normal login attempt - will be intercepted if user is banned
//     const loginResult = await reAuth.executeStep('email-password', 'login', {
//       email: 'user@example.com',
//       password: 'password123',
//     });

//     console.log('Login successful:', loginResult);
//   } catch (error) {
//     if (error instanceof UserBannedError) {
//       console.log('User is banned:', error.message);
//       console.log('Ban details:', error.toJSON());
//       // Handle banned user appropriately
//     } else {
//       console.log(
//         'Login failed:',
//         error instanceof Error ? error.message : 'Unknown error',
//       );
//     }
//   }

//   // Admin actions
//   try {
//     // Ban a user
//     const banResult = await reAuth.executeStep('admin', 'ban-user', {
//       entityId: 'user-id-to-ban',
//       reason: 'Violation of terms of service',
//       bannedBy: 'admin-user-id',
//     });

//     console.log('Ban result:', banResult);

//     // Check ban status
//     const statusResult = await reAuth.executeStep('admin', 'check-ban-status', {
//       entityId: 'user-id-to-ban',
//     });

//     console.log('Ban status:', statusResult);

//     // Unban a user
//     const unbanResult = await reAuth.executeStep('admin', 'unban-user', {
//       entityId: 'user-id-to-ban',
//       unbannedBy: 'admin-user-id',
//     });

//     console.log('Unban result:', unbanResult);
//   } catch (error) {
//     console.log(
//       'Admin action failed:',
//       error instanceof Error ? error.message : 'Unknown error',
//     );
//   }

//   // Example of using the serialization feature
//   const container = reAuth.getContainer();
//   const serializeEntity = container.cradle.serializeEntity;

//   const entity = {
//     id: 'user-123',
//     email: 'user@example.com',
//     email_verified: false,
//     password_hash: 'hashed-password', // This will be redacted
//     ban_reason: 'Spam', // This will be redacted
//     role: 'user',
//     created_at: new Date(),
//     updated_at: new Date(),
//   };

//   const serializedEntity = serializeEntity(entity);
//   console.log('Serialized entity:', serializedEntity);
//   // Output: { id: 'user-123', email: 'user@example.com', password_hash: '[REDACTED]', ban_reason: '[REDACTED]', ... }

//   // Example of using the new checkSession method
//   try {
//     const sessionResult = await reAuth.checkSession('some-session-token');

//     if (sessionResult.valid) {
//       console.log('Session is valid:', sessionResult.entity);
//     } else {
//       console.log('Session is invalid:', sessionResult.error);
//       // Could be: 'Invalid or expired session' or 'User is banned: reason'
//     }
//   } catch (error) {
//     console.log(
//       'Session check failed:',
//       error instanceof Error ? error.message : 'Unknown error',
//     );
//   }
// }
