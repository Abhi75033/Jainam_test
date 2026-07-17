import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

const createPollSchema = z.object({
  body: z.object({
    feedPostId: z.string().min(1).optional(),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(10),
    allowMultiple: z.boolean().default(false),
    endsAt: z.coerce.date().optional(),
  }),
});

const voteSchema = z.object({ body: z.object({ optionIndex: z.number().int().min(0) }) });

/** Polls (§5.13): created by admins on feed posts, member voting, results. */
export const pollRoutes = Router();

pollRoutes.post('/', requireAuth, requirePermission('POLLS', 'CREATE'), validate(createPollSchema), asyncHandler(async (req: Request, res: Response) => {
  let { feedPostId } = req.body as { feedPostId?: string };
  if (!feedPostId) {
    // Admin panel creates standalone polls — wrap them in a feed post automatically
    const post = await prisma.feedPost.create({
      data: { title: req.body.question, type: 'MANUAL', sourceModule: 'POLLS', authorUserId: req.actor!.userId },
    });
    feedPostId = post.id;
  }
  const poll = await prisma.poll.create({ data: { ...req.body, feedPostId } });
  return created(res, poll);
}));

pollRoutes.post('/:pollId/vote', requireAuth, validate(voteSchema), asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');

  const poll = await prisma.poll.findUnique({ where: { id: req.params.pollId as string } });
  if (!poll) throw ApiError.notFound('Poll not found');
  if (poll.endsAt && poll.endsAt < new Date()) throw ApiError.conflict('This poll has closed');
  const options = poll.options as string[];
  if (req.body.optionIndex >= options.length) throw ApiError.validation({ optionIndex: ['Invalid option'] });

  const vote = await prisma.pollVote.upsert({
    where: { pollId_memberId: { pollId: poll.id, memberId: member.id } },
    update: { optionIndex: req.body.optionIndex },
    create: { pollId: poll.id, memberId: member.id, optionIndex: req.body.optionIndex },
  });
  return created(res, vote);
}));

pollRoutes.get('/:pollId/results', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const poll = await prisma.poll.findUnique({
    where: { id: req.params.pollId as string },
    include: { votes: true },
  });
  if (!poll) throw ApiError.notFound('Poll not found');

  const options = poll.options as string[];
  const counts = options.map((label, index) => ({
    index,
    label,
    votes: poll.votes.filter((v) => v.optionIndex === index).length,
  }));
  return ok(res, { question: poll.question, totalVotes: poll.votes.length, options: counts, endsAt: poll.endsAt });
}));
