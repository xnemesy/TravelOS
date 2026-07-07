import path from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from the specific backend/.env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GOOGLE_PLACES_API_KEY: z.string().min(1, "Google Places API Key is required"),
  // Aggiungi qui altre variabili come REDIS_URL, ecc.
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Environment validation failed! The server cannot start.');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
