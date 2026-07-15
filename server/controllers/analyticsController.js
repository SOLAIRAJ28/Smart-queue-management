import mongoose from 'mongoose';
import Token from '../models/Token.js';
import Branch from '../models/Branch.js';
import Counter from '../models/Counter.js';
import CounterStaff from '../models/CounterStaff.js';
import Feedback from '../models/Feedback.js';
import BranchManager from '../models/BranchManager.js';
import Service from '../models/Service.js';
import Staff from '../models/Staff.js';

export const getDashboardAnalytics = async (req, res) => {
  try {
    const { timeframe = 'today', branchId, counterId, serviceId } = req.query;

    // 1. Calculate timeframes
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    let prevStartDate = new Date();
    let prevEndDate = new Date();

    if (timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate.setDate(now.getDate() - 1);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (timeframe === 'yesterday') {
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate.setDate(now.getDate() - 2);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 2);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (timeframe === '7days') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate.setDate(now.getDate() - 14);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 7);
      prevEndDate.setHours(0, 0, 0, 0);
    } else if (timeframe === '30days') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate.setDate(now.getDate() - 60);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 30);
      prevEndDate.setHours(0, 0, 0, 0);
    } else if (timeframe === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (timeframe === 'custom' && req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      const durationMs = endDate - startDate;
      prevStartDate = new Date(startDate.getTime() - durationMs);
      prevEndDate = new Date(startDate.getTime() - 1);
    } else {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate.setDate(now.getDate() - 1);
      prevStartDate.setHours(0, 0, 0, 0);
      prevEndDate.setDate(now.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
    }

    // 2. Build filters
    const currentFilter = { arrivalTime: { $gte: startDate, $lte: endDate } };
    const prevFilter = { arrivalTime: { $gte: prevStartDate, $lte: prevEndDate } };

    if (branchId) {
      currentFilter.branch = new mongoose.Types.ObjectId(branchId);
      prevFilter.branch = new mongoose.Types.ObjectId(branchId);
    }
    if (counterId) {
      currentFilter.counter = new mongoose.Types.ObjectId(counterId);
      prevFilter.counter = new mongoose.Types.ObjectId(counterId);
    }
    if (serviceId) {
      currentFilter.service = new mongoose.Types.ObjectId(serviceId);
      prevFilter.service = new mongoose.Types.ObjectId(serviceId);
    }

    // 3. Centralized Aggregation Pipelines
    // KPI aggregations
    const runKpiAggregation = async (filter) => {
      const agg = await Token.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            served: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            skipped: { $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
            avgWait: { 
              $avg: { 
                $cond: [
                  { $and: [{ $eq: ["$status", "completed"] }, { $ne: ["$callTime", null] }, { $ne: ["$arrivalTime", null] }] }, 
                  { $divide: [{ $subtract: ["$callTime", "$arrivalTime"] }, 60000] }, 
                  "$$REMOVE"
                ] 
              } 
            },
            avgServe: { 
              $avg: { 
                $cond: [
                  { $and: [{ $eq: ["$status", "completed"] }, { $ne: ["$completionTime", null] }] }, 
                  { 
                    $divide: [
                      { 
                        $subtract: [
                          "$completionTime", 
                          { $ifNull: ["$serveTime", "$callTime"] }
                        ] 
                      }, 
                      60000
                    ] 
                  }, 
                  "$$REMOVE"
                ] 
              } 
            }
          }
        }
      ]);
      return agg[0] || { total: 0, served: 0, skipped: 0, cancelled: 0, avgWait: null, avgServe: null };
    };

    const currentKpis = await runKpiAggregation(currentFilter);

    // Daily Queue Trend Aggregate
    const dailyAgg = await Token.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%b %d", date: "$arrivalTime", timezone: "Asia/Kolkata" } },
          issued: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    const dailyTrend = dailyAgg.map(d => ({
      date: d._id,
      issued: d.issued,
      completed: d.completed
    }));

    // Hourly peak-hour Aggregate
    const hourlyAgg = await Token.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { $hour: { date: "$arrivalTime", timezone: "Asia/Kolkata" } },
          issued: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const hourlyCounts = Array.from({ length: 24 }, (_, i) => {
      const hourNum = i;
      const match = hourlyAgg.find(h => h._id === hourNum);
      return {
        hour: `${hourNum % 12 || 12} ${hourNum >= 12 ? 'PM' : 'AM'}`,
        issued: match ? match.issued : 0,
        completed: match ? match.completed : 0
      };
    });

    // Feedbacks & Ratings
    const feedbackQuery = { createdAt: { $gte: startDate, $lte: endDate } };
    if (branchId) feedbackQuery.branch = new mongoose.Types.ObjectId(branchId);
    const feedbacks = await Feedback.find(feedbackQuery).lean();
    const tokenFeedbackMap = {};
    feedbacks.forEach(f => {
      tokenFeedbackMap[f.token.toString()] = f.rating;
    });

    const getAvgRating = (ratings) => {
      if (ratings.length === 0) return null;
      return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    };

    // Metadata Counts
    const totalBranches = await Branch.countDocuments();
    const activeBranches = await Branch.countDocuments({ isActive: true });
    const totalManagers = await BranchManager.countDocuments();
    const totalCounterStaff = await CounterStaff.countDocuments();
    const totalServices = await Service.countDocuments();
    
    const activeCountersCount = branchId 
      ? await Counter.countDocuments({ branch: branchId, status: 'enabled' })
      : await Counter.countDocuments({ status: 'enabled' });

    const totalCountersCount = branchId
      ? await Counter.countDocuments({ branch: branchId })
      : await Counter.countDocuments();

    const activeCounterStaffCount = branchId
      ? await CounterStaff.countDocuments({ branchId, status: { $in: ['active', 'Enabled'] } })
      : await CounterStaff.countDocuments({ status: { $in: ['active', 'Enabled'] } });

    // Branch Comparisons (Admin Only)
    let branchComparisons = [];
    if (!branchId) {
      const branchesList = await Branch.find().lean();
      
      const branchKpisAgg = await Token.aggregate([
        { $match: currentFilter },
        {
          $group: {
            _id: "$branch",
            customers: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            avgWait: { $avg: "$waitTime" }
          }
        }
      ]);

      branchComparisons = branchesList.map(b => {
        const stats = branchKpisAgg.find(bk => bk._id && bk._id.toString() === b._id.toString()) || {
          customers: 0,
          completed: 0,
          avgWait: 0
        };

        const branchFeedbacks = feedbacks.filter(f => f.branch.toString() === b._id.toString()).map(f => f.rating);
        const avgRating = getAvgRating(branchFeedbacks);

        return {
          id: b._id,
          name: b.name,
          code: b.code,
          isActive: b.isActive,
          customers: stats.customers,
          completed: stats.completed,
          avgWait: Math.round(stats.avgWait || 0),
          avgRating
        };
      });

      branchComparisons.sort((x, y) => {
        const xIndex = x.completed / (x.avgWait || 1);
        const yIndex = y.completed / (y.avgWait || 1);
        return yIndex - xIndex;
      });
    }

    // Counter Staff rankings
    const allCounters = await Counter.find(branchId ? { branch: branchId } : {}).lean();
    const counterStaffs = await CounterStaff.find().select('-password').lean();
    const staffMap = {};
    counterStaffs.forEach(cs => {
      if (cs.counterId) {
        staffMap[cs.counterId.toString()] = cs;
      }
    });

    const currentTokens = await Token.find(currentFilter)
      .select('counter status completionTime serveTime callTime servingTime')
      .populate({
        path: 'counter',
        select: 'number'
      })
      .lean();

    const counterStatsMap = {};
    currentTokens.forEach(t => {
      if (t.counter) {
        const cId = t.counter._id.toString();
        if (!counterStatsMap[cId]) {
          counterStatsMap[cId] = {
            number: t.counter.number,
            servedCount: 0,
            serviceTimes: [],
            ratings: []
          };
        }
        if (t.status === 'completed') {
          counterStatsMap[cId].servedCount++;
          
          let durationMs = 0;
          if (t.completionTime && t.serveTime) {
            durationMs = t.completionTime - t.serveTime;
          } else if (t.completionTime && t.callTime) {
            durationMs = t.completionTime - t.callTime;
          } else if (t.servingTime) {
            durationMs = t.servingTime * 60000;
          }
          
          const durationSeconds = Math.round(durationMs / 1000);
          counterStatsMap[cId].serviceTimes.push(durationSeconds);

          if (tokenFeedbackMap[t._id.toString()]) {
            counterStatsMap[cId].ratings.push(tokenFeedbackMap[t._id.toString()]);
          }
        }
      }
    });

    const counterRankings = allCounters.map(c => {
      const stats = counterStatsMap[c._id.toString()] || {
        servedCount: 0,
        serviceTimes: [],
        ratings: []
      };

      const avgServiceTime = stats.serviceTimes.length > 0
        ? Math.round(stats.serviceTimes.reduce((a, b) => a + b, 0) / stats.serviceTimes.length)
        : null;
      
      const rating = getAvgRating(stats.ratings);

      return {
        id: c._id,
        counterNumber: c.number,
        staffName: staffMap[c._id.toString()]?.staffName || 'Unassigned',
        servedCount: stats.servedCount,
        avgServiceTime,
        rating,
        status: c.status
      };
    });
    counterRankings.sort((a, b) => b.servedCount - a.servedCount);

    const waitingTokensCount = currentTokens.filter(t => t.status === 'waiting').length;
    const customersBeingServed = currentTokens.filter(t => t.status === 'calling').length;

    // 1. Requested services (Busiest Service)
    const servicesOrderedAgg = await Token.aggregate([
      { $match: { ...currentFilter, status: 'completed' } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "srv" } },
      { $unwind: "$srv" },
      { $sort: { count: -1 } }
    ]);
    const mostRequested = servicesOrderedAgg.length > 0 ? servicesOrderedAgg[0].srv.name : null;

    // 2. Least Busiest Service (Service with lowest number of completed tokens)
    const leastBusiestServiceAgg = await Token.aggregate([
      { $match: { ...currentFilter, status: 'completed' } },
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "srv" } },
      { $unwind: "$srv" },
      { $sort: { count: 1 } },
      { $limit: 1 }
    ]);
    const leastBusiest = leastBusiestServiceAgg.length > 0 
      ? { name: leastBusiestServiceAgg[0].srv.name, count: leastBusiestServiceAgg[0].count }
      : null;

    // 3. Average Visit Duration (completionTime - serveTime)
    const visitDurationsAgg = await Token.aggregate([
      { 
        $match: { 
          ...currentFilter, 
          status: 'completed',
          serveTime: { $ne: null },
          completionTime: { $ne: null }
        } 
      },
      {
        $project: {
          durationMs: { $subtract: ["$completionTime", "$serveTime"] }
        }
      },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: "$durationMs" }
        }
      }
    ]);
    const avgDurationSeconds = visitDurationsAgg.length > 0 
      ? Math.round(visitDurationsAgg[0].avgDurationMs / 1000)
      : null;

    // 4. Busiest Hour (Grouped by token arrivalTime hour range)
    const busyHourAgg = await Token.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { $hour: { date: "$arrivalTime", timezone: "Asia/Kolkata" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const formatHourRange = (hourNum) => {
      if (hourNum === null || hourNum === undefined) return null;
      const startHour = hourNum % 12 || 12;
      const startAmPm = hourNum >= 12 ? 'PM' : 'AM';
      const nextHour = (hourNum + 1) % 12 || 12;
      const nextAmPm = (hourNum + 1) >= 12 ? 'PM' : 'AM';
      return `${startHour}:00 ${startAmPm} – ${nextHour}:00 ${nextAmPm}`;
    };

    const busyHour = busyHourAgg.length > 0 
      ? { range: formatHourRange(busyHourAgg[0]._id), count: busyHourAgg[0].count }
      : null;

    // Top Performers calculations
    let topBranchName = 'N/A';
    if (!branchId && branchComparisons.length > 0 && branchComparisons[0].customers > 0) {
      topBranchName = `${branchComparisons[0].name} (${branchComparisons[0].completed} completed)`;
    } else if (branchId) {
      const bObj = await Branch.findById(branchId);
      topBranchName = bObj ? bObj.name : 'N/A';
    }

    // Top Counter calculation
    let topCounterName = 'N/A';
    if (counterRankings.length > 0 && counterRankings[0].servedCount > 0) {
      topCounterName = `Counter ${counterRankings[0].counterNumber} (${counterRankings[0].staffName}) - ${counterRankings[0].servedCount} completed`;
    }

    // Top Teller (Completed) dynamic calculation using Token completed status
    const staffCompletedAgg = await Token.aggregate([
      { $match: { ...currentFilter, status: 'completed' } },
      { $group: { _id: "$staff", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    let topTeller = null;
    if (staffCompletedAgg.length > 0 && staffCompletedAgg[0]._id) {
      const topStaffId = staffCompletedAgg[0]._id;
      const completedCount = staffCompletedAgg[0].count;

      let tellerName = 'N/A';
      let tellerCounter = 'N/A';
      let tellerBranch = 'N/A';

      // Look in Staff model
      const staffDoc = await Staff.findById(topStaffId)
        .populate({ path: 'user', select: 'name' })
        .populate('branch')
        .populate('counter');

      if (staffDoc) {
        tellerName = staffDoc.user?.name || 'N/A';
        tellerCounter = staffDoc.counter?.number ? `Counter ${staffDoc.counter.number}` : 'N/A';
        tellerBranch = staffDoc.branch?.name || 'N/A';
      } else {
        // Look in CounterStaff model
        const csDoc = await CounterStaff.findById(topStaffId)
          .populate('branchId')
          .populate('counterId');
        
        if (csDoc) {
          tellerName = csDoc.staffName;
          tellerCounter = csDoc.counterId?.number ? `Counter ${csDoc.counterId.number}` : 'N/A';
          tellerBranch = csDoc.branchId?.name || 'N/A';
        }
      }

      if (tellerName !== 'N/A') {
        topTeller = {
          name: tellerName,
          counterNumber: tellerCounter,
          branchName: tellerBranch,
          count: completedCount
        };
      }
    }

    // Dynamic metrics building with empty-state nulls
    const getOrNull = (val, count = currentKpis.total) => {
      if (count === 0 || val === undefined || val === null) return null;
      return Math.round(val * 10) / 10;
    };

    const ratingValue = getAvgRating(feedbacks.map(f => f.rating));

    const counterUtilization = totalCountersCount > 0
      ? Math.round((activeCountersCount / totalCountersCount) * 100)
      : null;

    res.status(200).json({
      status: 'success',
      data: {
        adminKpis: {
          totalBranches,
          activeBranches,
          totalManagers,
          totalCounterStaff,
          activeCounters: activeCountersCount,
          totalServices,
          customersServedToday: currentKpis.served,
          waitingCustomers: waitingTokensCount,
          customersBeingServed,
          totalTokensGeneratedToday: currentKpis.total,
          completedTokensToday: currentKpis.served,
          cancelledTokens: currentKpis.cancelled,
          skippedTokens: currentKpis.skipped,
          avgWaitingTime: getOrNull(currentKpis.avgWait),
          avgServiceTime: getOrNull(currentKpis.avgServe, currentKpis.served),
          customerSatisfactionRating: ratingValue,
          mostRequestedService: mostRequested
        },
        managerKpis: {
          customersServedToday: currentKpis.served,
          waitingCustomers: waitingTokensCount,
          customersBeingServed,
          completedTokens: currentKpis.served,
          activeCounters: activeCountersCount,
          activeCounterStaff: activeCounterStaffCount,
          avgWaitingTime: getOrNull(currentKpis.avgWait),
          avgServiceTime: getOrNull(currentKpis.avgServe, currentKpis.served),
          mostRequestedService: mostRequested,
          peakHour: busyHour ? busyHour.range : null,
          counterUtilization: counterUtilization
        },
        topPerformers: {
          branch: topBranchName,
          counter: topCounterName
        },
        topTeller,
        branchComparisons,
        counterRankings,
        customerInsights: {
          mostRequested,
          leastBusiestService: leastBusiest,
          avgVisitDurationSeconds: avgDurationSeconds,
          peakHour: busyHour
        },
        charts: {
          hourlyCounts,
          dailyTrend
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
