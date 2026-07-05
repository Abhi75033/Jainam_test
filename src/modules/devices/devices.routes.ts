import { Router } from 'express';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { registerDeviceSchema, assignDeviceSchema, addSimRecordSchema } from './devices.dto';
import * as devicesController from './devices.controller';

export const deviceRoutes = Router();

deviceRoutes.get('/', requireAuth, requirePermission('DEVICES', 'VIEW'), devicesController.listDevices);
deviceRoutes.post('/', requireAuth, requirePermission('DEVICES', 'CREATE'), validate(registerDeviceSchema), devicesController.registerDevice);
deviceRoutes.patch('/:deviceId/assign', requireAuth, requirePermission('DEVICES', 'EDIT'), validate(assignDeviceSchema), devicesController.assignDevice);
deviceRoutes.post('/:deviceId/sim-records', requireAuth, requirePermission('DEVICES', 'EDIT'), validate(addSimRecordSchema), devicesController.addSimRecord);
