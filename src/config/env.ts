import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_PATH: z.string().default('/api/v1'),
  APP_NAME: z.string().default('JiNANAM'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  OTP_LENGTH: z.coerce.number().default(6),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(30),

  QR_SIGNING_SECRET: z.string().min(1),
  FIELD_ENCRYPTION_KEY: z.string().min(1),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('./storage/uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:4000/static'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),

  FCM_SERVER_KEY: z.string().optional().default(''),
  WHATSAPP_API_URL: z.string().optional().default(''),
  WHATSAPP_API_TOKEN: z.string().optional().default(''),
  SMS_API_URL: z.string().optional().default(''),
  SMS_API_KEY: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('no-reply@jinanam.app'),

  PAYMENT_GATEWAY_KEY_ID: z.string().optional().default(''),
  PAYMENT_GATEWAY_KEY_SECRET: z.string().optional().default(''),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
