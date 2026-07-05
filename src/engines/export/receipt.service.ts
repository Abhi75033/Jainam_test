import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptNumber: string;
  type: 'BOOKING' | 'DONATION' | 'TICKET';
  organizationName?: string;
  trustRegistrationNumber?: string;
  is80gEligible?: boolean;
  memberName: string;
  memberPublicId: string;
  amount: string;
  currency: string;
  issuedAt: Date;
  lineItems: { label: string; value: string }[];
}

/** Generates a receipt PDF (booking/donation/ticket) per §5.7/§5.8 receipt contract. */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text('JiNANAM', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Connecting Jain Life', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text(`${data.type} RECEIPT`, { align: 'center' });
    doc.moveDown();

    if (data.organizationName) {
      doc.fontSize(11).font('Helvetica').text(`Organization: ${data.organizationName}`);
    }
    if (data.trustRegistrationNumber) {
      doc.text(`Trust Registration No.: ${data.trustRegistrationNumber}`);
    }
    if (data.is80gEligible) {
      doc.text('80G Tax Exemption: Eligible');
    }
    doc.moveDown();

    doc.text(`Receipt Number: ${data.receiptNumber}`);
    doc.text(`Issued At: ${data.issuedAt.toISOString()}`);
    doc.text(`Member: ${data.memberName} (${data.memberPublicId})`);
    doc.moveDown();

    for (const item of data.lineItems) {
      doc.text(`${item.label}: ${item.value}`);
    }
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text(`Total Amount: ${data.currency} ${data.amount}`);
    doc.moveDown(2);

    doc.fontSize(9).font('Helvetica-Oblique').text(
      'This is a system-generated receipt. For queries, contact the issuing organization via the JiNANAM app.',
      { align: 'center' },
    );

    doc.end();
  });
}
