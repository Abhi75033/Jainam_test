import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { requestOtp as sendOtp, verifyOtp as checkOtp } from './otp.service';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/engines/rbac/jwt.service';
import { logger } from '@/config/logger';

interface DeviceMeta {
  deviceId?: string;  // optional — server generates a fallback from IP+timestamp if absent
  deviceType: 'ANDROID' | 'IOS' | 'WEB';
  os?: string;
  appVersion?: string;
  ip?: string;
}

function resolveDeviceId(device: DeviceMeta): string {
  if (device.deviceId) return device.deviceId;
  // Fallback: stable per-IP+type identifier so sessions remain consistent
  return `server-${device.deviceType}-${crypto.createHash('sha1').update((device.ip || 'unknown') + device.deviceType).digest('hex').slice(0, 12)}`;
}

const SUSPICIOUS_DEVICE_THRESHOLD = 3; // distinct devices active within window below
const SUSPICIOUS_WINDOW_HOURS = 24;
const SUSPICIOUS_FAILED_LOGIN_THRESHOLD = 5;

export async function requestOtpForPurpose(mobile: string, purpose: 'LOGIN' | 'REGISTER') {
  const existingUser = await prisma.user.findUnique({ where: { mobile } });

  if (purpose === 'LOGIN' && !existingUser) {
    throw ApiError.notFound('This mobile number is not registered. Please register first.');
  }
  if (purpose === 'REGISTER' && existingUser) {
    // §5.1: "Existing mobile → redirect-to-login response."
    return { redirectToLogin: true as const };
  }

  const { otp, expiresInSeconds } = await sendOtp(mobile);
  // In production this is sent via SMS/WhatsApp, never returned in the API response.
  // Returned here only when not in production to unblock local/dev testing without SMS creds.
  logger.info({ mobile, purpose }, 'OTP generated');
  return {
    redirectToLogin: false as const,
    expiresInSeconds,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
  };
}

async function issueTokensForUser(user: { id: string; publicId: string | null; primaryRoleKey: any }, device: DeviceMeta) {
  const resolvedDeviceId = resolveDeviceId(device);
  const refreshTokenVersion = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, deviceId: resolvedDeviceId, tokenVersion: refreshTokenVersion });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 8);

  const accessToken = signAccessToken({
    sub: user.id,
    publicId: user.publicId,
    role: user.primaryRoleKey,
    isSuperAdmin: user.primaryRoleKey === 'SUPER_ADMIN',
    deviceId: resolvedDeviceId,
  });

  await prisma.userDevice.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId: resolvedDeviceId } },
    update: {
      deviceType: device.deviceType,
      os: device.os,
      appVersion: device.appVersion,
      ip: device.ip,
      refreshTokenHash,
      isRevoked: false,
      lastActiveAt: new Date(),
    },
    create: {
      userId: user.id,
      deviceId: resolvedDeviceId,
      deviceType: device.deviceType,
      os: device.os,
      appVersion: device.appVersion,
      ip: device.ip,
      refreshTokenHash,
    },
  });

  return { accessToken, refreshToken };
}

async function flagSuspiciousIfNeeded(userId: string, mobile: string) {
  const since = new Date(Date.now() - SUSPICIOUS_WINDOW_HOURS * 60 * 60 * 1000);
  const [distinctDevices, recentFailures] = await Promise.all([
    prisma.userDevice.count({ where: { userId, lastActiveAt: { gte: since } } }),
    prisma.loginHistory.count({ where: { mobile, success: false, createdAt: { gte: since } } }),
  ]);

  const suspicious = distinctDevices > SUSPICIOUS_DEVICE_THRESHOLD || recentFailures >= SUSPICIOUS_FAILED_LOGIN_THRESHOLD;

  if (suspicious) {
    await notifySuperAdminsOfSuspiciousActivity(mobile, { distinctDevices, recentFailures });
  }
  return suspicious;
}

/** §4.3 staff/admin trigger: failed-login / multi-device activity alerts Super Admins for review. */
async function notifySuperAdminsOfSuspiciousActivity(mobile: string, stats: { distinctDevices: number; recentFailures: number }) {
  const { enqueueNotification } = await import('@/engines/notification/notification.service');
  const superAdmins = await prisma.user.findMany({ where: { primaryRoleKey: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
  await Promise.all(
    superAdmins.map((admin) =>
      enqueueNotification({
        userId: admin.id,
        templateKey: 'SUSPICIOUS_LOGIN_ACTIVITY',
        category: 'SERVICE',
        to: { IN_APP: admin.id, PUSH: admin.id },
        body: `Suspicious login activity on ${mobile}: ${stats.recentFailures} failed attempt(s), ${stats.distinctDevices} device(s) in the last ${SUSPICIOUS_WINDOW_HOURS}h. Review in Settings → Login History.`,
      }),
    ),
  );
}

export async function verifyOtpAndAuthenticate(input: {
  mobile: string;
  otp: string;
  purpose: 'LOGIN' | 'REGISTER';
  device: DeviceMeta;
}) {
  await checkOtp(input.mobile, input.otp);

  let user = await prisma.user.findUnique({ where: { mobile: input.mobile } });

  if (input.purpose === 'REGISTER') {
    if (user) throw ApiError.conflict('This mobile number is already registered.');
    user = await prisma.user.create({
      data: {
        mobile: input.mobile,
        mobileVerifiedAt: new Date(),
        status: 'PENDING_OTP', // flips to ACTIVE once the Members module completes minimum-field profile creation
        primaryRoleKey: 'MEMBER',
      },
    });
  } else {
    if (!user) throw ApiError.notFound('This mobile number is not registered.');
    if (['SUSPENDED', 'BLOCKED', 'DELETED'].includes(user.status)) {
      throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}. Contact support.`);
    }
    if (!user.mobileVerifiedAt) {
      user = await prisma.user.update({ where: { id: user.id }, data: { mobileVerifiedAt: new Date() } });
    }
  }

  const suspicious = await flagSuspiciousIfNeeded(user.id, input.mobile);

  const { accessToken, refreshToken } = await issueTokensForUser(user, input.device);

  await prisma.$transaction([
    prisma.loginHistory.create({
      data: {
        userId: user.id,
        mobile: input.mobile,
        deviceId: resolveDeviceId(input.device),
        ip: input.device.ip,
        success: true,
        flaggedSuspicious: suspicious,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  return { user, accessToken, refreshToken, suspicious };
}

export async function loginWithPassword(input: { mobile: string; password: string; device: DeviceMeta }) {
  const user = await prisma.user.findUnique({ where: { mobile: input.mobile } });
  const deviceId = resolveDeviceId(input.device);

  if (!user || !user.passwordHash) {
    await prisma.loginHistory.create({
      data: { mobile: input.mobile, deviceId, ip: input.device.ip, success: false, reason: 'INVALID_CREDENTIALS' },
    });
    throw ApiError.unauthorized('Invalid mobile number or password');
  }

  // Check if account is locked out
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (1000 * 60));
    throw ApiError.forbidden(`Account is temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minutes.`);
  }

  if (['SUSPENDED', 'BLOCKED', 'DELETED'].includes(user.status)) {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}. Contact support.`);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const isLocking = newAttempts >= 5;
    const lockoutUntil = isLocking ? new Date(Date.now() + 15 * 60 * 1000) : null;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: isLocking ? 0 : newAttempts,
        lockoutUntil,
      },
    });

    await prisma.loginHistory.create({
      data: { userId: user.id, mobile: input.mobile, deviceId, ip: input.device.ip, success: false, reason: isLocking ? 'LOCKED_OUT' : 'INVALID_CREDENTIALS' },
    });

    if (isLocking) {
      throw ApiError.forbidden('Too many failed attempts. Account has been locked for 15 minutes.');
    } else {
      throw ApiError.unauthorized(`Invalid mobile number or password. Attempt ${newAttempts} of 5.`);
    }
  }

  // Reset lockout counters on success
  const suspicious = await flagSuspiciousIfNeeded(user.id, input.mobile);
  const { accessToken, refreshToken } = await issueTokensForUser(user, input.device);

  await prisma.$transaction([
    prisma.loginHistory.create({
      data: { userId: user.id, mobile: input.mobile, deviceId, ip: input.device.ip, success: true, flaggedSuspicious: suspicious },
    }),
    prisma.user.update({ 
      where: { id: user.id }, 
      data: { 
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockoutUntil: null
      } 
    }),
  ]);

  return { user, accessToken, refreshToken, suspicious };
}

export async function refreshTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const device = await prisma.userDevice.findUnique({
    where: { userId_deviceId: { userId: payload.sub, deviceId: payload.deviceId } },
  });
  if (!device || device.isRevoked || !device.refreshTokenHash) throw ApiError.unauthorized('Session revoked');

  const matches = await bcrypt.compare(refreshToken, device.refreshTokenHash);
  if (!matches) throw ApiError.unauthorized('Session revoked');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
  const { accessToken, refreshToken: newRefreshToken } = await issueTokensForUser(user, {
    deviceId: payload.deviceId,
    deviceType: device.deviceType,
    os: device.os ?? undefined,
    appVersion: device.appVersion ?? undefined,
    ip: device.ip ?? undefined,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string, deviceId: string) {
  await prisma.userDevice.updateMany({
    where: { userId, deviceId },
    data: { isRevoked: true, refreshTokenHash: null },
  });
}
