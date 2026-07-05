import { Router } from 'express';
import { Request, Response } from 'express';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import * as alertsService from './alerts.service';

export const alertRoutes = Router();

alertRoutes.get(
  '/',
  requireAuth,
  requirePermission('ALERTS', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { isResolved, severity, type } = req.query as any;
    const alerts = await alertsService.listAlerts({
      isResolved: isResolved === undefined ? undefined : isResolved === 'true',
      severity,
      type,
    });
    return ok(res, alerts);
  }),
);

alertRoutes.patch(
  '/:alertId/resolve',
  requireAuth,
  requirePermission('ALERTS', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const alert = await alertsService.resolveAlert(req.params.alertId as string, req.actor!.userId);
    return ok(res, alert);
  }),
);
