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

function computeDiff(before: any, after: any): any {
  if (!before || !after) return null;
  const diff: Record<string, { old: any; new: any }> = {};
  try {
    const bObj = typeof before === 'object' ? before : JSON.parse(before);
    const aObj = typeof after === 'object' ? after : JSON.parse(after);
    const keys = new Set([...Object.keys(bObj || {}), ...Object.keys(aObj || {})]);
    for (const key of keys) {
      const oldVal = bObj?.[key];
      const newVal = aObj?.[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }
  } catch (err) {
    // Fail-safe
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

/** Automatic middleware-level audit for every mutating action (§4.4). Immutable — no update/delete API exists for this model. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const userAgent = (input.deviceInfo as any)?.userAgent || undefined;
  const diff = computeDiff(input.before, input.after);

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
      diff: diff as any,
      ip: input.ip,
      ipAddress: input.ip,
      userAgent: userAgent,
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
