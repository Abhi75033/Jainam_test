import { AlertSeverity, AlertType } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getIO } from '@/sockets';
import { logger } from '@/config/logger';

/**
 * Alert system (§5.10): SOS, offline, route delay, low battery.
 * Critical = red, Warning = orange on dashboards; alert feed + notification fan-out.
 * `dedupeKey` prevents alert-spam: an unresolved alert with the same message
 * source is not re-raised on every sweep.
 */
export async function raiseAlert(input: {
  type: AlertType;
  severity: AlertSeverity;
  monkId?: string;
  deviceId?: string;
  message: string;
  dedupeKey?: string;
}) {
  if (input.dedupeKey) {
    const existing = await prisma.alert.findFirst({
      where: { type: input.type, monkId: input.monkId ?? null, deviceId: input.deviceId ?? null, isResolved: false },
    });
    if (existing) return existing;
  }

  const alert = await prisma.alert.create({
    data: {
      type: input.type,
      severity: input.severity,
      monkId: input.monkId,
      deviceId: input.deviceId,
      message: input.message,
    },
  });

  // Live dashboards fan-out
  try {
    getIO().of('/dashboards').to('platform').emit('alert:new', alert);
  } catch {
    // Socket server not initialized (e.g. worker process) — dashboards refresh on next poll
  }

  logger.warn({ alertId: alert.id, type: alert.type, severity: alert.severity }, alert.message);
  return alert;
}

export async function resolveAlert(alertId: string, resolvedById: string) {
  return prisma.alert.update({ where: { id: alertId }, data: { isResolved: true, resolvedById } });
}

export async function listAlerts(filters: { isResolved?: boolean; severity?: AlertSeverity; type?: AlertType }) {
  return prisma.alert.findMany({
    where: { isResolved: filters.isResolved, severity: filters.severity, type: filters.type },
    include: { monk: { select: { publicId: true, dikshaName: true } }, device: { select: { publicId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
