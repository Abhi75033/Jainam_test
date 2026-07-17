import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { authRateLimiter } from '@/middlewares/rateLimit';
import { requireAuth, requireRole } from '@/middlewares/auth';
import {
  requestOtpSchema,
  verifyOtpSchema,
  loginPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  createAdminAccountSchema,
  assignAdminOrgsSchema,
} from './auth.dto';
import * as authController from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/otp/request', authRateLimiter, validate(requestOtpSchema), authController.requestOtp);
authRoutes.post('/otp/verify', authRateLimiter, validate(verifyOtpSchema), authController.verifyOtp);
authRoutes.post('/login/password', authRateLimiter, validate(loginPasswordSchema), authController.loginWithPassword);
authRoutes.post('/refresh', validate(refreshTokenSchema), authController.refresh);
authRoutes.post('/logout', requireAuth, validate(logoutSchema), authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.get('/me/modules', requireAuth, authController.myModules);

// Admin account management — Super Admin only (§3, §5.1)
authRoutes.get('/admins', requireAuth, requireRole('SUPER_ADMIN'), authController.listAdmins);
authRoutes.post('/admins', requireAuth, requireRole('SUPER_ADMIN'), validate(createAdminAccountSchema), authController.createAdminAccount);
authRoutes.patch('/admins/:userId/organizations', requireAuth, requireRole('SUPER_ADMIN'), validate(assignAdminOrgsSchema), authController.assignAdminOrganizations);
authRoutes.delete('/admins/:userId', requireAuth, requireRole('SUPER_ADMIN'), authController.deleteAdminAccount);
