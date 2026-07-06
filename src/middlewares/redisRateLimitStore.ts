import type { Store, IncrementResponse, Options } from 'express-rate-limit';
import { redis } from '@/config/redis';

/**
 * Redis-backed store for express-rate-limit (§1: "Redis for ... rate limiting").
 * Fixed-window counters via INCR + PEXPIRE so limits hold across multiple API
 * instances (§8 horizontal scaling). Implemented in-house because the published
 * rate-limit-redis package pins a newer express-rate-limit major.
 */
export class RedisRateLimitStore implements Store {
  private windowMs = 60_000;
  private readonly keyPrefix: string;

  constructor(prefix: string) {
    this.keyPrefix = `ratelimit:${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.key(key);
    const results = await redis.multi().incr(redisKey).pttl(redisKey).exec();

    const totalHits = (results?.[0]?.[1] as number) ?? 1;
    let ttl = (results?.[1]?.[1] as number) ?? -1;

    if (ttl < 0) {
      await redis.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }

    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key: string): Promise<void> {
    await redis.decr(this.key(key)).catch(() => undefined);
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(this.key(key));
  }
}
