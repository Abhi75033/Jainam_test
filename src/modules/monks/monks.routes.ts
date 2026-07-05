import { Router } from 'express';
import { requireAuth, requireRole, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { createMonkSchema, updateMonkSchema, createMonkGroupSchema } from './monks.dto';
import * as monksController from './monks.controller';

export const monkRoutes = Router();

monkRoutes.get('/', requireAuth, monksController.listMonks);
monkRoutes.get('/:monkId', requireAuth, monksController.getMonk);
// Shared monk profiles: any temple admin with MONKS:CREATE/EDIT can create/edit (§5.4)
monkRoutes.post('/', requireAuth, requirePermission('MONKS', 'CREATE'), validate(createMonkSchema), monksController.createMonk);
monkRoutes.patch('/:monkId', requireAuth, requirePermission('MONKS', 'EDIT'), validate(updateMonkSchema), monksController.updateMonk);
// Delete is Super Admin only, everywhere (§3)
monkRoutes.delete('/:monkId', requireAuth, requireRole('SUPER_ADMIN'), monksController.deleteMonk);

monkRoutes.post('/groups', requireAuth, requirePermission('MONKS', 'CREATE'), validate(createMonkGroupSchema), monksController.createMonkGroup);

// Join Monk — member follow for journey notifications (§5.10)
monkRoutes.post('/:monkId/follow', requireAuth, monksController.followMonk);
monkRoutes.post('/:monkId/unfollow', requireAuth, monksController.unfollowMonk);
