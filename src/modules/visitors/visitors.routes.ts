import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as visitorsService from './visitors.service';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const checkInSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    entryType: z.enum(['MEMBER', 'NON_MEMBER', 'VEHICLE']),
    memberPublicId: z.string().optional(),
    visitorName: z.string().optional(),
    visitorMobile: z.string().optional(),
    visitorAddress: z.string().optional(),
    visitorArea: z.string().optional(),
    visitorCity: z.string().optional(),
    visitorState: z.string().optional(),
    visitorPincode: z.string().optional(),
    numberOfVisitors: z.number().int().min(1).optional(),
    vehicleNumber: z.string().optional(),
    vehicleType: z.string().optional(),
    visitType: z.string().optional(),
    visitorCategory: z.string().optional(),
    purpose: z.string().optional(),
    photoUrl: z.string().optional(),
    idempotencyKey: z.string().min(8),
    checkInAt: z.coerce.date().optional(),
    deviceId: z.string().optional(),
    offlineTempId: z.string().optional(),
    passengerMemberIds: z.string().optional(),
  }),
});

const syncSchema = z.object({
  body: z.object({ entries: z.array(checkInSchema.shape.body).min(1).max(500) }),
});

export const visitorRoutes = Router();

// Guard-safe member lookup — never returns confidential data (§5.11)
visitorRoutes.get('/member-lookup', requireAuth, requirePermission('VISITORS', 'VIEW'), asyncHandler(async (req: Request, res: Response) => {
  const idOrQr = req.query.q as string;
  if (!idOrQr) throw ApiError.validation({ q: ['Provide a member ID or QR token'] });
  const member = await visitorsService.guardMemberLookup(idOrQr);
  return ok(res, member);
}));

visitorRoutes.post('/photo', requireAuth, requirePermission('VISITORS', 'CREATE'), upload.single('photo'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.validation({ photo: ['No file uploaded'] });
  const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `visitor-${Date.now()}.${ext}`;
  const dir = path.resolve(process.cwd(), 'static', 'photos');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), req.file.buffer);
  return ok(res, { photoUrl: `/static/photos/${filename}` });
}));

visitorRoutes.post('/check-in', requireAuth, requirePermission('VISITORS', 'CREATE'), scopeToOrganization, validate(checkInSchema), asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  const { entry, replayed } = await visitorsService.checkIn({ ...req.body, checkedInByStaffId: staff?.id });
  return created(res, { ...entry, replayed });
}));

visitorRoutes.post('/check-out/:entryId', requireAuth, requirePermission('VISITORS', 'EDIT'), asyncHandler(async (req: Request, res: Response) => {
  const entry = await visitorsService.checkOut(req.params.entryId as string);
  return ok(res, entry);
}));

// Offline batch sync with idempotency (§5.11)
visitorRoutes.post('/sync', requireAuth, requirePermission('VISITORS', 'CREATE'), validate(syncSchema), asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  const results = await visitorsService.syncOfflineEntries(req.body.entries, staff?.id);
  return ok(res, results);
}));

// Admin portal
visitorRoutes.get('/live/:organizationId', requireAuth, requirePermission('VISITORS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const rows = await visitorsService.liveVisitors(req.params.organizationId as string);
  return ok(res, rows);
}));

visitorRoutes.get('/search/:organizationId', requireAuth, requirePermission('VISITORS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const {
    memberPublicId,
    vehicleNumber,
    entryPublicId,
    visitorCategory,
    visitType,
    vehicleType,
    visitStatus,
    memberVerification,
    from,
    to,
    page = 1,
    pageSize = 20
  } = req.query as any;

  const { total, rows } = await visitorsService.searchEntries(req.params.organizationId as string, {
    memberPublicId,
    vehicleNumber,
    entryPublicId,
    visitorCategory,
    visitType,
    vehicleType,
    visitStatus,
    memberVerification,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  return ok(res, rows, { total });
}));

visitorRoutes.get('/search/:organizationId/export', requireAuth, requirePermission('VISITORS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const {
    memberPublicId,
    vehicleNumber,
    entryPublicId,
    visitorCategory,
    visitType,
    vehicleType,
    visitStatus,
    memberVerification,
    from,
    to
  } = req.query as any;

  const { rows } = await visitorsService.searchEntries(req.params.organizationId as string, {
    memberPublicId,
    vehicleNumber,
    entryPublicId,
    visitorCategory,
    visitType,
    vehicleType,
    visitStatus,
    memberVerification,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page: 1,
    pageSize: 5000,
  });

  const { sendListExport, parseExportFormat } = await import('@/utils/listExport');
  return sendListExport(
    res,
    parseExportFormat(req.query.format),
    'Visitor Entries',
    rows.map((r) => ({
      entryId: r.publicId,
      type: r.entryType,
      name: r.member?.fullName ?? r.visitorName ?? '',
      category: r.visitorCategory ?? 'Non Member',
      checkIn: r.checkInAt.toISOString(),
      checkOut: r.checkOutAt?.toISOString() ?? '',
      duration: r.visitDuration ? `${r.visitDuration}m` : '',
      vehicle: r.vehicleNumber ?? '',
      visitors: r.numberOfVisitors,
      visitType: r.visitType ?? '',
    })),
    [
      { key: 'entryId', header: 'Entry ID' },
      { key: 'type', header: 'Type' },
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category' },
      { key: 'checkIn', header: 'Check-In' },
      { key: 'checkOut', header: 'Check-Out' },
      { key: 'duration', header: 'Duration' },
      { key: 'vehicle', header: 'Vehicle' },
      { key: 'visitors', header: 'Visitors' },
      { key: 'visitType', header: 'Visit Type' },
    ],
  );
}));

visitorRoutes.get('/analytics/:organizationId', requireAuth, requirePermission('VISITORS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as any;
  const analytics = await visitorsService.visitorAnalytics(
    req.params.organizationId as string,
    from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600_000),
    to ? new Date(to) : new Date(),
  );
  return ok(res, analytics);
}));

// Member-visible visit history (§5.11)
visitorRoutes.get('/my-history', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const history = await visitorsService.memberVisitHistory(member.id);
  return ok(res, history);
}));
