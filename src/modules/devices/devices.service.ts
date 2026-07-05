import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { logger } from '@/config/logger';
import { raiseAlert } from '@/modules/alerts/alerts.service';

export async function registerDevice(input: { monkId?: string; type?: string }) {
  return prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('DEVICE', tx);
    return tx.device.create({ data: { publicId, monkId: input.monkId, type: input.type ?? 'GPS_TRACKER' } });
  });
}

export async function assignDevice(deviceId: string, monkId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw ApiError.notFound('Device not found');
  return prisma.device.update({ where: { id: deviceId }, data: { monkId } });
}

export async function addSimRecord(deviceId: string, input: { operator?: string; msisdn?: string; validityStart?: Date; validityExpiry?: Date }) {
  return prisma.simRecord.create({ data: { deviceId, ...input } });
}

export async function listDevices() {
  return prisma.device.findMany({
    include: {
      monk: { select: { publicId: true, dikshaName: true } },
      simRecords: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Periodic sweep (§5.10): offline devices (no data > threshold), low battery,
 * SIM expiry — raises Alert rows + notification fan-out.
 */
export async function runDeviceAlertSweep() {
  const thresholds = await prisma.alertThreshold.findMany();
  const offlineMinutes = thresholds.find((t) => t.type === 'OFFLINE_MINUTES')?.value ?? 30;
  const lowBatteryPct = thresholds.find((t) => t.type === 'LOW_BATTERY_PCT')?.value ?? 20;

  const devices = await prisma.device.findMany({
    where: { status: 'ACTIVE' },
    include: {
      locationPings: { orderBy: { timestamp: 'desc' }, take: 1 },
      simRecords: true,
      monk: { select: { id: true, dikshaName: true } },
    },
  });

  const now = Date.now();

  for (const device of devices) {
    const lastPing = device.locationPings[0];

    if (lastPing) {
      const minutesSince = (now - lastPing.timestamp.getTime()) / 60000;
      if (minutesSince > offlineMinutes) {
        await raiseAlert({
          type: 'OFFLINE',
          severity: 'CRITICAL',
          monkId: device.monkId ?? undefined,
          deviceId: device.id,
          message: `Device ${device.publicId}${device.monk ? ` (${device.monk.dikshaName})` : ''} offline for ${Math.round(minutesSince)} minutes`,
          dedupeKey: `offline-${device.id}`,
        });
      }

      if (lastPing.battery !== null && lastPing.battery !== undefined && lastPing.battery <= lowBatteryPct) {
        await raiseAlert({
          type: 'LOW_BATTERY',
          severity: 'WARNING',
          monkId: device.monkId ?? undefined,
          deviceId: device.id,
          message: `Device ${device.publicId} battery at ${lastPing.battery}%`,
          dedupeKey: `battery-${device.id}`,
        });
      }
    }

    for (const sim of device.simRecords) {
      if (sim.validityExpiry && sim.validityExpiry.getTime() - now < 7 * 24 * 60 * 60 * 1000 && sim.validityExpiry.getTime() > now) {
        await raiseAlert({
          type: 'OFFLINE',
          severity: 'WARNING',
          deviceId: device.id,
          message: `SIM ${sim.msisdn ?? sim.id} on device ${device.publicId} expires on ${sim.validityExpiry.toISOString().slice(0, 10)}`,
          dedupeKey: `sim-expiry-${sim.id}`,
        });
      }
    }
  }

  logger.debug({ deviceCount: devices.length }, 'device alert sweep complete');
}
