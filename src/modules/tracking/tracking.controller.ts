import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as trackingService from './tracking.service';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

export const ingestPing = asyncHandler(async (req: Request, res: Response) => {
  const ping = await trackingService.ingestLocationPing(req.body);
  return created(res, { received: true, pingId: ping.id });
});

export const createRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await trackingService.createRoute({ ...req.body, createdById: req.actor!.userId });
  await recordAudit({ ...auditContextFromRequest(req), module: 'TRACKING', action: 'ROUTE_CHANGE', entityType: 'Route', entityId: route.id, after: route, isCritical: true });
  return created(res, route);
});

export const updateRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await trackingService.updateRoute(req.params.routeId as string, req.body);
  await recordAudit({ ...auditContextFromRequest(req), module: 'TRACKING', action: 'ROUTE_CHANGE', entityType: 'Route', entityId: route.id, after: route, isCritical: true });
  return ok(res, route);
});

export const listRoutes = asyncHandler(async (req: Request, res: Response) => {
  const routes = await trackingService.listRoutes({ monkId: req.query.monkId as string | undefined });
  return ok(res, routes);
});

export const startJourney = asyncHandler(async (req: Request, res: Response) => {
  const journey = await trackingService.startJourney(req.body.routeId);
  return created(res, journey);
});

export const recordJourneyEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await trackingService.recordJourneyEvent(req.params.journeyId as string, { ...req.body, createdById: req.actor!.userId });
  return created(res, event);
});

export const journeyTimeline = asyncHandler(async (req: Request, res: Response) => {
  const timeline = await trackingService.getJourneyTimeline(req.params.journeyId as string);
  return ok(res, timeline);
});

export const liveMap = asyncHandler(async (req: Request, res: Response) => {
  const markers = await trackingService.getLiveMap(req.query as any);
  return ok(res, markers);
});

export const memberMonkView = asyncHandler(async (req: Request, res: Response) => {
  const monk = await trackingService.getMemberMonkView(req.params.monkId as string);
  return ok(res, monk);
});

export const raiseSos = asyncHandler(async (req: Request, res: Response) => {
  const alert = await trackingService.raiseSosAlert(req.params.monkId as string, req.body.message ?? 'SOS raised');
  return created(res, alert);
});
