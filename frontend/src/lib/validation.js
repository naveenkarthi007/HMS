import { z } from 'zod';

/** Shared client-side zod rules (mirroring the API). */

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number');

export const requiredText = (label, min = 2, max = 120) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const email = z.string().trim().toLowerCase().email('Enter a valid email');

/** Converts '' to null for optional fields before sending to the API. */
export const emptyToNull = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, value === '' ? null : value]));
