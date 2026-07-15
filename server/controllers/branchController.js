import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Token from '../models/Token.js';
import Counter from '../models/Counter.js';
import CounterStaff from '../models/CounterStaff.js';
import { logAction } from '../utils/auditLogger.js';
import { generateCrowdForecast } from '../utils/aiPredictor.js';

// Get branch analytics (daily dashboard metrics)
export const getBranchAnalytics = async (req, res) => {
  const { id } = req.params;

  try {
    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch not found',
      });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const tokens = await Token.find({
      branch: id,
      arrivalTime: { $gte: startOfDay, $lte: endOfDay },
    })
      .select('status callTime arrivalTime completionTime serveTime')
      .lean();

    const totalTickets = tokens.length;
    const activeWaiting = tokens.filter((t) => t.status === 'waiting').length;
    const servedCount = tokens.filter((t) => t.status === 'completed').length;
    const skippedCount = tokens.filter((t) => t.status === 'skipped').length;
    const callingCount = tokens.filter((t) => t.status === 'calling').length;

    // Average Waiting Time for Completed customers only
    const completedTokens = tokens.filter((t) => t.status === 'completed' && t.callTime && t.arrivalTime);
    const avgWaitTime = completedTokens.length > 0
      ? Math.round(completedTokens.reduce((a, b) => a + (b.callTime - b.arrivalTime), 0) / completedTokens.length / 60000)
      : null;

    const avgServingTime = completedTokens.length > 0
      ? Math.round(completedTokens.reduce((a, b) => a + (b.completionTime - (b.serveTime || b.callTime || b.arrivalTime)), 0) / completedTokens.length / 60000)
      : null;

    // Get Active Counters (Enabled counters)
    const activeCounters = await Counter.countDocuments({ branch: id, status: 'enabled' });

    // Get Counter Staff (Online/active in this branch)
    const activeStaff = await CounterStaff.countDocuments({ branchId: id, status: { $in: ['active', 'Enabled'] } });

    // Calculate Peak Queue Hours (Hour with highest customer arrivals)
    const hourlyCounts = {};
    tokens.forEach(t => {
      if (t.arrivalTime) {
        const hour = new Date(t.arrivalTime).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      }
    });
    let peakHour = null;
    let maxCount = 0;
    Object.keys(hourlyCounts).forEach(hour => {
      if (hourlyCounts[hour] > maxCount) {
        maxCount = hourlyCounts[hour];
        const hNum = parseInt(hour, 10);
        const ampm = hNum >= 12 ? 'PM' : 'AM';
        const displayHour = hNum % 12 || 12;
        const nextHourNum = hNum + 1;
        const nextAmpm = nextHourNum >= 24 ? 'AM' : (nextHourNum >= 12 ? 'PM' : 'AM');
        const displayNextHour = nextHourNum % 12 || 12;
        peakHour = `${displayHour} ${ampm} - ${displayNextHour} ${nextAmpm}`;
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        branchName: branch.name,
        branchCode: branch.code,
        branchStatus: branch.isActive ? 'Active' : 'Inactive',
        totalTickets,
        activeWaiting,
        servedCount,
        skippedCount,
        callingCount,
        avgWaitTime,
        avgServingTime,
        activeCounters,
        activeStaff,
        peakHour
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get all branches
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json({
      status: 'success',
      results: branches.length,
      data: { branches },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get a single branch by ID
export const getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch not found',
      });
    }
    res.status(200).json({
      status: 'success',
      data: { branch },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Create a new branch (Admin only)
export const createBranch = async (req, res) => {
  const { name, code, address, contact, workingHours } = req.body;

  try {
    // Check if branch code is already registered
    const codeExists = await Branch.findOne({ code: code.toUpperCase() });
    if (codeExists) {
      return res.status(400).json({
        status: 'error',
        message: `Branch with code ${code.toUpperCase()} already exists`,
      });
    }

    const branch = await Branch.create({
      name,
      code,
      address,
      contact,
      workingHours,
    });

    // Write audit log
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_CREATE',
      description: `Created branch ${branch.name} (${branch.code})`,
      req
    });

    res.status(201).json({
      status: 'success',
      data: { branch },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Update an existing branch (Admin only)
export const updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch not found',
      });
    }

    // Write audit log
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_UPDATE',
      description: `Updated branch configurations for ${branch.name} (${branch.code})`,
      req
    });

    res.status(200).json({
      status: 'success',
      data: { branch },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Toggle branch active status (Admin only)
export const toggleBranchStatus = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch not found',
      });
    }

    branch.isActive = !branch.isActive;
    await branch.save();

    // Write audit log
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_TOGGLE',
      description: `Toggled active state of branch ${branch.name} (${branch.code}) to ${branch.isActive ? 'Active' : 'Inactive'}`,
      req
    });

    res.status(200).json({
      status: 'success',
      message: `Branch status updated successfully to ${branch.isActive ? 'Active' : 'Inactive'}`,
      data: { branch },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Delete a branch (Admin only)
export const deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch not found',
      });
    }

    // Write audit log
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_DELETE',
      description: `Deleted branch ${branch.name} (${branch.code})`,
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Branch deleted successfully',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get branch hourly load, service share, and status breakdowns
export const getBranchPerformanceAnalytics = async (req, res) => {
  const { id } = req.params;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Hourly Traffic Aggregation
    const hourlyTraffic = await Token.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(id),
          arrivalTime: { $gte: startOfDay, $lte: endOfDay },
        }
      },
      {
        $group: {
          _id: { $hour: "$arrivalTime" },
          count: { $sum: 1 },
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. Service Distribution Aggregation
    const serviceDistribution = await Token.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(id),
          arrivalTime: { $gte: startOfDay, $lte: endOfDay },
        }
      },
      {
        $lookup: {
          from: "services",
          localField: "service",
          foreignField: "_id",
          as: "serviceInfo",
        }
      },
      { $unwind: "$serviceInfo" },
      {
        $group: {
          _id: "$serviceInfo.name",
          count: { $sum: 1 },
        }
      }
    ]);

    // 3. Status Breakdown
    const statusBreakdown = await Token.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(id),
          arrivalTime: { $gte: startOfDay, $lte: endOfDay },
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        hourlyTraffic,
        serviceDistribution,
        statusBreakdown,
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Regional bulk analytics comparisons for head office
export const getBulkBranchAnalytics = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const stats = await Token.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: '$branch',
          totalTickets: { $sum: 1 },
          activeWaiting: {
            $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] }
          },
          servedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          skippedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
          }
        }
      }
    ]);

    const branches = await Branch.find({});
    const comparisonData = branches.map(b => {
      const branchStat = stats.find(s => s._id.toString() === b._id.toString()) || {
        totalTickets: 0,
        activeWaiting: 0,
        servedCount: 0,
        skippedCount: 0
      };

      return {
        branchId: b._id,
        name: b.name,
        code: b.code,
        isActive: b.isActive,
        metrics: branchStat
      };
    });

    res.status(200).json({
      status: 'success',
      data: { comparison: comparisonData }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Retrieve hourly AI-based visitor density forecasts
export const getBranchCrowdForecast = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        status: 'error',
        message: 'Branch location not found'
      });
    }

    // Get current waiting count as base density factor
    const baseLoad = await Token.countDocuments({ branch: id, status: 'waiting' });
    const forecast = generateCrowdForecast(baseLoad > 0 ? baseLoad : 8);

    res.status(200).json({
      status: 'success',
      data: { forecast }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
