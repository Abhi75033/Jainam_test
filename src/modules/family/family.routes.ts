import { Router } from 'express';
import { requireAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { addFamilyMemberSchema } from '@/modules/members/members.dto';
import { addFamilyMember } from '@/modules/members/members.controller';

/**
 * Family Members Management (§5.2). Kept as its own routed module per the
 * spec's module list, but implemented on top of members.service.ts since a
 * family member IS a Member record (auto-linked or auto-created).
 */
export const familyRoutes = Router();

familyRoutes.post('/', requireAuth, validate(addFamilyMemberSchema), addFamilyMember);
