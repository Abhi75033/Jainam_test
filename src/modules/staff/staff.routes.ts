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
staffRoutes.get('/org/:organizationId', requireAuth, requirePermission('STAFF', 'VIEW'), scopeToOrganization, staffController.listOrgStaff);
staffRoutes.get('/me/qr', requireAuth, staffController.myStaffQr);
staffRoutes.post('/:staffId/shifts', requireAuth, requirePermission('STAFF', 'EDIT'), staffController.createShift);
staffRoutes.get('/:staffId/shifts', requireAuth, requirePermission('STAFF', 'VIEW'), staffController.listShifts);

// Admin-managed attendance
staffRoutes.get('/:staffId/attendance', requireAuth, requirePermission('STAFF', 'VIEW'), staffController.listAttendance);
staffRoutes.post('/:staffId/attendance/check-in', requireAuth, requirePermission('STAFF', 'EDIT'), staffController.adminCheckIn);
staffRoutes.post('/:staffId/attendance/check-out', requireAuth, requirePermission('STAFF', 'EDIT'), staffController.adminCheckOut);

// Manual attendance overrides, documents uploads and configurations
staffRoutes.post('/:staffId/manual-attendance', requireAuth, requirePermission('STAFF', 'EDIT'), staffController.addManualAttendance);
staffRoutes.post('/:staffId/documents', requireAuth, requirePermission('STAFF', 'EDIT'), staffController.uploadDocument);
staffRoutes.patch('/org/:organizationId/settings', requireAuth, requirePermission('STAFF', 'EDIT'), scopeToOrganization, staffController.updateOrgSettings);
staffRoutes.get('/org/:organizationId/reports/export', requireAuth, requirePermission('STAFF', 'VIEW'), scopeToOrganization, staffController.exportReports);
