import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Token from '../models/Token.js';
import { buildPdfReport } from '../utils/pdfGenerator.js';
import { buildExcelReport } from '../utils/excelGenerator.js';

// Generate Branch operational audit report
export const generateReport = async (req, res) => {
  const { branchId, period = 'daily', format = 'pdf' } = req.query;

  try {
    if (!branchId) {
      return res.status(400).json({
        status: 'error',
        message: 'branchId query parameter is required',
      });
    }

    // 1. Fetch branch configurations
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch location not found',
      });
    }

    // 2. Compute timestamp filters
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    if (period === 'today' || period === 'daily') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday') {
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === '7days' || period === 'weekly') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === '30days' || period === 'monthly') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'custom' && req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // 3. Query tokens matching the range, populated with service and servedBy details
    const tokens = await Token.find({
      branch: branchId,
      arrivalTime: { $gte: startDate, $lte: endDate },
    })
    .populate('service')
    .populate({
      path: 'staff',
      populate: {
        path: 'user',
        select: 'name'
      }
    });

    // 4. Calculate core stats
    const totalTickets = tokens.length;
    
    // Filter out waiting tokens to compute times
    const servedTokens = tokens.filter(t => t.status === 'completed');
    const skippedTokens = tokens.filter(t => t.status === 'skipped');
    
    // Average wait calculation (using callTime and arrivalTime)
    let totalWaitTime = 0;
    let waitCount = 0;
    tokens.forEach(t => {
      if (t.callTime && t.arrivalTime) {
        const diffMinutes = Math.round((new Date(t.callTime) - new Date(t.arrivalTime)) / 60000);
        totalWaitTime += diffMinutes;
        waitCount++;
      }
    });
    const avgWaitTime = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;

    // Average serve calculation (using completionTime and serveTime/callTime)
    let totalServeTime = 0;
    let serveCount = 0;
    servedTokens.forEach(t => {
      const startTime = t.serveTime || t.callTime;
      if (t.completionTime && startTime) {
        const diffMinutes = Math.round((new Date(t.completionTime) - new Date(startTime)) / 60000);
        totalServeTime += diffMinutes;
        serveCount++;
      }
    });
    const avgServingTime = serveCount > 0 ? Math.round(totalServeTime / serveCount) : 0;

    // 5. Service Distribution Breakdown
    const serviceMap = {};
    tokens.forEach(t => {
      if (t.service) {
        const key = t.service._id.toString();
        if (!serviceMap[key]) {
          serviceMap[key] = {
            name: t.service.name,
            prefix: t.service.prefix,
            count: 0
          };
        }
        serviceMap[key].count++;
      }
    });
    const services = Object.values(serviceMap);

    // 6. Staff Efficiency Breakdown (staff is already populated from token query above)
    const staffMap = {};
    servedTokens.forEach(t => {
      if (!t.staff) return;

      // t.staff is a populated Staff doc; get its _id and name from nested user
      const staffId = (t.staff._id || t.staff).toString();
      const staffName = t.staff.user?.name || 'Unknown Teller';

      if (!staffMap[staffId]) {
        staffMap[staffId] = {
          name: staffName,
          count: 0,
          totalServe: 0,
        };
      }
      staffMap[staffId].count++;
      const startTime = t.serveTime || t.callTime;
      if (t.completionTime && startTime) {
        const diffMinutes = Math.round(
          (new Date(t.completionTime) - new Date(startTime)) / 60000
        );
        staffMap[staffId].totalServe += diffMinutes;
      }
    });

    const staff = Object.values(staffMap).map(st => ({
      name: st.name,
      count: st.count,
      avgServingTime: st.count > 0 ? Math.round(st.totalServe / st.count) : 0,
    }));


    // Data package
    const reportData = {
      branchName: branch.name,
      branchCode: branch.code,
      period,
      metrics: {
        totalTickets,
        servedCount: servedTokens.length,
        skippedCount: skippedTokens.length,
        avgWaitTime,
        avgServingTime,
      },
      services,
      staff,
    };

    // 7. Format dispatch
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ApexBank_Report_${branch.code}_${period}.pdf`);
      buildPdfReport(res, reportData);
    } else if (format === 'excel') {
      const workbook = await buildExcelReport(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ApexBank_Report_${branch.code}_${period}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Invalid format parameter. Supported formats: pdf, excel',
      });
    }

  } catch (error) {
    console.error('Report Generation Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
