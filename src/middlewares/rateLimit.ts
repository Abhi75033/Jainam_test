import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';
import { RedisRateLimitStore } from './redisRateLimitStore';

/**
 * Rate limiting backed by Redis (§1, §8) so limits hold across horizontally
 * scaled API instances. Test environment falls back to the in-memory store so
 * unit tests never need a live Redis.
 */
const useRedisStore = env.NODE_ENV !== 'test';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...(useRedisStore ? { store: new RedisRateLimitStore('global') } : {}),
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
  ...(useRedisStore ? { store: new RedisRateLimitStore('auth') } : {}),
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before retrying.' },
  },
});
