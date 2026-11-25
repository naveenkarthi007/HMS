const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CORS_ORIGIN: z
      .string()
      .url('CORS_ORIGIN must be a URL like http://localhost:5173')
      .default('http://localhost:5173'),
    DB_HOST: z.string().min(1, 'DB_HOST is required'),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().min(1, 'DB_USER is required'),
    DB_PASSWORD: z.string({ error: 'DB_PASSWORD is required (it may be empty: DB_PASSWORD=)' }),
    DB_NAME: z
      .string()
      .min(1, 'DB_NAME is required')
      .regex(/^[A-Za-z0-9_]+$/, 'DB_NAME may only contain letters, digits and underscores'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  })
  .refine((v) => v.JWT_ACCESS_SECRET !== v.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    path: ['JWT_REFRESH_SECRET'],
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
  console.error(
    [
      '',
      '[config] Invalid or missing environment variables in backend/.env:',
      ...lines,
      '',
      'Copy backend/.env.example to backend/.env and fill in the values.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const env = Object.freeze({
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
});

module.exports = env;
