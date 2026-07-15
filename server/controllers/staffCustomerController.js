import mongoose from 'mongoose';
import User from '../models/User.js';
import Token from '../models/Token.js';
import Staff from '../models/Staff.js';
import CounterStaff from '../models/CounterStaff.js';

// Helper to get staff branch
const getStaffBranch = async (userId) => {
  const cs = await CounterStaff.findById(userId);
  if (cs) {
    return cs.branchId;
  }
  const staff = await Staff.findOne({ user: userId });
  if (!staff) {
    throw new Error('Staff profile not found');
  }
  return staff.branch;
};

// GET /api/staff/customer/:id
export const getCustomerDetails = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
      });
    }

    // Verify if customer has at least one interaction (token) in the staff's branch to allow access
    const branchId = await getStaffBranch(req.user._id);
    const hasInteraction = await Token.exists({ customer: req.params.id, branch: branchId });

    // Fallback: If customer is registered to this branch
    const isSameBranch = customer.branch === branchId.toString();

    if (!hasInteraction && !isSameBranch) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to view this customer details (out of branch scope)'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { customer }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/staff/customer/:id/history
export const getCustomerQueueHistory = async (req, res) => {
  try {
    const branchId = await getStaffBranch(req.user._id);
    const tokens = await Token.find({ customer: req.params.id, branch: branchId })
      .populate('branch')
      .populate('service')
      .populate('counter')
      .populate({ path: 'staff', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: tokens.length,
      data: { tokens }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/staff/customer/:id/tokens
export const getCustomerTokensList = async (req, res) => {
  try {
    const branchId = await getStaffBranch(req.user._id);
    const tokens = await Token.find({ customer: req.params.id, branch: branchId })
      .populate('branch')
      .populate('service')
      .populate('counter')
      .populate({ path: 'staff', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: tokens.length,
      data: { tokens }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/staff/customer/:id/statistics
export const getCustomerStatistics = async (req, res) => {
  try {
    const customerId = new mongoose.Types.ObjectId(req.params.id);
    const branchId = await getStaffBranch(req.user._id);

    const totalTokens = await Token.countDocuments({ customer: customerId, branch: branchId });

    // Average serving time (in minutes) for completed tokens in this branch
    const avgServiceTimeResult = await Token.aggregate([
      { $match: { customer: customerId, branch: branchId, status: 'completed', servingTime: { $exists: true } } },
      { $group: { _id: null, avgServingTime: { $avg: '$servingTime' } } }
    ]);
    const avgServiceTime = avgServiceTimeResult[0]?.avgServingTime || 0;

    // Last Visit inside staff branch
    const lastToken = await Token.findOne({ customer: customerId, branch: branchId })
      .sort({ createdAt: -1 })
      .populate('branch')
      .populate('counter');
    const lastVisitDate = lastToken?.createdAt || null;
    const lastCounterServed = lastToken?.counter?.number || 'N/A';

    // Frequently used services in staff branch
    const freqServices = await Token.aggregate([
      { $match: { customer: customerId, branch: branchId } },
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'serviceInfo' } },
      { $unwind: '$serviceInfo' },
      { $project: { name: '$serviceInfo.name', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    // Unique counters in staff branch
    const assignedCounters = await Token.aggregate([
      { $match: { customer: customerId, branch: branchId, counter: { $ne: null } } },
      { $group: { _id: '$counter' } },
      { $lookup: { from: 'counters', localField: '_id', foreignField: '_id', as: 'counterInfo' } },
      { $unwind: '$counterInfo' },
      { $project: { number: '$counterInfo.number' } }
    ]);
    const previousCounters = assignedCounters.map(c => `Counter ${c.number}`);

    // Previous services list
    const prevServices = freqServices.map(s => s.name);

    res.status(200).json({
      status: 'success',
      data: {
        totalVisits: totalTokens,
        totalTokensGenerated: totalTokens,
        previousServicesUsed: prevServices,
        previousCountersAssigned: previousCounters,
        lastVisitDate,
        averageServiceTime: Math.round(avgServiceTime * 100) / 100,
        frequentlyUsedServices: freqServices,
        lastCounterServed
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
