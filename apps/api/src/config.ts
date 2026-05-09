import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  PRINTABLES_GRAPHQL: z.string().url().default('https://api.printables.com/graphql/'),
  RATE_LIMIT_PER_HOUR: z.coerce.number().default(20),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const config = envSchema.parse(process.env);

export const visionProvider: 'gemini' | 'anthropic' | 'mock' = config.GOOGLE_API_KEY
  ? 'gemini'
  : config.ANTHROPIC_API_KEY
    ? 'anthropic'
    : 'mock';
