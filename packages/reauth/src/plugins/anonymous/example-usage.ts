// import { Knex } from 'knex';
// import { createReAuthEngine } from '../../auth-engine';
// import { KnexEntityService, KnexSessionService } from '../../services';
// import anonymousAuth from './anonymous.plugin';
// import emailPasswordAuth from '../email-password/email-password.plugin';
// import { Entity } from '../../types';

// // Extended Entity interface for example usage
// interface ExampleEntity extends Entity {
//   cart?: any[];
//   preferences?: Record<string, any>;
//   total_visits?: number;
// }

// /**
//  * Example: Creating ReAuth engine with anonymous authentication
//  */
// export function createAnonymousAuthExample(knex: Knex) {
//   const entityService = new KnexEntityService(knex, 'entities');
//   const sessionService = new KnexSessionService(knex, 'sessions');

//   const reAuth = createReAuthEngine({
//     plugins: [
//       // Include email-password for user registration
//       emailPasswordAuth({
//         verifyEmail: false,
//         loginOnRegister: true,
//       }),
//       // Add anonymous plugin with account linking
//       anonymousAuth({
//         defaultData: {
//           cart: [],
//           preferences: {},
//           visits: 0,
//         },
//         onLinkAccount: async ({ anonymousUser, newUser, container }) => {
//           // Transfer cart items from anonymous user to registered user
//           if (anonymousUser.anonymous_data?.cart?.length) {
//             console.log(`Transferring ${anonymousUser.anonymous_data.cart.length} cart items`);
            
//             // Example: Transfer cart items to user's cart
//             const extendedNewUser = newUser as ExampleEntity;
//             const updatedUser = {
//               ...extendedNewUser,
//               cart: [
//                 ...(extendedNewUser.cart || []),
//                 ...anonymousUser.anonymous_data.cart,
//               ],
//             };
            
//             await container.cradle.entityService.updateEntity(
//               newUser.id,
//               'id',
//               updatedUser,
//             );
//           }
          
//           // Transfer preferences
//           if (anonymousUser.anonymous_data?.preferences) {
//             console.log('Transferring user preferences');
//             // await userService.updatePreferences(newUser.id, anonymousUser.anonymous_data.preferences);
//           }
          
//           // Log the visit count
//           console.log(`Anonymous user had ${anonymousUser.anonymous_data?.visits || 0} visits`);
//         },
//         onConvertToUser: async ({ anonymousUser, email, username, password, container }) => {
//           console.log('Converting anonymous user to registered user...');
//           // Any additional conversion logic can go here
//         },
//         transferDataOnLink: (anonymousData, targetEntity) => {
//           // Transfer preferences and analytics
//           return {
//             ...targetEntity,
//             preferences: {
//               ...(targetEntity.preferences || {}),
//               ...(anonymousData.preferences || {}),
//             },
//             total_visits: (targetEntity.total_visits || 0) + (anonymousData.visits || 0),
//           };
//         },
//         validateAnonymousData: (data) => {
//           // Example validation: ensure cart items have required fields
//           if (data.cart && Array.isArray(data.cart)) {
//             return data.cart.every((item: any) => item.id && item.quantity);
//           }
//           return true;
//         },
//       }),
//     ],
//     entity: entityService,
//     session: sessionService,
//   });

//   return reAuth;
// }

// /**
//  * Example workflow showing anonymous authentication and linking
//  */
// export async function anonymousAuthWorkflow() {
//   // Assuming you have a knex instance
//   const knex = {} as Knex; // Replace with your actual knex instance
//   const reAuth = createAnonymousAuthExample(knex);

//   try {
//     // 1. Create an anonymous user
//     const anonymousResult = await reAuth.executeStep('anonymous', 'create-anonymous', {});
//     console.log('Anonymous user created:', anonymousResult);

//     if (anonymousResult.success) {
//       const anonymousUser = anonymousResult.entity;
      
//       // 2. Update anonymous data (simulate user activity)
//       const updateDataResult = await reAuth.executeStep('anonymous', 'update-anonymous-data', {
//         entity: anonymousUser,
//         data: {
//           cart: [
//             { id: 'product-1', quantity: 2, price: 19.99 },
//             { id: 'product-2', quantity: 1, price: 39.99 },
//           ],
//           preferences: {
//             theme: 'dark',
//             language: 'en',
//           },
//           visits: 1,
//         },
//       });

//       console.log('Anonymous data updated:', updateDataResult);

//       // 3. Register a real user
//       const registerResult = await reAuth.executeStep('email-password', 'register', {
//         email: 'user@example.com',
//         password: 'StrongPassword123!',
//       });

//       console.log('Real user registered:', registerResult);

//       if (registerResult.success) {
//         // 4. Link anonymous user to the registered user
//         const linkResult = await reAuth.executeStep('anonymous', 'link-account', {
//           entity: anonymousUser,
//           targetEntityId: registerResult.entity!.id,
//         });

//         console.log('Account linking result:', linkResult);

//         // 5. Get anonymous data after linking
//         const getDataResult = await reAuth.executeStep('anonymous', 'get-anonymous-data', {
//           entity: anonymousUser,
//         });

//         console.log('Anonymous data after linking:', getDataResult);
//       }

//       // Alternative: Convert anonymous user to registered user
//       const convertResult = await reAuth.executeStep('anonymous', 'convert-to-user', {
//         entity: anonymousUser,
//         email: 'converted@example.com',
//         password: 'AnotherPassword123!',
//         username: 'converted_user',
//       });

//       console.log('Conversion result:', convertResult);
//     }

//   } catch (error) {
//     console.error('Error in anonymous auth workflow:', error);
//   }
// }

// /**
//  * Example: Using anonymous auth with Express.js
//  */
// export function createExpressAnonymousRoutes(reAuth: any) {
//   const express = require('express');
//   const router = express.Router();

//   // Create anonymous user endpoint
//   router.post('/anonymous', async (req: any, res: any) => {
//     try {
//       const result = await reAuth.executeStep('anonymous', 'create-anonymous', {});

//       if (result.success) {
//         // Set anonymous session cookie
//         res.cookie('anonymous_token', result.token, {
//           httpOnly: true,
//           secure: process.env.NODE_ENV === 'production',
//           maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
//         });
        
//         res.status(201).json({
//           message: result.message,
//           anonymousId: result.anonymousId,
//           user: result.entity,
//         });
//       } else {
//         res.status(400).json({
//           error: result.message,
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   });

//   // Update anonymous data endpoint
//   router.patch('/anonymous/data', async (req: any, res: any) => {
//     try {
//       const { data } = req.body;
//       const user = req.user; // From auth middleware
      
//       if (!user || !user.is_anonymous) {
//         return res.status(400).json({ error: 'Anonymous user required' });
//       }

//       const result = await reAuth.executeStep('anonymous', 'update-anonymous-data', {
//         entity: user,
//         data,
//       });

//       if (result.success) {
//         res.json({
//           message: result.message,
//           data: result.data,
//         });
//       } else {
//         res.status(400).json({
//           error: result.message,
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   });

//   // Link anonymous account to registered account
//   router.post('/anonymous/link', async (req: any, res: any) => {
//     try {
//       const { targetEntityId } = req.body;
//       const user = req.user;
      
//       if (!user || !user.is_anonymous) {
//         return res.status(400).json({ error: 'Anonymous user required' });
//       }

//       const result = await reAuth.executeStep('anonymous', 'link-account', {
//         entity: user,
//         targetEntityId,
//       });

//       if (result.success) {
//         res.json({
//           message: result.message,
//           linkedEntityId: result.linkedEntityId,
//         });
//       } else {
//         res.status(400).json({
//           error: result.message,
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   });

//   // Convert anonymous user to registered user
//   router.post('/anonymous/convert', async (req: any, res: any) => {
//     try {
//       const { email, password, username } = req.body;
//       const user = req.user;
      
//       if (!user || !user.is_anonymous) {
//         return res.status(400).json({ error: 'Anonymous user required' });
//       }

//       const result = await reAuth.executeStep('anonymous', 'convert-to-user', {
//         entity: user,
//         email,
//         password,
//         username,
//       });

//       if (result.success) {
//         // Clear anonymous token and set user token
//         res.clearCookie('anonymous_token');
//         // Note: You'd need to create a new session for the converted user
        
//         res.json({
//           message: result.message,
//           user: result.entity,
//         });
//       } else {
//         res.status(400).json({
//           error: result.message,
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   });

//   return router;
// }

// /**
//  * Frontend usage example (React)
//  */
// export const useAnonymousAuth = () => {
//   const createAnonymousUser = async () => {
//     const response = await fetch('/auth/anonymous', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     if (response.ok) {
//       const data = await response.json();
//       // Store anonymous ID for future reference
//       localStorage.setItem('anonymousId', data.anonymousId);
//       return { success: true, anonymousId: data.anonymousId, user: data.user };
//     } else {
//       const error = await response.json();
//       return { success: false, error: error.error };
//     }
//   };

//   const updateAnonymousData = async (data: Record<string, any>) => {
//     const response = await fetch('/auth/anonymous/data', {
//       method: 'PATCH',
//       headers: {
//         'Content-Type': 'application/json',
//         // Include anonymous token
//         'Authorization': `Bearer ${localStorage.getItem('anonymous_token')}`,
//       },
//       body: JSON.stringify({ data }),
//     });

//     if (response.ok) {
//       const result = await response.json();
//       return { success: true, data: result.data };
//     } else {
//       const error = await response.json();
//       return { success: false, error: error.error };
//     }
//   };

//   const linkToRegisteredAccount = async (targetEntityId: string) => {
//     const response = await fetch('/auth/anonymous/link', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${localStorage.getItem('anonymous_token')}`,
//       },
//       body: JSON.stringify({ targetEntityId }),
//     });

//     if (response.ok) {
//       const data = await response.json();
//       return { success: true, message: data.message };
//     } else {
//       const error = await response.json();
//       return { success: false, error: error.error };
//     }
//   };

//   const convertToUser = async (email: string, password: string, username?: string) => {
//     const response = await fetch('/auth/anonymous/convert', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${localStorage.getItem('anonymous_token')}`,
//       },
//       body: JSON.stringify({ email, password, username }),
//     });

//     if (response.ok) {
//       const data = await response.json();
//       // Clear anonymous data
//       localStorage.removeItem('anonymousId');
//       localStorage.removeItem('anonymous_token');
//       return { success: true, user: data.user, message: data.message };
//     } else {
//       const error = await response.json();
//       return { success: false, error: error.error };
//     }
//   };

//   return { createAnonymousUser, updateAnonymousData, linkToRegisteredAccount, convertToUser };
// };

// /**
//  * E-commerce cart example using anonymous users
//  */
// export class AnonymousCartManager {
//   private reAuth: any;

//   constructor(reAuth: any) {
//     this.reAuth = reAuth;
//   }

//   async addToCart(entity: Entity, productId: string, quantity: number) {
//     if (!entity.is_anonymous) {
//       throw new Error('This cart manager is for anonymous users only');
//     }

//     const currentData = entity.anonymous_data || {};
//     const cart = currentData.cart || [];
    
//     // Check if product already in cart
//     const existingItem = cart.find((item: any) => item.id === productId);
    
//     if (existingItem) {
//       existingItem.quantity += quantity;
//     } else {
//       cart.push({ id: productId, quantity, added_at: new Date() });
//     }

//     return this.reAuth.executeStep('anonymous', 'update-anonymous-data', {
//       entity,
//       data: { ...currentData, cart },
//     });
//   }

//   async removeFromCart(entity: Entity, productId: string) {
//     if (!entity.is_anonymous) {
//       throw new Error('This cart manager is for anonymous users only');
//     }

//     const currentData = entity.anonymous_data || {};
//     const cart = (currentData.cart || []).filter((item: any) => item.id !== productId);

//     return this.reAuth.executeStep('anonymous', 'update-anonymous-data', {
//       entity,
//       data: { ...currentData, cart },
//     });
//   }

//   async getCart(entity: Entity) {
//     if (!entity.is_anonymous) {
//       throw new Error('This cart manager is for anonymous users only');
//     }

//     const result = await this.reAuth.executeStep('anonymous', 'get-anonymous-data', {
//       entity,
//     });

//     return result.success ? result.data.cart || [] : [];
//   }

//   async transferCartToUser(anonymousEntity: Entity, registeredUserId: string) {
//     return this.reAuth.executeStep('anonymous', 'link-account', {
//       entity: anonymousEntity,
//       targetEntityId: registeredUserId,
//     });
//   }
// }

// // Usage example:
// // const cartManager = new AnonymousCartManager(reAuth);
// // await cartManager.addToCart(anonymousUser, 'product-123', 2); 