import { z } from 'zod';

const mobileSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid mobile number with country code');

export const requestOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    purpose: z.enum(['LOGIN', 'REGISTER']),
  }),
});

const deviceInfoSchema = z.object({
  deviceId: z.string().min(1).optional(),
  deviceType: z.enum(['ANDROID', 'IOS', 'WEB']).optional().default('WEB'),
  os: z.string().optional(),
  appVersion: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    otp: z.string().length(6),
    purpose: z.enum(['LOGIN', 'REGISTER']),
  }).merge(deviceInfoSchema),
});

export const loginPasswordSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    password: z.string().min(6),
  }).merge(deviceInfoSchema),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1),
  }),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>['body'];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body'];
export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>['body'];

export const createAdminAccountSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    role: z.enum(['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN']),
    organizationIds: z.array(z.string()),
  }).superRefine((val, ctx) => {
    if (val.role !== 'MONK_ADMIN' && (!val.organizationIds || val.organizationIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['organizationIds'],
        message: 'At least one organization scope is required for this role',
      });
    }
  }),
});

export const assignAdminOrgsSchema = z.object({
  body: z.object({ organizationIds: z.array(z.string()).min(1) }),
});
