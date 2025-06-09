import { type } from 'arktype';

export const passwordSchema = type(
  'string|/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/',
);
export const phoneSchema = type('string|/^\\+?[1-9]\\d{1,14}$/');
export const usernameSchema = type('string|/^[a-zA-Z0-9_]{3,20}$/');
