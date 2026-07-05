import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@/middlewares/validate';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import {
  registerJainMemberSchema,
  registerNonJainMemberSchema,
  updateMemberProfileSchema,
  bulkImportSchema,
} from './members.dto';
import * as membersController from './members.controller';
import { locationPing } from './memberLocation.controller';

const locationPingSchema = z.object({
  body: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
});

export const memberRoutes = Router();

// Geofence ping (§4.3): updates current GPS + fires "temple within 5km" notifications
memberRoutes.post('/me/location', requireAuth, validate(locationPingSchema), locationPing);

memberRoutes.post('/register/jain', requireAuth, validate(registerJainMemberSchema), membersController.registerJainMember);
memberRoutes.post('/register/non-jain', requireAuth, validate(registerNonJainMemberSchema), membersController.registerNonJainMember);
memberRoutes.get('/me', requireAuth, membersController.getMyProfile);
memberRoutes.patch('/me', requireAuth, validate(updateMemberProfileSchema), membersController.updateMyProfile);
memberRoutes.get('/:publicId', requireAuth, membersController.getMemberByPublicId);
memberRoutes.post(
  '/bulk-import',
  requireAuth,
  requirePermission('MEMBERS', 'CREATE'),
  validate(bulkImportSchema),
  membersController.bulkImportMembers,
);
