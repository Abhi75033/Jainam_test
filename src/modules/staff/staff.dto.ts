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
      departmentId: z.string().min(1, 'Department is required'),
      designationId: z.string().min(1, 'Designation is required'),
      joiningDate: z.coerce.date().optional(),
      category: z.string().min(1, 'Category is required'),
      categorySpecify: z.string().optional(),
      departmentSpecify: z.string().optional(),
      designationSpecify: z.string().optional(),
      reportingTo: z.string().optional(),
      dob: z.coerce.date().optional(),
      gender: z.string().optional(),
      permanentAddress: z.record(z.string(), z.unknown()).optional(),
      aadhaar: z.preprocess(
        (val) => (val === '' || val == null ? undefined : String(val).replace(/\D/g, '')),
        z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits').optional(),
      ),
      pan: z.preprocess(
        (val) => (val === '' || val == null ? undefined : String(val).trim().toUpperCase()),
        z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid 10-character PAN (e.g. ABCDE1234F)').optional(),
      ),
      addresses: z.record(z.string(), z.unknown()).optional(),
      emergencyMedicalInfo: z.record(z.string(), z.unknown()).optional(),
      govtDocuments: z
        .array(z.object({ docType: z.string(), docNumber: z.string(), imageUrl: z.string().optional(), expiryDate: z.coerce.date().optional() }))
        .optional(),
      modulePermissions: z.array(z.object({ module: z.string(), actions: z.array(z.enum(PERMISSION_ACTIONS)) })).optional(),
    })
    .refine((v) => v.existingMemberPublicId || v.newMember, {
      message: 'Provide either existingMemberPublicId or newMember details',
    })
    .superRefine((v, ctx) => {
      if (v.category === 'Other' && !v.categorySpecify?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categorySpecify'], message: 'Please specify the category' });
      }
      if (v.departmentId === 'OTHER' && !v.departmentSpecify?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departmentSpecify'], message: 'Please specify the department' });
      }
      if (v.designationId === 'OTHER' && !v.designationSpecify?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['designationSpecify'], message: 'Please specify the designation' });
      }
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
