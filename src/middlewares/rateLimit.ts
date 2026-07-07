import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';
import { RedisRateLimitStore } from './redisRateLimitStore';

/**
 * Rate limiting backed by Redis (§1, §8) so limits hold across horizontally
 * scaled API instances. Test environment falls back to the in-memory store so
 * unit tests never need a live Redis.
 *
 * Development is exempt entirely (hot reloads, StrictMode double-fires, and
 * dashboard fan-out burn through limits instantly and the Redis counters even
 * survive API restarts). Set FORCE_RATE_LIMIT=1 to exercise the limiters in dev.
 */
const useRedisStore = env.NODE_ENV !== 'test';
const skipInDev = () => env.NODE_ENV === 'development' && process.env.FORCE_RATE_LIMIT !== '1';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  ...(useRedisStore ? { store: new RedisRateLimitStore('global') } : {}),
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  },
});

/**
 * Stricter limiter for OTP request/verify and login endpoints.
 * Only FAILED attempts count toward the limit (a successful login must never
 * lock the user out of logging in again), keyed per IP + mobile.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.OTP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${req.body?.mobile ?? 'unknown'}`,
  ...(useRedisStore ? { store: new RedisRateLimitStore('auth') } : {}),
  message: {
    success: false,
    data: null,
    meta: null,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before retrying.' },
  },
});
