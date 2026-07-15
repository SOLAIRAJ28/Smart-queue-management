import ExcelJS from 'exceljs';

/**
 * Builds a multi-sheet formatted Excel workbook.
 * 
 * @param {Object} data - Aggregate analytics dataset
 * @returns {Promise<ExcelJS.Workbook>}
 */
export const buildExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Lobby Summary
  const summarySheet = workbook.addWorksheet('Lobby Summary');
  summarySheet.views = [{ showGridLines: true }];

  // Title Row Styling
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'ApexBank Operations Report';
  titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 30;

  // Metadata
  summarySheet.addRow([]);
  summarySheet.addRow(['Branch Name', `${data.branchName} (${data.branchCode})`]);
  summarySheet.addRow(['Report Period', data.period.toUpperCase()]);
  summarySheet.addRow(['Generation Date', new Date().toLocaleString()]);
  summarySheet.addRow([]);

  // KPIs Header
  const kpiHeader = summarySheet.addRow(['Lobby Key Performance Indicators (KPIs)']);
  kpiHeader.font = { bold: true, size: 11, color: { argb: 'FF10B981' } };
  
  summarySheet.addRow(['Operational Metric', 'Value']);
  summarySheet.addRow(['Total Tokens Generated', data.metrics.totalTickets]);
  summarySheet.addRow(['Average Wait Time (Minutes)', data.metrics.avgWaitTime]);
  summarySheet.addRow(['Average Serving Time (Minutes)', data.metrics.avgServingTime]);
  summarySheet.addRow(['Completed / Served Count', data.metrics.servedCount]);
  summarySheet.addRow(['Skipped / Abandoned Count', data.metrics.skippedCount]);

  // Adjust Column Widths
  summarySheet.getColumn(1).width = 32;
  summarySheet.getColumn(2).width = 25;
  summarySheet.getColumn(3).width = 15;

  // Format metric rows borders and background
  for (let r = 8; r <= 12; r++) {
    const row = summarySheet.getRow(r);
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    row.getCell(2).alignment = { horizontal: 'left' };
  }

  // Sheet 2: Service Distribution
  const serviceSheet = workbook.addWorksheet('Service Volume');
  serviceSheet.views = [{ showGridLines: true }];
  
  serviceSheet.addRow(['Service Category', 'Prefix Code', 'Total Volume (Tokens)']).font = { bold: true };
  serviceSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  serviceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  const services = Array.isArray(data.services) ? data.services : [];
  if (services.length === 0) {
    serviceSheet.addRow(['No service data available for this period.', '', '']);
  } else {
    services.forEach(s => {
      serviceSheet.addRow([s.name || '-', s.prefix || '-', s.count ?? 0]);
    });
  }
  serviceSheet.getColumn(1).width = 30;
  serviceSheet.getColumn(2).width = 15;
  serviceSheet.getColumn(3).width = 25;

  // Sheet 3: Staff Efficiency
  const staffSheet = workbook.addWorksheet('Teller Efficiency');
  staffSheet.views = [{ showGridLines: true }];
  
  staffSheet.addRow(['Teller Staff Name', 'Completed Transactions', 'Average Serving Time (Mins)']).font = { bold: true };
  staffSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  staffSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  const staffList = Array.isArray(data.staff) ? data.staff : [];
  if (staffList.length === 0) {
    staffSheet.addRow(['No staff activity recorded for this period.', '', '']);
  } else {
    staffList.forEach(st => {
      staffSheet.addRow([st.name || 'Unknown', st.count ?? 0, st.avgServingTime ?? 0]);
    });
  }
  staffSheet.getColumn(1).width = 30;
  staffSheet.getColumn(2).width = 25;
  staffSheet.getColumn(3).width = 25;

  return workbook;
};
