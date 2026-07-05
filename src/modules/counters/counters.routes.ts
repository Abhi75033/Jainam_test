import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as countersService from './counters.service';

const deltaSchema = z.object({
  body: z.object({
    counterTypeId: z.string().min(1),
    subTypeId: z.string().nullable().optional(),
    delta: z.number().int(),
  }),
});

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const counterRoutes = Router();

counterRoutes.get('/my', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const counters = await countersService.myCounters(member.id);
  return ok(res, counters.map((c) => ({ ...c, count: c.count.toString() })));
}));

counterRoutes.post('/delta', requireAuth, validate(deltaSchema), asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const counter = await countersService.applyDelta(member.id, req.body.counterTypeId, req.body.subTypeId ?? null, req.body.delta);
  return ok(res, { ...counter, count: counter.count.toString() });
}));

counterRoutes.post('/:counterId/reset', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const counter = await countersService.resetCounter(member.id, req.params.counterId as string);
  return ok(res, { ...counter, count: counter.count.toString() });
}));

counterRoutes.post('/reset-all', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const result = await countersService.resetAllCounters(member.id);
  return ok(res, result);
}));

// Temple admin: primary-linked members' counts + date-range reports (§5.18)
counterRoutes.get('/org/:organizationId', requireAuth, requirePermission('COUNTERS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const rows = await countersService.orgMemberCounters(
    req.params.organizationId as string,
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
  );
  return ok(res, rows);
}));

counterRoutes.get('/leaderboard', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const rows = await countersService.leaderboard(req.query.counterTypeId as string | undefined);
  return ok(res, rows);
}));
