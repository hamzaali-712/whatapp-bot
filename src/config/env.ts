import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  API_SECRET: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WHATSAPP_SESSION_ID: z.string().trim().min(1).max(100).default('main'),
  AUTH_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  WEBHOOK_URL: z.string().default('').refine(
    (value) => value === '' || z.url().safeParse(value).success,
    'WEBHOOK_URL must be a valid URL.',
  ).transform((value) => value || undefined),
  WEBHOOK_SECRET: z.string().max(512).optional().default(''),
  CORS_ORIGINS: z.string().default(''),
});

export type Environment = Omit<z.output<typeof schema>, 'CORS_ORIGINS'> & {
  CORS_ORIGINS: string[];
};

export function parseEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = schema.parse(input);
  const corsOrigins = parsed.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (parsed.NODE_ENV === 'production' && parsed.WEBHOOK_URL && !parsed.WEBHOOK_URL.startsWith('https://')) {
    throw new Error('WEBHOOK_URL must use HTTPS in production.');
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    API_SECRET: parsed.API_SECRET,
    SUPABASE_URL: parsed.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_SESSION_ID: parsed.WHATSAPP_SESSION_ID,
    AUTH_ENCRYPTION_KEY: parsed.AUTH_ENCRYPTION_KEY,
    WEBHOOK_URL: parsed.WEBHOOK_URL,
    WEBHOOK_SECRET: parsed.WEBHOOK_SECRET,
    CORS_ORIGINS: corsOrigins,
  };
}

export const env = parseEnvironment();
