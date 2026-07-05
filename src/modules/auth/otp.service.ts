import crypto from 'crypto';
import { redis } from '@/config/redis';
import { env } from '@/config/env';
import { ApiError } from '@/utils/ApiError';

const OTP_KEY = (mobile: string) => `otp:${mobile}`;
const OTP_ATTEMPTS_KEY = (mobile: string) => `otp:attempts:${mobile}`;
const OTP_COOLDOWN_KEY = (mobile: string) => `otp:cooldown:${mobile}`;

function generateNumericOtp(length: number): string {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, '0');
}

/** OTP engine backing §5.1 auth: Redis-stored, TTL expiry, retry limits, resend cooldown. */
export async function requestOtp(mobile: string): Promise<{ otp: string; expiresInSeconds: number }> {
  const cooldownLeft = await redis.ttl(OTP_COOLDOWN_KEY(mobile));
  if (cooldownLeft > 0) {
    throw new ApiError('RATE_LIMITED', `Please wait ${cooldownLeft}s before requesting another OTP`);
  }

  const otp = generateNumericOtp(env.OTP_LENGTH);
  await redis
    .multi()
    .set(OTP_KEY(mobile), otp, 'EX', env.OTP_TTL_SECONDS)
    .set(OTP_COOLDOWN_KEY(mobile), '1', 'EX', env.OTP_RESEND_COOLDOWN_SECONDS)
    .del(OTP_ATTEMPTS_KEY(mobile))
    .exec();

  return { otp, expiresInSeconds: env.OTP_TTL_SECONDS };
}

export async function verifyOtp(mobile: string, submittedOtp: string): Promise<void> {
  const attempts = Number((await redis.get(OTP_ATTEMPTS_KEY(mobile))) ?? '0');
  if (attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new ApiError('RATE_LIMITED', 'Too many incorrect attempts. Please request a new OTP.');
  }

  const stored = await redis.get(OTP_KEY(mobile));
  if (!stored) {
    throw new ApiError('VALIDATION_ERROR', 'OTP expired or not requested', { otp: ['OTP expired or not requested'] });
  }

  if (stored !== submittedOtp) {
    await redis.multi().incr(OTP_ATTEMPTS_KEY(mobile)).expire(OTP_ATTEMPTS_KEY(mobile), env.OTP_TTL_SECONDS).exec();
    throw new ApiError('VALIDATION_ERROR', 'Incorrect OTP', { otp: ['Incorrect OTP'] });
  }

  await redis.multi().del(OTP_KEY(mobile)).del(OTP_ATTEMPTS_KEY(mobile)).exec();
}
