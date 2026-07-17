import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as monksService from './monks.service';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { prisma } from '@/config/prisma';

export const createMonk = asyncHandler(async (req: Request, res: Response) => {
  const monk = await monksService.createMonk({ ...req.body, createdById: req.actor!.userId });
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'CREATE', entityType: 'MonkProfile', entityId: monk.id, after: monk });
  return created(res, monk);
});

export const updateMonk = asyncHandler(async (req: Request, res: Response) => {
  const before = await monksService.getMonk(req.params.monkId as string);
  const monk = await monksService.updateMonk(before.id, req.body, req.actor!.userId);
  // §5.4: every edit to a shared monk profile is audit-logged (who/what/when)
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'EDIT', entityType: 'MonkProfile', entityId: monk.id, before, after: monk, isCritical: true });
  return ok(res, monk);
});

export const getMonk = asyncHandler(async (req: Request, res: Response) => {
  const monk = await monksService.getMonk(req.params.monkId as string);
  return ok(res, monk);
});

export const listMonks = asyncHandler(async (req: Request, res: Response) => {
  const { templeId, groupId, gender, search } = req.query as Record<string, string | undefined>;
  const monks = await monksService.listMonks({ templeId, groupId, gender: gender as any, search });
  return ok(res, monks);
});

export const deleteMonk = asyncHandler(async (req: Request, res: Response) => {
  const before = await monksService.getMonk(req.params.monkId as string);
  const monk = await monksService.softDeleteMonk(before.id, req.actor!.userId);
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'DELETE', entityType: 'MonkProfile', entityId: monk.id, before, isCritical: true });
  return ok(res, { deleted: true });
});

export const createMonkGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await monksService.createMonkGroup(req.body);
  return created(res, group);
});

export const followMonk = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const monk = await monksService.getMonk(req.params.monkId as string);
  const follow = await monksService.followMonk(monk.id, member.id);
  return created(res, follow);
});

export const unfollowMonk = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const monk = await monksService.getMonk(req.params.monkId as string);
  await monksService.unfollowMonk(monk.id, member.id);
  return ok(res, { unfollowed: true });
});

/* ─── Photo Upload ──────────────────────────────────────────────────────────── */
export const uploadMonkPhoto = asyncHandler(async (req: Request, res: Response) => {
  const monk = await monksService.getMonk(req.params.monkId as string);
  if (!req.file) throw ApiError.validation({ photo: ['No file provided'] });

  const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `monk-${monk.publicId}-${Date.now()}.${ext}`;
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.resolve(process.cwd(), 'static', 'photos');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  const photoUrl = `/static/photos/${filename}`;
  await prisma.monkProfile.update({ where: { id: monk.id }, data: { photoUrl } });
  return ok(res, { photoUrl });
});

/* ─── Status Toggle ─────────────────────────────────────────────────────────── */
export const updateMonkStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw ApiError.validation({ status: ['Must be ACTIVE or INACTIVE'] });
  }
  const monk = await monksService.getMonk(req.params.monkId as string);
  const updated = await prisma.monkProfile.update({
    where: { id: monk.id },
    data: { status: status as any },
  });
  return ok(res, { publicId: updated.publicId, status: updated.status });
});

/* ─── Export All Monks as Excel ─────────────────────────────────────────────── */
import ExcelJS from 'exceljs';

export const exportMonksExcel = asyncHandler(async (req: Request, res: Response) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JiNANAM Platform';
  const ws = wb.addWorksheet('Monks (MS Profiles)', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Public ID',          key: 'publicId',          width: 14 },
    { header: 'Diksha Name',        key: 'dikshaName',        width: 24 },
    { header: 'Gender',             key: 'gender',            width: 10 },
    { header: 'Name Before Diksha', key: 'nameBeforeDiksha',  width: 22 },
    { header: 'Diksha Date',        key: 'dikshaDate',        width: 14 },
    { header: 'Diksha Place',       key: 'dikshaPlace',       width: 18 },
    { header: 'Community',          key: 'community',         width: 16 },
    { header: 'Gaccha',             key: 'gaccha',            width: 16 },
    { header: 'Current Temple',     key: 'currentTemple',     width: 22 },
    { header: 'Status',             key: 'status',            width: 12 },
    { header: 'DOB',                key: 'dob',               width: 14 },
    { header: 'DOB Place',          key: 'dobPlace',          width: 16 },
    { header: 'Bio',                key: 'bio',               width: 40 },
    { header: 'Followers',          key: 'followers',         width: 10 },
    { header: 'Joined On',          key: 'createdAt',         width: 18 },
  ];

  // Orange header
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B2D8B' } }; // purple for monks
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF5A1F6A' } } };
  });
  ws.getRow(1).height = 22;

  const monks = await prisma.monkProfile.findMany({
    where: { deletedAt: null },
    include: {
      community: { select: { name: true } },
      gaccha: { select: { name: true } },
      currentTemple: { select: { name: true, city: true } },
      _count: { select: { follows: true } },
    },
    orderBy: { dikshaName: 'asc' },
    take: 10000,
  });

  for (const m of monks) {
    ws.addRow({
      publicId:         m.publicId,
      dikshaName:       m.dikshaName,
      gender:           m.gender,
      nameBeforeDiksha: m.nameBeforeDiksha || '',
      dikshaDate:       m.dikshaDate ? new Date(m.dikshaDate).toLocaleDateString('en-IN') : '',
      dikshaPlace:      m.dikshaPlace || '',
      community:        m.community?.name || '',
      gaccha:           m.gaccha?.name || '',
      currentTemple:    m.currentTemple ? `${m.currentTemple.name} (${m.currentTemple.city || ''})` : '',
      status:           m.status,
      dob:              m.dob ? new Date(m.dob).toLocaleDateString('en-IN') : '',
      dobPlace:         m.dobPlace || '',
      bio:              m.bio || '',
      followers:        m._count.follows,
      createdAt:        new Date(m.createdAt).toLocaleDateString('en-IN'),
    });
  }

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const fill = n % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF5EEFF' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell((cell) => { cell.fill = fill; });
  });

  const filename = `jinanam-monks-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

/* ─── Download Blank Import Template ────────────────────────────────────────── */
export const downloadMonkTemplate = asyncHandler(async (req: Request, res: Response) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Monks Import');

  ws.columns = [
    { header: 'dikshaName',       key: 'dikshaName',       width: 24 },
    { header: 'gender',           key: 'gender',           width: 10 },
    { header: 'nameBeforeDiksha', key: 'nameBeforeDiksha', width: 22 },
    { header: 'dikshaDate',       key: 'dikshaDate',       width: 14 },
    { header: 'dikshaPlace',      key: 'dikshaPlace',      width: 18 },
    { header: 'dob',              key: 'dob',              width: 14 },
    { header: 'dobPlace',         key: 'dobPlace',         width: 16 },
    { header: 'community',        key: 'community',        width: 16 },
    { header: 'gaccha',           key: 'gaccha',           width: 16 },
    { header: 'currentTemple',    key: 'currentTemple',    width: 22 },
    { header: 'bio',              key: 'bio',              width: 40 },
  ];

  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B2D8B' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });
  ws.getRow(1).height = 20;

  ws.addRow({
    dikshaName:       'Param Pujya Maharaj',
    gender:           'SADHU',
    nameBeforeDiksha: 'Ramesh Shah',
    dikshaDate:       '15/08/2000',
    dikshaPlace:      'Palitana',
    dob:              '10/03/1975',
    dobPlace:         'Jaipur',
    community:        'Digambar',
    gaccha:           'Mula Sangh',
    currentTemple:    'Shree Siddhachalam',
    bio:              'Brief biography…',
  });
  ws.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="jinanam-monks-import-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

/* ─── Bulk Import Monks from Excel ─────────────────────────────────────────── */
export const bulkImportMonksExcel = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.validation({ file: ['Upload an .xlsx file in the "file" field'] });

  const ExcelJSImport = new ExcelJS.Workbook();
  try {
    await ExcelJSImport.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
  } catch {
    throw ApiError.validation({ file: ['File is not a valid .xlsx workbook'] });
  }

  const sheet = ExcelJSImport.worksheets[0];
  if (!sheet) throw ApiError.validation({ file: ['Workbook has no worksheets'] });

  const headerRow = sheet.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const h = String(cell.value ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (h) colIndex[h] = col;
  });

  if (!colIndex.dikshaname) throw ApiError.validation({ file: ['Header row must include "dikshaName" column'] });

  const results: { row: number; publicId?: string; status: string; message?: string }[] = [];
  const rows: any[] = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const cell = (key: string) => {
      const idx = colIndex[key];
      if (!idx) return undefined;
      const v = row.getCell(idx).value;
      return v === null || v === undefined ? undefined : String(v).trim() || undefined;
    };
    const dikshaName = cell('dikshaname');
    if (!dikshaName) return;
    rows.push({ rowNum, dikshaName, gender: cell('gender') || 'SADHU', nameBeforeDiksha: cell('namebeforediksha'), dikshaDate: cell('dikshadate'), dikshaPlace: cell('dikshaplace'), dobPlace: cell('dobplace'), bio: cell('bio') });
  });

  if (rows.length === 0) throw ApiError.validation({ file: ['No data rows found'] });
  if (rows.length > 2000) throw ApiError.validation({ file: ['Maximum 2000 rows per import'] });

  let created = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const monk = await monksService.createMonk({
        dikshaName: row.dikshaName,
        gender: ['SADHU', 'SADHVI'].includes(row.gender?.toUpperCase()) ? row.gender.toUpperCase() : 'SADHU',
        nameBeforeDiksha: row.nameBeforeDiksha,
        dikshaDate: row.dikshaDate ? new Date(row.dikshaDate) : undefined,
        dikshaPlace: row.dikshaPlace,
        dobPlace: row.dobPlace,
        bio: row.bio,
        createdById: req.actor!.userId,
      });
      results.push({ row: row.rowNum, publicId: monk.publicId, status: 'created' });
      created++;
    } catch (e: any) {
      results.push({ row: row.rowNum, status: 'error', message: e?.message || 'Unknown error' });
      errors++;
    }
  }

  return created > 0
    ? created > 0 && errors === 0
      ? (await import('@/utils/apiResponse')).created(res, { created, skipped: 0, errors: results.filter(r => r.status === 'error') })
      : (await import('@/utils/apiResponse')).created(res, { created, skipped: 0, errors: results.filter(r => r.status === 'error') })
    : ok(res, { created, skipped: 0, errors: results.filter(r => r.status === 'error') });
});

