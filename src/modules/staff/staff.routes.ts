import { Router } from 'express';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createStaffSchema,
  updateStaffModulePermissionsSchema,
  staffAttendanceCheckInSchema,
  staffLeaveSchema,
  staffLeaveDecisionSchema,
  updateEmploymentStatusSchema,
} from './staff.dto';
import * as staffController from './staff.controller';

export const staffRoutes = Router();

staffRoutes.post('/', requireAuth, requirePermission('STAFF', 'CREATE'), scopeToOrganization, validate(createStaffSchema), staffController.createStaff);
staffRoutes.get('/me/modules', requireAuth, staffController.myModules);
staffRoutes.patch('/:staffId/permissions', requireAuth, requirePermission('STAFF', 'EDIT'), validate(updateStaffModulePermissionsSchema), staffController.updateModulePermissions);
staffRoutes.patch('/:staffId/employment-status', requireAuth, requirePermission('STAFF', 'EDIT'), validate(updateEmploymentStatusSchema), staffController.updateEmploymentStatus);
staffRoutes.post('/me/attendance/check-in', requireAuth, validate(staffAttendanceCheckInSchema), staffController.checkIn);
staffRoutes.post('/me/attendance/check-out', requireAuth, staffController.checkOut);
staffRoutes.post('/me/leaves', requireAuth, validate(staffLeaveSchema), staffController.applyLeave);
staffRoutes.patch('/leaves/:leaveId', requireAuth, requirePermission('STAFF', 'APPROVE'), validate(staffLeaveDecisionSchema), staffController.decideLeave);
staffRoutes.get('/dashboard/:organizationId', requireAuth, requirePermission('STAFF', 'VIEW'), scopeToOrganization, staffController.dashboardStats);
