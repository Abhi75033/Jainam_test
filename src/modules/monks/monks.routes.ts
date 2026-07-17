import { Router } from 'express';
import { requireAuth, requireRole, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import multer from 'multer';
import { createMonkSchema, updateMonkSchema, createMonkGroupSchema } from './monks.dto';
import * as monksController from './monks.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const monkRoutes = Router();

// Export (before /:monkId to avoid catch-all)
monkRoutes.get('/export', requireAuth, requirePermission('MONKS', 'VIEW'), monksController.exportMonksExcel);
monkRoutes.get('/import-template', requireAuth, monksController.downloadMonkTemplate);

monkRoutes.get('/', requireAuth, monksController.listMonks);
monkRoutes.get('/:monkId', requireAuth, monksController.getMonk);

// Create / Update / Delete
monkRoutes.post('/', requireAuth, requirePermission('MONKS', 'CREATE'), validate(createMonkSchema), monksController.createMonk);
monkRoutes.patch('/:monkId', requireAuth, requirePermission('MONKS', 'EDIT'), validate(updateMonkSchema), monksController.updateMonk);
monkRoutes.delete('/:monkId', requireAuth, requireRole('SUPER_ADMIN'), monksController.deleteMonk);

// Photo upload
monkRoutes.post('/:monkId/photo', requireAuth, requirePermission('MONKS', 'EDIT'), upload.single('photo'), monksController.uploadMonkPhoto);

// Status toggle
monkRoutes.patch('/:monkId/status', requireAuth, requirePermission('MONKS', 'EDIT'), monksController.updateMonkStatus);

// Bulk import Excel
monkRoutes.post('/bulk-import/excel', requireAuth, requirePermission('MONKS', 'CREATE'), upload.single('file'), monksController.bulkImportMonksExcel);

// Groups
monkRoutes.post('/groups', requireAuth, requirePermission('MONKS', 'CREATE'), validate(createMonkGroupSchema), monksController.createMonkGroup);

// Follow / Unfollow
monkRoutes.post('/:monkId/follow', requireAuth, monksController.followMonk);
monkRoutes.post('/:monkId/unfollow', requireAuth, monksController.unfollowMonk);

