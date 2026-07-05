import { z } from 'zod';
import { PERMISSION_ACTIONS } from '@/config/constants';

export const createStaffSchema = z.object({
  body: z
    .object({
      organizationId: z.string().min(1),
      existingMemberPublicId: z.string().optional(),
      newMember: z
        .object({
          name: z.string().min(1),
          mobile: z.string().min(8),
          category: z.enum(['JAIN', 'NON_JAIN']).default('JAIN'),
        })
        .optional(),
      departmentId: z.string().optional(),
      designationId: z.string().optional(),
      joiningDate: z.coerce.date().optional(),
      aadhaar: z.string().optional(),
      pan: z.string().optional(),
      addresses: z.record(z.string(), z.unknown()).optional(),
      emergencyMedicalInfo: z.record(z.string(), z.unknown()).optional(),
      govtDocuments: z
        .array(z.object({ docType: z.string(), docNumber: z.string(), imageUrl: z.string().optional(), expiryDate: z.coerce.date().optional() }))
        .max(2)
        .optional(),
      modulePermissions: z.array(z.object({ module: z.string(), actions: z.array(z.enum(PERMISSION_ACTIONS)) })).optional(),
    })
    .refine((v) => v.existingMemberPublicId || v.newMember, {
      message: 'Provide either existingMemberPublicId or newMember details',
    }),
});

export const updateStaffModulePermissionsSchema = z.object({
  body: z.object({
    permissions: z.array(z.object({ module: z.string(), actions: z.array(z.enum(PERMISSION_ACTIONS)) })),
  }),
});

export const staffAttendanceCheckInSchema = z.object({
  body: z.object({ method: z.enum(['QR', 'MANUAL']).default('MANUAL'), location: z.record(z.string(), z.unknown()).optional() }),
});

export const staffLeaveSchema = z.object({
  body: z.object({
    type: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().optional(),
  }),
});

export const staffLeaveDecisionSchema = z.object({
  body: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }),
});

export const updateEmploymentStatusSchema = z.object({
  body: z.object({ employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED', 'RETIRED']) }),
});
