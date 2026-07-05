import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as devicesService from './devices.service';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await devicesService.registerDevice(req.body);
  return created(res, device);
});

export const assignDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await devicesService.assignDevice(req.params.deviceId as string, req.body.monkId);
  await recordAudit({ ...auditContextFromRequest(req), module: 'DEVICES', action: 'DEVICE_ASSIGN', entityType: 'Device', entityId: device.id, after: { monkId: device.monkId }, isCritical: true });
  return ok(res, device);
});

export const addSimRecord = asyncHandler(async (req: Request, res: Response) => {
  const sim = await devicesService.addSimRecord(req.params.deviceId as string, req.body);
  return created(res, sim);
});

export const listDevices = asyncHandler(async (_req: Request, res: Response) => {
  const devices = await devicesService.listDevices();
  return ok(res, devices);
});
