import jwt from 'jsonwebtoken';
import Counter from '../models/Counter.js';

export const generateAccessToken = async (user) => {
  let payload = { id: user._id, role: user.role, email: user.email };

  if (user.role === 'counter_staff') {
    let assignedService = null;
    if (user.counterId) {
      const counter = await Counter.findById(user.counterId);
      if (counter && counter.currentService) {
        assignedService = counter.currentService.toString();
      }
    }

    payload = {
      id: user._id,
      staffId: user._id.toString(),
      role: user.role,
      counterId: user.counterId ? user.counterId.toString() : null,
      branchId: user.branchId ? user.branchId.toString() : null,
      assignedService: assignedService,
      email: user.email,
    };
  }

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Access token valid for 15 minutes
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // Refresh token valid for 7 days
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
