import PDFDocument from 'pdfkit';

/**
 * Generates a high-fidelity operational audit PDF report.
 *
 * @param {WritableStream} stream - Express Response stream
 * @param {Object} data - Aggregate analytics dataset
 */
export const buildPdfReport = (stream, data) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
  doc.pipe(stream);

  // Color Palette
  const primaryColor  = '#0f172a';
  const accentColor   = '#10b981';
  const warningColor  = '#f59e0b';
  const infoColor     = '#3b82f6';
  const textColor     = '#334155';
  const lightBg       = '#f8fafc';
  const darkHeader    = '#1e293b';

  // ─── 1. Page Header ───────────────────────────────────────────────────
  doc.rect(0, 0, 595.28, 120).fill('#0f172a');

  doc.fillColor('#ffffff')
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('APEXBANK OPERATIONAL AUDIT', 50, 40);

  doc.fillColor('#94a3b8')
     .fontSize(10)
     .font('Helvetica')
     .text(
       `Generated: ${new Date().toLocaleString()}  |  Period: ${(data.period || 'N/A').toUpperCase()}`,
       50, 70
     );

  doc.fillColor('#ffffff')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text(`${data.branchName} (${data.branchCode})`, 50, 90);

  // ─── 2. KPI Boxes ─────────────────────────────────────────────────────
  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Lobby Key Performance Indicators (KPIs)', 50, 150);

  const gridY = 175;
  const colW  = 150;

  // Total Tickets
  doc.rect(50, gridY, colW, 70).fill(lightBg);
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('TOTAL TICKETS', 65, gridY + 12);
  doc.fillColor(accentColor).fontSize(24).font('Helvetica-Bold')
     .text(String(data.metrics.totalTickets ?? 0), 65, gridY + 30);

  // Completed
  doc.rect(220, gridY, colW, 70).fill(lightBg);
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('COMPLETED', 235, gridY + 12);
  doc.fillColor(accentColor).fontSize(24).font('Helvetica-Bold')
     .text(String(data.metrics.servedCount ?? 0), 235, gridY + 30);

  // Avg Wait
  doc.rect(390, gridY, colW, 70).fill(lightBg);
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('AVG WAIT TIME', 405, gridY + 12);
  doc.fillColor(warningColor).fontSize(22).font('Helvetica-Bold')
     .text(`${data.metrics.avgWaitTime ?? 0} min`, 405, gridY + 30);

  // ─── 3. Service Distribution Table ────────────────────────────────────
  let cursorY = gridY + 90;

  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Volume by Transaction Service', 50, cursorY);

  cursorY += 24;

  // Table header row
  doc.rect(50, cursorY, 495, 25).fill(darkHeader);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
     .text('SERVICE',  65, cursorY + 7)
     .text('PREFIX',  320, cursorY + 7)
     .text('VOLUME',  430, cursorY + 7);

  cursorY += 25;

  const services = Array.isArray(data.services) ? data.services : [];
  if (services.length === 0) {
    doc.rect(50, cursorY, 495, 25).fill(lightBg);
    doc.fillColor(textColor).fontSize(10).font('Helvetica')
       .text('No service data available for this period.', 65, cursorY + 7);
    cursorY += 25;
  } else {
    services.forEach((s, idx) => {
      if (idx % 2 === 0) doc.rect(50, cursorY, 495, 25).fill(lightBg);
      doc.fillColor(textColor).fontSize(10).font('Helvetica')
         .text(s.name || '-',   65, cursorY + 7)
         .text(s.prefix || '-', 320, cursorY + 7)
         .text(String(s.count ?? 0), 430, cursorY + 7);
      cursorY += 25;

      // Overflow to new page
      if (cursorY > 740) {
        doc.addPage();
        cursorY = 50;
      }
    });
  }

  // ─── 4. Staff Efficiency Table ─────────────────────────────────────────
  cursorY += 20;

  // New page if not enough room
  if (cursorY > 680) {
    doc.addPage();
    cursorY = 50;
  }

  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Staff Serving Efficiency', 50, cursorY);

  cursorY += 24;

  doc.rect(50, cursorY, 495, 25).fill(darkHeader);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
     .text('TELLER STAFF NAME', 65, cursorY + 7)
     .text('TICKETS COMPLETED', 310, cursorY + 7)
     .text('AVG SERVING TIME',  440, cursorY + 7);

  cursorY += 25;

  const staff = Array.isArray(data.staff) ? data.staff : [];
  if (staff.length === 0) {
    doc.rect(50, cursorY, 495, 25).fill(lightBg);
    doc.fillColor(textColor).fontSize(10).font('Helvetica')
       .text('No staff activity recorded for this period.', 65, cursorY + 7);
    cursorY += 25;
  } else {
    staff.forEach((st, idx) => {
      if (idx % 2 === 0) doc.rect(50, cursorY, 495, 25).fill(lightBg);
      doc.fillColor(textColor).fontSize(10).font('Helvetica')
         .text(st.name || 'Unknown',  65, cursorY + 7)
         .text(String(st.count ?? 0), 310, cursorY + 7)
         .text(`${st.avgServingTime ?? 0} mins`, 440, cursorY + 7);
      cursorY += 25;

      if (cursorY > 740) {
        doc.addPage();
        cursorY = 50;
      }
    });
  }

  // ─── 5. Footer ────────────────────────────────────────────────────────
  doc.fillColor('#94a3b8')
     .fontSize(8)
     .font('Helvetica')
     .text(
       'ApexBank Operations System  |  Confidential Internal Audit Document',
       50, 770,
       { align: 'center' }
     );

  doc.end();
};
