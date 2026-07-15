import User from '../models/User.js';
import Token from '../models/Token.js';

// GET /api/admin/customers
export const getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: customers.length,
      data: { customers }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/admin/customer/:id
export const getCustomerById = async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-password');
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
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

// GET /api/admin/customer-history/:id
export const getCustomerHistoryAdmin = async (req, res) => {
  try {
    const tokens = await Token.find({ customer: req.params.id })
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
