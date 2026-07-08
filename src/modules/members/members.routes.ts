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
import multer from 'multer';
import * as membersController from './members.controller';
import { locationPing } from './memberLocation.controller';
import { bulkImportFromExcel } from './bulkImportExcel.controller';
import { myMemberQr } from './memberQr.controller';

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const locationPingSchema = z.object({
  body: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
});

export const memberRoutes = Router();

// Geofence ping (§4.3): updates current GPS + fires "temple within 5km" notifications
memberRoutes.post('/me/location', requireAuth, validate(locationPingSchema), locationPing);

// Admin member register list (must precede /:publicId)
memberRoutes.get('/', requireAuth, requirePermission('MEMBERS', 'VIEW'), membersController.listMembers);
memberRoutes.post('/admin-create', requireAuth, requirePermission('MEMBERS', 'CREATE'), membersController.adminCreateMember);
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
// Excel (.xlsx) upload variant of bulk import (§5.2)
memberRoutes.post(
  '/bulk-import/excel',
  requireAuth,
  requirePermission('MEMBERS', 'CREATE'),
  excelUpload.single('file'),
  bulkImportFromExcel,
);
// Member ID QR — digital membership card (§4.5)
memberRoutes.get('/me/qr', requireAuth, myMemberQr);
