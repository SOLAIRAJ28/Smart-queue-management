import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Staff from '../models/Staff.js';
import CounterStaff from '../models/CounterStaff.js';
import BranchManager from '../models/BranchManager.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { logAction } from '../utils/auditLogger.js';
import { sendEmail, sendSMS } from '../services/notificationService.js';
import Otp from '../models/Otp.js';
import OtpSession from '../models/OtpSession.js';

// Register Customer
export const register = async (req, res) => {
  const { name, fullName, username, email, password, phone, mobile, branch } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: 'error',
        message: 'A user with this email already exists',
      });
    }

    // Force role to customer for public registration
    const user = await User.create({
      name: name || fullName,
      fullName: fullName || name,
      username: username || (email ? email.split('@')[0] : undefined),
      email,
      phone: phone || mobile,
      mobile: mobile || phone,
      password,
      role: 'customer',
      branch: branch || null,
      lastLogin: new Date()
    });

    const accessToken = await generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          mobile: user.mobile,
          role: user.role,
          branch: user.branch,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Login user (Customer, Staff, Manager, Admin, Counter Staff)
export const login = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password',
      });
    }

    // Find user by email (include password for verification)
    const normalizedEmail = email.toLowerCase();
    let user = null;
    let isCounterStaff = false;
    let isBranchManager = false;

    if (role === 'staff') {
      user = await CounterStaff.findOne({ email: normalizedEmail });
      if (user) {
        isCounterStaff = true;
      }
    } else if (role === 'manager' || role === 'branch_manager') {
      user = await BranchManager.findOne({ email: normalizedEmail });
      if (user) {
        isBranchManager = true;
      } else {
        // Fallback for user collection matching (if any)
        user = await User.findOne({ email: normalizedEmail });
      }
    } else if (role === 'admin' || role === 'customer') {
      user = await User.findOne({ email: normalizedEmail });
    } else {
      // Fallback/compatibility check when no role is specified
      user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        user = await CounterStaff.findOne({ email: normalizedEmail });
        if (user) {
          isCounterStaff = true;
        }
      }
      if (!user) {
        user = await BranchManager.findOne({ email: normalizedEmail });
        if (user) {
          isBranchManager = true;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    if (isCounterStaff && (user.status === 'inactive' || user.status === 'Disabled')) {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been disabled by the Administrator. Please contact the Administrator.',
      });
    }

    if (isBranchManager && user.status === 'Disabled') {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been disabled by the Administrator. Please contact the Administrator.',
      });
    }

    if (!user.password) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    if (!isCounterStaff && !isBranchManager) {
      await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    const accessToken = await generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // If user is staff, we also want to return their staff profile if it exists
    let staffDetails = null;
    if (user.role === 'staff') {
      staffDetails = await Staff.findOne({ user: user._id })
        .populate('branch')
        .populate('counter')
        .populate('services');
    }

    // Log successful sign-in
    await logAction({
      actor: user._id,
      action: 'USER_LOGIN',
      description: `User ${user.email} successfully logged in as role: ${user.role}`,
      req
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: isCounterStaff ? {
          id: user._id,
          name: user.staffName,
          fullName: user.staffName,
          username: user.email.split('@')[0],
          email: user.email,
          role: user.role,
          counterId: user.counterId,
          branchId: user.branchId,
          branch: user.branchId,
          status: user.status,
          createdAt: user.createdAt,
        } : isBranchManager ? {
          id: user._id,
          name: user.managerName,
          fullName: user.managerName,
          username: user.email.split('@')[0],
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          branch: user.branchId,
          status: user.status,
          createdAt: user.createdAt,
        } : {
          id: user._id,
          name: user.name,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          mobile: user.mobile,
          role: user.role,
          branch: user.branch,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        staffProfile: staffDetails,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Refresh Access Token
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Refresh token is required',
    });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    let user = await User.findById(decoded.id);
    if (!user) {
      user = await CounterStaff.findById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User does not exist',
      });
    }

    const newAccessToken = await generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user); // Optional: rotate refresh token

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired refresh token',
    });
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'No user found with that email address',
      });
    }

    // Generate random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expiry to 1 hour
    user.passwordResetExpires = Date.now() + 3600000;
    await user.save();

    const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    // Log token to console for easy developer testing/verification
    console.log(`[TESTING] Password Reset Link: ${resetURL}`);

    // Standard response (real Nodemailer will send this in Phase 17)
    res.status(200).json({
      status: 'success',
      message: 'Password reset link generated. Reset instructions sent to email.',
      // For local testing convenience in Phase 3 verification
      resetToken: resetToken,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset token is invalid or has expired',
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You can now log in.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get current user details
export const getMe = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
};

// Direct Customer Login/Registration (Unlimited requests permitted)
export const sendOtp = async (req, res) => {
  const { mobileNumber, fullName } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Name is required',
    });
  }

  if (!mobileNumber || !mobileNumber.trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Mobile number is required',
    });
  }

  try {
    // 1. Clean and format the mobile number
    let cleaned = mobileNumber.replace(/\D/g, '');
    if (cleaned.length > 10 && (cleaned.startsWith('91') || cleaned.startsWith('+91'))) {
      cleaned = cleaned.slice(-10);
    }
    
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Mobile Number. Please enter a valid 10-digit Indian mobile number.',
      });
    }

    const formattedMobile = cleaned;

    // 2. Find or Create User uniquely (with regex matching the last 10 digits to handle formatting differences)
    const phoneRegex = new RegExp(formattedMobile + '$');
    let user = await User.findOne({
      $or: [
        { mobileNumber: phoneRegex },
        { phone: phoneRegex },
        { mobile: phoneRegex }
      ]
    });

    const nameToUse = fullName.trim();

    if (!user) {
      // Automatically register new customer
      user = await User.create({
        name: nameToUse,
        fullName: nameToUse,
        mobileNumber: formattedMobile,
        phone: formattedMobile,
        mobile: formattedMobile,
        email: `${formattedMobile}@smartqueue.com`,
        username: `customer_${formattedMobile}`,
        role: 'customer',
        isVerified: true,
        lastLogin: new Date(),
      });
      console.log(`[Customer Auth] Registered new customer: ${formattedMobile}`);
    } else {
      // Update existing customer fields and normalize phone formats
      user.lastLogin = new Date();
      user.fullName = nameToUse;
      user.name = nameToUse;
      user.mobileNumber = formattedMobile;
      user.phone = formattedMobile;
      user.mobile = formattedMobile;
      if (!user.email) {
        user.email = `${formattedMobile}@smartqueue.com`;
      }
      if (!user.username) {
        user.username = `customer_${formattedMobile}`;
      }
      await user.save();
      console.log(`[Customer Auth] Authenticated existing customer: ${formattedMobile}`);
    }

    // 4. Generate Access & Refresh JWT Tokens
    const accessToken = await generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Log successful sign-in
    await logAction({
      actor: user._id,
      action: 'USER_LOGIN',
      description: `Customer ${user.mobileNumber} logged in successfully`,
      req,
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Error in customer login:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to authenticate. Please try again later.',
    });
  }
};

// Placeholder for verification endpoint
export const verifyOtp = async (req, res) => {
  res.status(400).json({
    status: 'error',
    message: 'OTP verification is disabled. Please use direct login.',
  });
};
