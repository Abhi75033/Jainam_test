import { prisma } from '@/config/prisma';
import { logger } from '@/config/logger';
import { enqueueNotification } from '@/engines/notification/notification.service';

const DOC_EXPIRY_WARNING_DAYS = 30;
const NOT_CHECKED_OUT_HOURS = 12;

/**
 * Daily staff sweep (§4.3 staff/admin triggers): "staff not checked out" and
 * "document expiry" notifications to the staff member and their org admins.
 */
export async function runStaffSweep() {
  const now = new Date();

  // 1. Documents expiring within 30 days (current docs only)
  const expiringDocs = await prisma.staffDocument.findMany({
    where: {
      isCurrent: true,
      expiryDate: { gte: now, lte: new Date(now.getTime() + DOC_EXPIRY_WARNING_DAYS * 24 * 3600_000) },
    },
    include: { staff: { include: { member: { select: { userId: true, fullName: true } }, organization: { select: { id: true, name: true } } } } },
  });

  for (const doc of expiringDocs) {
    const daysLeft = Math.ceil((doc.expiryDate!.getTime() - now.getTime()) / (24 * 3600_000));
    const orgAdmins = await prisma.userOrganization.findMany({
      where: { organizationId: doc.staff.organization.id, roleKey: { in: ['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN'] } },
      select: { userId: true },
    });
    const recipients = new Set([doc.staff.member.userId, ...orgAdmins.map((a) => a.userId)]);
    await Promise.all(
      Array.from(recipients).map((userId) =>
        enqueueNotification({
          userId,
          templateKey: 'STAFF_DOCUMENT_EXPIRING',
          category: 'SERVICE',
          to: { PUSH: userId, IN_APP: userId },
          body: `${doc.staff.member.fullName}'s ${doc.docType} document expires in ${daysLeft} day(s). Please upload a replacement.`,
        }),
      ),
    );
  }

  // 2. Staff yet to check out (open attendance older than threshold)
  const staleAttendance = await prisma.staffAttendance.findMany({
    where: { checkOutAt: null, checkInAt: { lt: new Date(now.getTime() - NOT_CHECKED_OUT_HOURS * 3600_000) } },
    include: { staff: { include: { member: { select: { userId: true, fullName: true } }, organization: { select: { id: true } } } } },
  });

  for (const attendance of staleAttendance) {
    const orgAdmins = await prisma.userOrganization.findMany({
      where: { organizationId: attendance.staff.organization.id, roleKey: { in: ['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN'] } },
      select: { userId: true },
    });
    const recipients = new Set([attendance.staff.member.userId, ...orgAdmins.map((a) => a.userId)]);
    await Promise.all(
      Array.from(recipients).map((userId) =>
        enqueueNotification({
          userId,
          templateKey: 'STAFF_NOT_CHECKED_OUT',
          category: 'SERVICE',
          to: { PUSH: userId, IN_APP: userId },
          body: `${attendance.staff.member.fullName} has not checked out since ${attendance.checkInAt.toLocaleString()}.`,
        }),
      ),
    );
  }

  logger.debug({ expiringDocs: expiringDocs.length, staleAttendance: staleAttendance.length }, 'staff sweep complete');
}
