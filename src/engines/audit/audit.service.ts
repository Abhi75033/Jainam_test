import { Request } from 'express';
import { RoleKey } from '@prisma/client';
import { prisma } from '@/config/prisma';

export interface AuditContext {
  userId?: string;
  publicId?: string;
  roleKey?: RoleKey;
  ip?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface RecordAuditInput extends AuditContext {
  organizationId?: string;
  module: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  isCritical?: boolean;
}

/** Automatic middleware-level audit for every mutating action (§4.4). Immutable — no update/delete API exists for this model. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      publicId: input.publicId,
      roleKey: input.roleKey,
      organizationId: input.organizationId,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before as any,
      after: input.after as any,
      ip: input.ip,
      deviceInfo: input.deviceInfo as any,
      isCritical: input.isCritical ?? false,
    },
  });
}

/** Critical actions flagged per §4.4: donation verification, booking approval/rejection, route changes, device assignment, profile updates, permission changes, deletions. */
export const CRITICAL_ACTIONS = new Set([
  'DONATION_VERIFY',
  'DONATION_REJECT',
  'BOOKING_APPROVE',
  'BOOKING_REJECT',
  'ROUTE_CHANGE',
  'DEVICE_ASSIGN',
  'PROFILE_UPDATE',
  'PERMISSION_CHANGE',
  'DELETE',
]);

export function auditContextFromRequest(req: Request): AuditContext {
  return {
    userId: req.actor?.userId,
    publicId: req.actor?.publicId,
    roleKey: req.actor?.role as RoleKey | undefined,
    ip: req.ip,
    deviceInfo: {
      userAgent: req.headers['user-agent'],
      deviceId: req.actor?.deviceId,
    },
  };
}
