import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const buildPdfDoc = ({ title, subtitle, filename, sections, t }) => {
  const tr = (s) => (typeof t === 'function' ? t(s) : s);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  doc.text(tr('Republic of the Philippines'), pageWidth / 2, 40, { align: 'center' });
  doc.text(tr('City of Cabuyao, Laguna'), pageWidth / 2, 54, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 58, 138);
  doc.text(tr('City Health Office'), pageWidth / 2, 74, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(17, 17, 17);
  doc.text(title, pageWidth / 2, 92, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(subtitle, pageWidth / 2, 106, { align: 'center' });

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(1.2);
  doc.line(40, 116, pageWidth - 40, 116);

  if (filename) {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${tr('File')}: ${filename}`, pageWidth - 40, 130, { align: 'right' });
  }

  let y = filename ? 144 : 136;
  (sections || []).forEach((sec, i) => {
    if (i > 0) y += 6;
    if (sec.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text(String(sec.heading), 40, y);
      y += 14;
    }
    autoTable(doc, {
      startY: y,
      head: [sec.columns],
      body: sec.rows,
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [17, 17, 17] },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 40, right: 40 },
      pageBreak: 'auto',
    });
    y = doc.lastAutoTable.finalY + 12;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(153, 153, 153);
    doc.text(tr('Cabuyao City Disease Monitoring System'), pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
  }

  return doc;
};