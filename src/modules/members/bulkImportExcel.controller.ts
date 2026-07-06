import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { asyncHandler } from '@/utils/asyncHandler';
import { created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { bulkImportMembers } from './members.service';

/**
 * Excel bulk import (§5.2): accepts an .xlsx upload with columns
 * name | mobile | city | state | community | address (header row required,
 * case-insensitive). Parses to rows and reuses the same validated import
 * pipeline as the JSON endpoint, returning per-row results.
 */
export const bulkImportFromExcel = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: { buffer: Buffer; originalname: string } }).file;
  if (!file) throw ApiError.validation({ file: ['Upload an .xlsx file in the "file" field'] });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
  } catch {
    throw ApiError.validation({ file: ['File is not a valid .xlsx workbook'] });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw ApiError.validation({ file: ['Workbook has no worksheets'] });

  const headerRow = sheet.getRow(1);
  const columnIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value ?? '').trim().toLowerCase();
    if (header) columnIndex[header] = colNumber;
  });

  if (!columnIndex.name || !columnIndex.mobile) {
    throw ApiError.validation({ file: ['Header row must include at least "name" and "mobile" columns'] });
  }

  const rows: { name: string; mobile: string; city?: string; state?: string; community?: string; address?: string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cellText = (key: string) => {
      const idx = columnIndex[key];
      if (!idx) return undefined;
      const value = row.getCell(idx).value;
      return value === null || value === undefined ? undefined : String(value).trim() || undefined;
    };
    const name = cellText('name');
    const mobile = cellText('mobile');
    if (!name || !mobile) return; // blank/partial rows skipped
    rows.push({ name, mobile, city: cellText('city'), state: cellText('state'), community: cellText('community'), address: cellText('address') });
  });

  if (rows.length === 0) throw ApiError.validation({ file: ['No data rows found below the header'] });
  if (rows.length > 5000) throw ApiError.validation({ file: ['Maximum 5000 rows per import'] });

  const result = await bulkImportMembers(rows, req.actor!.userId);
  return created(res, result);
});
