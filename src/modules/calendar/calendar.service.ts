import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { enqueueNotification } from '@/engines/notification/notification.service';

/**
 * Tithi Calendar (§5.17): Super Admin CRUDs types + per-year daily entries;
 * members select a calendar (changeable in settings); daily morning
 * notifications; correction ticket flow lives in tithiCorrectionTicket rows.
 */

export async function upsertEntries(calendarTypeId: string, year: number, entries: { gregorianDate: Date; tithiName: string; description?: string }[]) {
  const type = await prisma.tithiCalendarType.findUnique({ where: { id: calendarTypeId } });
  if (!type || type.deletedAt) throw ApiError.notFound('Calendar type not found');

  for (const entry of entries) {
    await prisma.tithiCalendarEntry.upsert({
      where: { calendarTypeId_gregorianDate: { calendarTypeId, gregorianDate: entry.gregorianDate } },
      update: { tithiName: entry.tithiName, description: entry.description, year },
      create: { calendarTypeId, year, gregorianDate: entry.gregorianDate, tithiName: entry.tithiName, description: entry.description },
    });
  }
  return prisma.tithiCalendarEntry.count({ where: { calendarTypeId, year } });
}

export async function todaysTithi(calendarTypeId: string) {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const entry = await prisma.tithiCalendarEntry.findFirst({
    where: { calendarTypeId, gregorianDate: { gte: dayStart, lt: dayEnd } },
  });
  return entry ?? null; // client shows "No tithi available" (§5.17)
}

export async function monthView(calendarTypeId: string, year: number, month: number) {
  return prisma.tithiCalendarEntry.findMany({
    where: {
      calendarTypeId,
      gregorianDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) },
    },
    orderBy: { gregorianDate: 'asc' },
  });
}

/** Daily morning job (§4.3): "Today is Poonam" per member's selected calendar + temple admins. */
export async function sendDailyTithiNotifications() {
  const types = await prisma.tithiCalendarType.findMany({ where: { deletedAt: null } });

  for (const type of types) {
    const entry = await todaysTithi(type.id);
    if (!entry) continue;

    const members = await prisma.member.findMany({
      where: { tithiCalendarTypeId: type.id, status: 'ACTIVE', deletedAt: null },
      select: { userId: true },
    });

    const orgAdmins = await prisma.userOrganization.findMany({
      where: { organization: { tithiCalendarTypeId: type.id, deletedAt: null } },
      select: { userId: true },
    });

    const userIds = new Set([...members.map((m) => m.userId), ...orgAdmins.map((a) => a.userId)]);
    const body = `Today is ${entry.tithiName}${entry.description ? ` — ${entry.description}` : ''}`;

    await Promise.all(
      Array.from(userIds).map((userId) =>
        enqueueNotification({
          userId,
          templateKey: 'TITHI_DAILY',
          category: 'SERVICE',
          to: { PUSH: userId, IN_APP: userId },
          body,
        }),
      ),
    );
  }
}

// --- Correction tickets (§5.17) ---

export async function raiseCorrectionTicket(input: { raisedByOrgId?: string; calendarTypeId: string; date: Date; issue: string }) {
  return prisma.tithiCorrectionTicket.create({ data: input });
}

export async function decideCorrectionTicket(ticketId: string, status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED', resolution?: string) {
  return prisma.tithiCorrectionTicket.update({ where: { id: ticketId }, data: { status, resolution } });
}

export async function listCorrectionTickets(status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
  return prisma.tithiCorrectionTicket.findMany({
    where: { status },
    include: { calendarType: true, raisedByOrg: { select: { name: true, publicId: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
