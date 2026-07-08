import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as toursService from './tours99.service';

const createTourSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    categoryId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    location: z.string().optional(),
    description: z.string().optional(),
    coverUrl: z.string().optional(),
    jatraTarget: z.number().int().positive(), // 99/108/216/custom
    primaryMonkId: z.string().min(1), // monk linking mandatory
    monkGroupId: z.string().optional(),
  }),
});

const addParticipantSchema = z.object({
  body: z.object({
    memberPublicId: z.string().min(1),
    parentMemberPublicId: z.string().optional(),
  }),
});

const medicalFormSchema = z.object({
  body: z.object({
    bloodGroup: z.string().optional(),
    allergies: z.string().optional(),
    conditions: z.string().optional(),
    medications: z.string().optional(),
    emergencyContact: z.record(z.string(), z.unknown()).optional(),
    doctorContact: z.record(z.string(), z.unknown()).optional(),
    specialInstructions: z.string().optional(),
  }),
});

const jatraCountSchema = z.object({
  body: z.object({ date: z.coerce.date(), count: z.number().int().min(0) }),
});

const attendanceSchema = z.object({
  body: z.object({ date: z.coerce.date(), status: z.enum(['PRESENT', 'ABSENT', 'NOT_WELL']) }),
});

const communicationSchema = z.object({ body: z.object({ message: z.string().min(1).max(4000) }) });
const scheduleSchema = z.object({ body: z.object({ date: z.coerce.date(), scheduleText: z.string().min(1) }) });
const sponsorSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    memberPublicId: z.string().optional(),
    categoryId: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    contact: z.string().optional(),
  }),
});
const roomSchema = z.object({ body: z.object({ name: z.string().min(1), type: z.string().optional(), capacity: z.number().int().positive() }) });
const assignRoomSchema = z.object({
  body: z.object({ tourRoomId: z.string().min(1), checkInDate: z.coerce.date().optional(), checkOutDate: z.coerce.date().optional() }),
});

export const tourRoutes = Router();

// Tour CRUD (authorized admins; TOURS permission)
tourRoutes.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { prisma } = await import('@/config/prisma');
  const { status } = req.query as { status?: string };
  const rows = await prisma.tour.findMany({
    where: { deletedAt: null, ...(status && status !== 'ALL' ? { status: status as any } : {}) },
    include: {
      category: { select: { name: true } },
      primaryMonk: { select: { publicId: true, dikshaName: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 200,
  });
  return ok(res, rows);
}));

tourRoutes.post('/', requireAuth, requirePermission('TOURS', 'CREATE'), validate(createTourSchema), asyncHandler(async (req: Request, res: Response) => {
  const tour = await toursService.createTour({ ...req.body, createdById: req.actor!.userId });
  return created(res, tour);
}));

tourRoutes.get('/:tourId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const tour = await toursService.getTour(req.params.tourId as string);
  return ok(res, tour);
}));

tourRoutes.patch('/:tourId', requireAuth, requirePermission('TOURS', 'EDIT'), asyncHandler(async (req: Request, res: Response) => {
  const tour = await toursService.updateTour(req.params.tourId as string, req.body, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, tour);
}));

tourRoutes.post('/:tourId/transition', requireAuth, requirePermission('TOURS', 'EDIT'), asyncHandler(async (req: Request, res: Response) => {
  const tour = await toursService.transitionTour(req.params.tourId as string, req.body.status, req.actor!.userId);
  return ok(res, tour);
}));

// Participants (only by member ID) + medical forms
tourRoutes.post('/:tourId/participants', requireAuth, requirePermission('TOURS', 'EDIT'), validate(addParticipantSchema), asyncHandler(async (req: Request, res: Response) => {
  const participant = await toursService.addParticipant(req.params.tourId as string, req.body.memberPublicId, req.body.parentMemberPublicId);
  return created(res, participant);
}));

tourRoutes.get('/:tourId/participants', requireAuth, requirePermission('TOURS', 'VIEW'), asyncHandler(async (req: Request, res: Response) => {
  const { prisma } = await import('@/config/prisma');
  const rows = await prisma.tourParticipant.findMany({
    where: { tourId: req.params.tourId as string },
    include: {
      member: { select: { publicId: true, fullName: true, gender: true, mobile: true, photoUrl: true } },
      parentMember: { select: { publicId: true, fullName: true } },
      medicalForm: { select: { id: true } },
      dailyJatraCounts: { orderBy: { date: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, rows.map((r) => ({
    ...r,
    medicalComplete: !!r.medicalForm,
    cumulativeCount: r.dailyJatraCounts[0]?.cumulativeCount ?? 0,
  })));
}));

// Medical forms visible ONLY to tour admin + Super Admin (§5.19) — guarded by TOURS:VIEW permission
tourRoutes.get('/participants/:participantId', requireAuth, requirePermission('TOURS', 'VIEW'), asyncHandler(async (req: Request, res: Response) => {
  const participant = await toursService.getParticipantProfile(req.params.participantId as string);
  return ok(res, participant);
}));

tourRoutes.put('/participants/:participantId/medical-form', requireAuth, validate(medicalFormSchema), asyncHandler(async (req: Request, res: Response) => {
  const form = await toursService.submitMedicalForm(req.params.participantId as string, req.actor!.userId, req.body);
  return ok(res, form);
}));

// Sponsors
tourRoutes.post('/:tourId/sponsors', requireAuth, requirePermission('TOURS', 'EDIT'), validate(sponsorSchema), asyncHandler(async (req: Request, res: Response) => {
  const sponsor = await toursService.addSponsor(req.params.tourId as string, req.body);
  return created(res, sponsor);
}));

// Accommodation
tourRoutes.post('/:tourId/accommodation/locations', requireAuth, requirePermission('TOURS', 'EDIT'), asyncHandler(async (req: Request, res: Response) => {
  const location = await toursService.addAccommodationLocation(req.params.tourId as string, req.body.name);
  return created(res, location);
}));

tourRoutes.post('/accommodation/locations/:locationId/rooms', requireAuth, requirePermission('TOURS', 'EDIT'), validate(roomSchema), asyncHandler(async (req: Request, res: Response) => {
  const room = await toursService.addTourRoom(req.params.locationId as string, req.body);
  return created(res, room);
}));

tourRoutes.post('/participants/:participantId/room', requireAuth, requirePermission('TOURS', 'EDIT'), validate(assignRoomSchema), asyncHandler(async (req: Request, res: Response) => {
  const assignment = await toursService.assignRoom(req.params.participantId as string, req.body.tourRoomId, req.actor!.userId, req.body);
  return ok(res, assignment);
}));

tourRoutes.get('/:tourId/accommodation/occupancy', requireAuth, requirePermission('TOURS', 'VIEW'), asyncHandler(async (req: Request, res: Response) => {
  const occupancy = await toursService.accommodationOccupancy(req.params.tourId as string);
  return ok(res, occupancy);
}));

// Daily jatra counts, attendance
tourRoutes.post('/participants/:participantId/jatra-counts', requireAuth, requirePermission('TOURS', 'EDIT'), validate(jatraCountSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await toursService.enterDailyJatraCount(req.params.participantId as string, req.body.date, req.body.count, req.actor!.userId);
  return ok(res, row);
}));

tourRoutes.post('/participants/:participantId/attendance', requireAuth, requirePermission('TOURS', 'EDIT'), validate(attendanceSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await toursService.markAttendance(req.params.participantId as string, req.body.date, req.body.status);
  return ok(res, row);
}));

// Communication (text-only, permanent) + daily schedules
tourRoutes.post('/:tourId/communications', requireAuth, requirePermission('TOURS', 'EDIT'), validate(communicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const post = await toursService.postCommunication(req.params.tourId as string, req.body.message, req.actor!.userId);
  return created(res, post);
}));

tourRoutes.get('/:tourId/communications', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const posts = await toursService.listCommunications(req.params.tourId as string);
  return ok(res, posts);
}));

tourRoutes.put('/:tourId/daily-schedule', requireAuth, requirePermission('TOURS', 'EDIT'), validate(scheduleSchema), asyncHandler(async (req: Request, res: Response) => {
  const schedule = await toursService.publishDailySchedule(req.params.tourId as string, req.body.date, req.body.scheduleText);
  return ok(res, schedule);
}));

// Admin dashboard
tourRoutes.get('/:tourId/dashboard', requireAuth, requirePermission('TOURS', 'VIEW'), asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await toursService.tourDashboard(req.params.tourId as string);
  return ok(res, dashboard);
}));
