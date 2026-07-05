import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import { RoleKey } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // userId
  publicId: string | null;
  role: RoleKey;
  isSuperAdmin: boolean;
  deviceId?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  deviceId: string;
  tokenVersion: string; // random per-issue value, checked against stored hash
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
