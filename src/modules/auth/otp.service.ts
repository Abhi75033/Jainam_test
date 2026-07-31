import crypto from 'crypto';
import { redis } from '@/config/redis';
import { env } from '@/config/env';
import { ApiError } from '@/utils/ApiError';
import { logger } from '@/config/logger';

const OTP_KEY = (mobile: string) => `otp:${mobile}`;
const OTP_ATTEMPTS_KEY = (mobile: string) => `otp:attempts:${mobile}`;
const OTP_COOLDOWN_KEY = (mobile: string) => `otp:cooldown:${mobile}`;

function generateNumericOtp(length: number): string {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, '0');
}

/** OTP engine backing auth: MSG91 integration for +91 numbers with Redis-stored fallback. */
export async function requestOtp(mobile: string): Promise<{ otp: string; expiresInSeconds: number; provider: string }> {
  const cooldownLeft = await redis.ttl(OTP_COOLDOWN_KEY(mobile));
  if (cooldownLeft > 0) {
    throw new ApiError('RATE_LIMITED', `Please wait ${cooldownLeft}s before requesting another OTP`);
  }

  const otp = generateNumericOtp(env.OTP_LENGTH);
  const cleanMobile = mobile.replace(/\D/g, '');
  const isIndianMobile = mobile.startsWith('+91') || (cleanMobile.length === 10);
  const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

  await redis
    .multi()
    .set(OTP_KEY(mobile), otp, 'EX', env.OTP_TTL_SECONDS)
    .set(OTP_COOLDOWN_KEY(mobile), '1', 'EX', env.OTP_RESEND_COOLDOWN_SECONDS)
    .del(OTP_ATTEMPTS_KEY(mobile))
    .exec();

  // If MSG91_AUTH_KEY is configured and number is Indian (+91), call MSG91 API
  if (env.MSG91_AUTH_KEY && isIndianMobile) {
    try {
      const templateParam = env.MSG91_TEMPLATE_ID ? `&template_id=${env.MSG91_TEMPLATE_ID}` : '';
      const url = `https://control.msg91.com/api/v5/otp?mobile=${formattedMobile}${templateParam}&otp=${otp}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authkey: env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json() as any;
      if (data?.type === 'error') {
        logger.warn({ mobile, data }, 'MSG91 OTP request warning');
      } else {
        logger.info({ mobile }, 'MSG91 OTP dispatched successfully');
      }
    } catch (err: any) {
      logger.error({ mobile, error: err.message }, 'Failed to dispatch MSG91 OTP');
    }
    return { otp, expiresInSeconds: env.OTP_TTL_SECONDS, provider: 'MSG91' };
  }

  return { otp, expiresInSeconds: env.OTP_TTL_SECONDS, provider: 'REDIS_DEV' };
}

export async function verifyOtp(mobile: string, submittedOtp: string): Promise<void> {
  const attempts = Number((await redis.get(OTP_ATTEMPTS_KEY(mobile))) ?? '0');
  if (attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new ApiError('RATE_LIMITED', 'Too many incorrect attempts. Please request a new OTP.');
  }

  const cleanMobile = mobile.replace(/\D/g, '');
  const isIndianMobile = mobile.startsWith('+91') || (cleanMobile.length === 10);
  const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

  // If MSG91 is configured and mobile is Indian, verify with MSG91 first if possible
  if (env.MSG91_AUTH_KEY && isIndianMobile) {
    try {
      const url = `https://control.msg91.com/api/v5/otp/verify?otp=${submittedOtp}&mobile=${formattedMobile}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { authkey: env.MSG91_AUTH_KEY },
      });
      const data = await response.json() as any;
      if (data?.type === 'success' || data?.message?.toLowerCase().includes('success')) {
        await redis.multi().del(OTP_KEY(mobile)).del(OTP_ATTEMPTS_KEY(mobile)).exec();
        return;
      }
    } catch (err: any) {
      logger.warn({ mobile, error: err.message }, 'MSG91 OTP verify API failed, falling back to stored OTP check');
    }
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
