import { Router } from 'express';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { createRouteSchema, updateRouteSchema, startJourneySchema, journeyEventSchema, liveMapQuerySchema } from './tracking.dto';
import { locationPingSchema } from '@/modules/devices/devices.dto';
import * as trackingController from './tracking.controller';

export const trackingRoutes = Router();

// GPS device ingestion — device-authenticated endpoint (devices post with a device API token
// in production; kept behind requireAuth for admin-side testing until device tokens are provisioned)
trackingRoutes.post('/pings', requireAuth, validate(locationPingSchema), trackingController.ingestPing);

// Routes: A→B→C→D multi-stop builder (§5.10)
trackingRoutes.post('/routes', requireAuth, requirePermission('TRACKING', 'CREATE'), validate(createRouteSchema), trackingController.createRoute);
trackingRoutes.patch('/routes/:routeId', requireAuth, requirePermission('TRACKING', 'EDIT'), validate(updateRouteSchema), trackingController.updateRoute);
trackingRoutes.get('/routes', requireAuth, trackingController.listRoutes);

// Journeys: manual tracking + timeline
trackingRoutes.post('/journeys', requireAuth, requirePermission('TRACKING', 'CREATE'), validate(startJourneySchema), trackingController.startJourney);
trackingRoutes.post('/journeys/:journeyId/events', requireAuth, requirePermission('TRACKING', 'EDIT'), validate(journeyEventSchema), trackingController.recordJourneyEvent);
trackingRoutes.get('/journeys/:journeyId/timeline', requireAuth, trackingController.journeyTimeline);

// Live map for admin dashboards
trackingRoutes.get('/live-map', requireAuth, requirePermission('TRACKING', 'VIEW'), validate(liveMapQuerySchema), trackingController.liveMap);

// Member-side monk views (privacy-filtered)
trackingRoutes.get('/monks/:monkId', requireAuth, trackingController.memberMonkView);

// SOS
trackingRoutes.post('/monks/:monkId/sos', requireAuth, requirePermission('TRACKING', 'EDIT'), trackingController.raiseSos);
