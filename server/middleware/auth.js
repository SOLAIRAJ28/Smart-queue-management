import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import CounterStaff from '../models/CounterStaff.js';
import BranchManager from '../models/BranchManager.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.toLowerCase().startsWith('bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    console.log('[DEBUG] JWT Decoded Payload:', decoded);

    // Fetch user and attach to request, excluding password
    let user = await User.findById(decoded.id).select('-password');
    if (!user) {
      user = await CounterStaff.findById(decoded.id).select('-password');
    }
    if (!user) {
      user = await BranchManager.findById(decoded.id).select('-password');
    }

    if (!user) {
      console.log('[DEBUG] Logged-in staff/user/manager not found in DB for ID:', decoded.id);
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized, token expired or invalid',
    });
  }
};

// Middleware to restrict access based on roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (req.user) {
      console.log('[DEBUG] Logged-in User:', req.user._id);
      console.log('[DEBUG] Role:', req.user.role);
      if (req.user.role === 'counter_staff') {
        console.log('[DEBUG] Assigned Counter:', req.user.counterId);
        console.log('[DEBUG] Assigned Branch:', req.user.branchId);
      }
    }
    
    const allowed = req.user && roles.includes(req.user.role);
    console.log('[DEBUG] Permission validation result:', allowed ? 'GRANTED' : 'DENIED');

    if (!allowed) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

export const optionalProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.toLowerCase().startsWith('bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    let user = await User.findById(decoded.id).select('-password');
    if (!user) {
      user = await CounterStaff.findById(decoded.id).select('-password');
    }
    if (!user) {
      user = await BranchManager.findById(decoded.id).select('-password');
    }
    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

// Middleware to restrict branch managers to their assigned branch
export const restrictBranch = async (req, res, next) => {
  if (req.user && req.user.role === 'branch_manager') {
    let branchId = req.query.branchId || req.query.branch || req.body.branchId || req.body.branch;

    // Resolve branch ID for /api/branches/:id
    if (!branchId && req.baseUrl === '/api/branches' && req.params.id) {
      branchId = req.params.id;
    }

    // Resolve branch ID for /api/tokens/branch/:branchId
    if (!branchId && req.params.branchId) {
      branchId = req.params.branchId;
    }

    // Resolve branch ID for /api/counters/:id
    if (!branchId && req.baseUrl === '/api/counters' && req.params.id) {
      try {
        const Counter = (await import('../models/Counter.js')).default;
        const counter = await Counter.findById(req.params.id);
        if (counter) {
          branchId = counter.branch;
        }
      } catch (err) {
        console.error('Error resolving counter branch context:', err);
      }
    }

    if (branchId && req.user.branchId && branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: You only have access to your assigned branch',
      });
    }
  }
  next();
};
