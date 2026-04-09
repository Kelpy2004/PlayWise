const { z } = require('zod')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  APP_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().default('playwise-secret'),
  JWT_EXPIRES: z.string().default('7d'),
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_SETUP_CODE: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default('common'),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  IGDB_CLIENT_ID: z.string().optional(),
  IGDB_CLIENT_SECRET: z.string().optional(),
  IGDB_CACHE_MS: z.coerce.number().default(1000 * 60 * 60 * 6),
  IGDB_TOP_GAMES_LIMIT: z.coerce.number().default(30),
  ITAD_API_KEY: z.string().optional(),
  ITAD_COUNTRY: z.string().default('IN'),
  PRICE_CACHE_MS: z.coerce.number().default(1000 * 60 * 60 * 6),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.15)
})

const env = envSchema.parse(process.env)

module.exports = { env }
