import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  },
});

/** Stricter limiter for OTP request/verify and login endpoints. */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.OTP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.mobile ?? 'unknown'}`,
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before retrying.' },
  },
});
