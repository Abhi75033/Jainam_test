import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import { exportReport, ExportColumn, ExportFormat } from '@/engines/export/export.service';

const reportQuerySchema = z.object({
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    format: z.enum(['json', 'pdf', 'excel', 'csv']).default('json'),
  }),
});

type ReportKey = 'donations' | 'bookings' | 'events' | 'visitors' | 'members' | 'staff' | 'journeys' | 'devices';

interface ReportDef {
  title: string;
  columns: ExportColumn[];
  fetch: (organizationId: string | null, from?: Date, to?: Date) => Promise<Record<string, unknown>[]>;
}

/** Reports & Analytics module (§5.23) — every report supports PDF/Excel/CSV export (§7). */
const REPORTS: Record<ReportKey, ReportDef> = {
  donations: {
    title: 'Donations Report',
    columns: [
      { key: 'publicId', header: 'Donation ID' },
      { key: 'member', header: 'Donor' },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Date' },
    ],
    fetch: async (organizationId, from, to) => {
      const rows = await prisma.donation.findMany({
        where: { organizationId: organizationId ?? undefined, createdAt: { gte: from, lte: to } },
        include: { member: { select: { fullName: true, publicId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        member: `${r.member.fullName} (${r.member.publicId})`,
        amount: r.totalAmount.toString(),
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt.toISOString().slice(0, 10),
      }));
    },
  },
  bookings: {
    title: 'Bookings Report',
    columns: [
      { key: 'publicId', header: 'Booking ID' },
      { key: 'item', header: 'Item' },
      { key: 'member', header: 'Member' },
      { key: 'dateFrom', header: 'From' },
      { key: 'status', header: 'Status' },
      { key: 'amount', header: 'Amount' },
    ],
    fetch: async (organizationId, from, to) => {
      const rows = await prisma.booking.findMany({
        where: { organizationId: organizationId ?? undefined, createdAt: { gte: from, lte: to } },
        include: { bookingItem: { select: { name: true } }, member: { select: { fullName: true, publicId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        item: r.bookingItem.name,
        member: `${r.member.fullName} (${r.member.publicId})`,
        dateFrom: r.dateFrom.toISOString().slice(0, 10),
        status: r.status,
        amount: r.amount.toString(),
      }));
    },
  },
  events: {
    title: 'Events Report',
    columns: [
      { key: 'publicId', header: 'Event ID' },
      { key: 'title', header: 'Title' },
      { key: 'startAt', header: 'Start' },
      { key: 'status', header: 'Status' },
      { key: 'rsvps', header: 'RSVPs' },
      { key: 'tickets', header: 'Tickets' },
    ],
    fetch: async (organizationId, from, to) => {
      const rows = await prisma.event.findMany({
        where: { organizationId: organizationId ?? undefined, startAt: { gte: from, lte: to }, deletedAt: null },
        include: { _count: { select: { rsvps: true, tickets: true } } },
        orderBy: { startAt: 'desc' },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        title: r.title,
        startAt: r.startAt.toISOString().slice(0, 10),
        status: r.status,
        rsvps: r._count.rsvps,
        tickets: r._count.tickets,
      }));
    },
  },
  visitors: {
    title: 'Visitors Report',
    columns: [
      { key: 'publicId', header: 'Entry ID' },
      { key: 'entryType', header: 'Type' },
      { key: 'name', header: 'Name' },
      { key: 'checkInAt', header: 'Check-In' },
      { key: 'checkOutAt', header: 'Check-Out' },
      { key: 'vehicleNumber', header: 'Vehicle' },
    ],
    fetch: async (organizationId, from, to) => {
      const rows = await prisma.visitorEntry.findMany({
        where: { organizationId: organizationId ?? undefined, checkInAt: { gte: from, lte: to } },
        include: { member: { select: { fullName: true } } },
        orderBy: { checkInAt: 'desc' },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        entryType: r.entryType,
        name: r.member?.fullName ?? r.visitorName ?? '',
        checkInAt: r.checkInAt.toISOString(),
        checkOutAt: r.checkOutAt?.toISOString() ?? '',
        vehicleNumber: r.vehicleNumber ?? '',
      }));
    },
  },
  members: {
    title: 'Members Report (Active vs Inactive)',
    columns: [
      { key: 'publicId', header: 'Member ID' },
      { key: 'fullName', header: 'Name' },
      { key: 'category', header: 'Category' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Registered' },
    ],
    fetch: async (_organizationId, from, to) => {
      const rows = await prisma.member.findMany({
        where: { createdAt: { gte: from, lte: to }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        fullName: r.fullName,
        category: r.category,
        status: r.status,
        createdAt: r.createdAt.toISOString().slice(0, 10),
      }));
    },
  },
  staff: {
    title: 'Staff Register',
    columns: [
      { key: 'publicId', header: 'Staff ID' },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'employmentStatus', header: 'Status' },
      { key: 'joiningDate', header: 'Joined' },
    ],
    fetch: async (organizationId, from, to) => {
      const rows = await prisma.staff.findMany({
        where: { organizationId: organizationId ?? undefined, createdAt: { gte: from, lte: to }, deletedAt: null },
        include: { member: { select: { fullName: true } }, department: { select: { name: true } } },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        name: r.member.fullName,
        department: r.department?.name ?? '',
        employmentStatus: r.employmentStatus,
        joiningDate: r.joiningDate?.toISOString().slice(0, 10) ?? '',
      }));
    },
  },
  journeys: {
    title: 'Journeys & Delays Report',
    columns: [
      { key: 'route', header: 'Route' },
      { key: 'monk', header: 'Monk' },
      { key: 'status', header: 'Status' },
      { key: 'startedAt', header: 'Started' },
      { key: 'completedAt', header: 'Completed' },
    ],
    fetch: async (_organizationId, from, to) => {
      const rows = await prisma.journey.findMany({
        where: { startedAt: { gte: from, lte: to } },
        include: { route: { select: { name: true } }, monk: { select: { dikshaName: true, publicId: true } } },
        take: 5000,
      });
      return rows.map((r) => ({
        route: r.route.name,
        monk: `${r.monk.dikshaName} (${r.monk.publicId})`,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? '',
      }));
    },
  },
  devices: {
    title: 'Devices Report',
    columns: [
      { key: 'publicId', header: 'Device ID' },
      { key: 'monk', header: 'Assigned Monk' },
      { key: 'status', header: 'Status' },
      { key: 'lastPing', header: 'Last Ping' },
    ],
    fetch: async () => {
      const rows = await prisma.device.findMany({
        include: { monk: { select: { dikshaName: true } }, locationPings: { orderBy: { timestamp: 'desc' }, take: 1 } },
        take: 5000,
      });
      return rows.map((r) => ({
        publicId: r.publicId,
        monk: r.monk?.dikshaName ?? '',
        status: r.status,
        lastPing: r.locationPings[0]?.timestamp.toISOString() ?? 'never',
      }));
    },
  },
};

export const reportRoutes = Router();

reportRoutes.get(
  '/:reportKey/org/:organizationId',
  requireAuth,
  requirePermission('REPORTS', 'VIEW'),
  scopeToOrganization,
  validate(reportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const def = REPORTS[req.params.reportKey as ReportKey];
    if (!def) throw ApiError.notFound(`Unknown report: ${req.params.reportKey}`);

    const { from, to, format } = req.query as unknown as { from?: Date; to?: Date; format: 'json' | ExportFormat };
    const rows = await def.fetch(req.params.organizationId as string, from, to);

    if (format === 'json') return ok(res, rows, { total: rows.length });

    const { buffer, contentType, filename } = await exportReport(format, def.title, rows, def.columns);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }),
);

// Platform-wide variant — Super Admin only
reportRoutes.get(
  '/:reportKey/platform',
  requireAuth,
  requirePermission('REPORTS', 'VIEW'),
  validate(reportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.actor!.isSuperAdmin) throw ApiError.forbidden('Platform-wide reports are Super Admin only');
    const def = REPORTS[req.params.reportKey as ReportKey];
    if (!def) throw ApiError.notFound(`Unknown report: ${req.params.reportKey}`);

    const { from, to, format } = req.query as unknown as { from?: Date; to?: Date; format: 'json' | ExportFormat };
    const rows = await def.fetch(null, from, to);

    if (format === 'json') return ok(res, rows, { total: rows.length });

    const { buffer, contentType, filename } = await exportReport(format, def.title, rows, def.columns);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }),
);
