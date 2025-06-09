import { z } from 'zod';

export const entitySchema = z.object({
  id: z.string().describe('Unique entity identifier'),
  role: z.string().describe('Entity role'),
  created_at: z
    .string()
    .datetime({ offset: true })
    .describe('Creation timestamp'),
  updated_at: z
    .string()
    .datetime({ offset: true })
    .describe('Last update timestamp'),
  email: z.string().describe('email field from email-password plugin'),
  email_verified: z
    .boolean()
    .describe('email_verified field from email-password plugin'),
  password_hash: z
    .string()
    .describe('password_hash field from email-password plugin')
    .optional(),
  email_verification_code: z
    .string()
    .describe('email_verification_code field from email-password plugin')
    .optional(),
  reset_password_code: z
    .string()
    .describe('reset_password_code field from email-password plugin')
    .optional(),
  reset_password_code_expires_at: z
    .string()
    .datetime({ offset: true })
    .describe('reset_password_code_expires_at field from email-password plugin')
    .optional(),
  phone: z.string().describe('phone field from phone-password plugin'),
  phone_verified: z
    .boolean()
    .describe('phone_verified field from phone-password plugin'),
  phone_verification_code: z
    .string()
    .describe('phone_verification_code field from phone-password plugin')
    .optional(),
  phone_verification_code_expires_at: z
    .string()
    .datetime({ offset: true })
    .describe(
      'phone_verification_code_expires_at field from phone-password plugin',
    )
    .optional(),
});
