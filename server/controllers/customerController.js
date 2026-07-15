import Token from '../models/Token.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';

// GET /api/customer/history
export const getCustomerHistory = async (req, res) => {
  try {
    const tokens = await Token.find({ customer: req.user._id })
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

// GET /api/customer/profile
export const getCustomerProfile = async (req, res) => {
  try {
    const customerId = req.user._id;

    // Tokens count and aggregations
    const totalTokens = await Token.countDocuments({ customer: customerId });
    const completedTokens = await Token.countDocuments({ customer: customerId, status: 'completed' });
    const pendingTokens = await Token.countDocuments({ customer: customerId, status: 'waiting' });
    const cancelledTokens = await Token.countDocuments({ customer: customerId, status: 'cancelled' });
    const skippedTokens = await Token.countDocuments({ customer: customerId, status: 'skipped' });

    // Last branch visited
    const lastTokenWithBranch = await Token.findOne({ customer: customerId, branch: { $ne: null } })
      .sort({ createdAt: -1 })
      .populate('branch');
    const lastBranchVisited = lastTokenWithBranch?.branch?.name || 'N/A';

    // Last counter used
    const lastTokenWithCounter = await Token.findOne({ customer: customerId, counter: { $ne: null } })
      .sort({ createdAt: -1 })
      .populate('counter');
    const lastCounterUsed = lastTokenWithCounter?.counter?.number ? `Counter ${lastTokenWithCounter.counter.number}` : 'N/A';

    // Latest 10 tokens
    const recentTokens = await Token.find({ customer: customerId })
      .populate('branch')
      .populate('service')
      .populate('counter')
      .populate({ path: 'staff', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      status: 'success',
      data: {
        profile: {
          fullName: req.user.fullName || req.user.name,
          username: req.user.username || req.user.email?.split('@')[0],
          email: req.user.email,
          mobile: req.user.mobile || req.user.phone,
          branch: req.user.branch || 'N/A',
          createdAt: req.user.createdAt,
          lastLogin: req.user.lastLogin
        },
        statistics: {
          totalTokens,
          completedServices: completedTokens,
          pendingTokens,
          cancelledTokens,
          skippedTokens,
          lastBranchVisited,
          lastCounterUsed
        },
        recentActivity: recentTokens
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/customer/tokens
export const getCustomerTokens = async (req, res) => {
  try {
    const tokens = await Token.find({ customer: req.user._id })
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

import Notification from '../models/Notification.js';

// GET /api/customer/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      type: 'in-app',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: { notifications },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// PATCH /api/customer/notifications/:id/read
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { notification },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// PATCH /api/customer/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, type: 'in-app', read: false },
      { read: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
