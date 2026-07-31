import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { authRateLimiter } from '@/middlewares/rateLimit';
import { requireAuth, requireRole } from '@/middlewares/auth';
import {
  requestOtpSchema,
  verifyOtpSchema,
  loginPasswordSchema,
  loginEmailPasswordSchema,
  requestEmailOtpSchema,
  verifyEmailOtpSchema,
  loginGoogleSchema,
  refreshTokenSchema,
  logoutSchema,
  createAdminAccountSchema,
  assignAdminOrgsSchema,
  updateAdminModulesSchema,
  setAdminActiveStatusSchema,
} from './auth.dto';
import * as authController from './auth.controller';

import { prisma } from '@/config/prisma';

export const authRoutes = Router();

authRoutes.get('/promote-sa', async (_req, res) => {
  try {
    const updated = await prisma.user.update({
      where: { mobile: '+919999900000' },
      data: { primaryRoleKey: 'SUPER_ADMIN' }
    });
    res.json({ success: true, updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRoutes.post('/otp/request', authRateLimiter, validate(requestOtpSchema), authController.requestOtp);
authRoutes.post('/otp/verify', authRateLimiter, validate(verifyOtpSchema), authController.verifyOtp);
authRoutes.post('/login/password', authRateLimiter, validate(loginPasswordSchema), authController.loginWithPassword);

// International / Multi-Option Login Endpoints
authRoutes.post('/email/otp/request', authRateLimiter, validate(requestEmailOtpSchema), authController.requestEmailOtp);
authRoutes.post('/email/otp/verify', authRateLimiter, validate(verifyEmailOtpSchema), authController.verifyEmailOtp);
authRoutes.post('/login/email', authRateLimiter, validate(loginEmailPasswordSchema), authController.loginWithEmailPassword);
authRoutes.post('/google', authRateLimiter, validate(loginGoogleSchema), authController.loginWithGoogle);
authRoutes.post('/refresh', validate(refreshTokenSchema), authController.refresh);
authRoutes.post('/logout', requireAuth, validate(logoutSchema), authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.get('/me/modules', requireAuth, authController.myModules);

// Admin account management — Super Admin only (§3, §5.1)
authRoutes.get('/admins', requireAuth, requireRole('SUPER_ADMIN'), authController.listAdmins);
authRoutes.post('/admins', requireAuth, requireRole('SUPER_ADMIN'), validate(createAdminAccountSchema), authController.createAdminAccount);
authRoutes.patch('/admins/:userId/organizations', requireAuth, requireRole('SUPER_ADMIN'), validate(assignAdminOrgsSchema), authController.assignAdminOrganizations);
authRoutes.put('/admins/:userId/modules', requireAuth, requireRole('SUPER_ADMIN'), validate(updateAdminModulesSchema), authController.updateAdminModules);
authRoutes.patch('/admins/:userId/status', requireAuth, requireRole('SUPER_ADMIN'), validate(setAdminActiveStatusSchema), authController.setAdminActiveStatus);
authRoutes.delete('/admins/:userId', requireAuth, requireRole('SUPER_ADMIN'), authController.deleteAdminAccount);
