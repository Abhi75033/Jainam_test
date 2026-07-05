import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
redis.on('connect', () => logger.info('Redis connected'));

/**
 * Plain connection options (not a shared ioredis instance) for BullMQ.
 * BullMQ bundles its own pinned `ioredis` version, which is structurally
 * incompatible at the TypeScript level with whatever top-level `ioredis`
 * version this project installs — passing a plain options object sidesteps
 * that cross-package nominal-typing conflict entirely and lets BullMQ manage
 * its own connections internally (per BullMQ's own recommendation).
 */
export function bullConnectionOptions() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}
