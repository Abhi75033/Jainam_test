import { Response } from 'express';
import { exportReport, ExportColumn, ExportFormat } from '@/engines/export/export.service';

/**
 * §7: "Every list/table endpoint that a dashboard consumes must also expose an
 * /export variant (PDF/Excel/CSV)." Shared response helper for those variants.
 */
export async function sendListExport(
  res: Response,
  format: ExportFormat,
  title: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
) {
  const { buffer, contentType, filename } = await exportReport(format, title, rows, columns);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
}

export function parseExportFormat(raw: unknown): ExportFormat {
  return raw === 'pdf' || raw === 'excel' || raw === 'csv' ? raw : 'csv';
}
