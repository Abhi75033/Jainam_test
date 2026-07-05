import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Parser as CsvParser } from 'json2csv';

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

/** Export Engine (§4.7) — common service reused by every reports/export endpoint. */
export async function exportToCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): Promise<Buffer> {
  const parser = new CsvParser({ fields: columns.map((c) => ({ label: c.header, value: c.key })) });
  return Buffer.from(parser.parse(rows), 'utf8');
}

export async function exportToExcel(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  sheetName = 'Report',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportToPdf(
  title: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();

    const colWidth = (doc.page.width - 60) / columns.length;
    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((col, i) => doc.text(col.header, 30 + i * colWidth, y, { width: colWidth }));
    doc.moveDown();
    doc.font('Helvetica');

    for (const row of rows) {
      y = doc.y;
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = doc.y;
      }
      columns.forEach((col, i) => {
        const value = row[col.key];
        doc.text(value === null || value === undefined ? '' : String(value), 30 + i * colWidth, y, { width: colWidth });
      });
      doc.moveDown();
    }

    doc.end();
  });
}

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export async function exportReport(
  format: ExportFormat,
  title: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const safeTitle = title.replace(/\s+/g, '_').toLowerCase();
  if (format === 'pdf') {
    return { buffer: await exportToPdf(title, rows, columns), contentType: 'application/pdf', filename: `${safeTitle}.pdf` };
  }
  if (format === 'excel') {
    return {
      buffer: await exportToExcel(rows, columns, title),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${safeTitle}.xlsx`,
    };
  }
  return { buffer: await exportToCsv(rows, columns), contentType: 'text/csv', filename: `${safeTitle}.csv` };
}
