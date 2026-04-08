const { z } = require('zod')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('playwise-secret'),
  JWT_EXPIRES: z.string().default('7d'),
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_SETUP_CODE: z.string().optional(),
  IGDB_CLIENT_ID: z.string().optional(),
  IGDB_CLIENT_SECRET: z.string().optional(),
  IGDB_CACHE_MS: z.coerce.number().default(1000 * 60 * 60 * 6),
  IGDB_TOP_GAMES_LIMIT: z.coerce.number().default(30),
  ITAD_API_KEY: z.string().optional(),
  ITAD_COUNTRY: z.string().default('IN'),
  PRICE_CACHE_MS: z.coerce.number().default(1000 * 60 * 60 * 6),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.15)
})

const env = envSchema.parse(process.env)

module.exports = { env }
