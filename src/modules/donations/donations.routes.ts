import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import {
  submitManualDonationSchema,
  donationDecisionSchema,
  platformDonationSchema,
  donationListQuerySchema,
  donorLookupQuerySchema,
} from './donations.dto';
import * as donationsController from './donations.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const donationRoutes = Router();

donationRoutes.post('/upload-proof', requireAuth, upload.single('proof'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.validation({ proof: ['No file provided'] });
  const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `donation-proof-${Date.now()}.${ext}`;
  const dir = path.resolve(process.cwd(), 'static', 'photos');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), req.file.buffer);
  return ok(res, { proofUrl: `/static/photos/${filename}` });
}));


// Flow 1: manual org donation (member self-service, or admin on behalf of donor via donorMemberPublicId)
donationRoutes.post('/manual', requireAuth, validate(submitManualDonationSchema), donationsController.submitManualDonation);
donationRoutes.get('/donor-lookup', requireAuth, requirePermission('DONATIONS', 'APPROVE'), validate(donorLookupQuerySchema), donationsController.lookupDonor);
donationRoutes.post('/:donationId/decision', requireAuth, requirePermission('DONATIONS', 'APPROVE'), validate(donationDecisionSchema), donationsController.decideDonation);

// Flows 2 & 3: online platform / music festival donations (gateway, auto-confirm)
donationRoutes.post('/platform', requireAuth, validate(platformDonationSchema), donationsController.submitPlatformDonation);
donationRoutes.get('/campaign-config/:flowType', requireAuth, donationsController.getCampaignConfig);
donationRoutes.patch('/campaign-config/:flowType', requireAuth, requireRole('SUPER_ADMIN'), donationsController.updateCampaignConfig);

// Listings
donationRoutes.get('/', requireAuth, donationsController.listAllDonations); // Super Admin platform-wide
donationRoutes.get('/my', requireAuth, validate(donationListQuerySchema), donationsController.myDonations);
donationRoutes.get('/org/:organizationId', requireAuth, requirePermission('DONATIONS', 'VIEW'), scopeToOrganization, validate(donationListQuerySchema), donationsController.orgDonations);
donationRoutes.get('/org/:organizationId/export', requireAuth, requirePermission('DONATIONS', 'VIEW'), scopeToOrganization, donationsController.orgDonationsExport);
