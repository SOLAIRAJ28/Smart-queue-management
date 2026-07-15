import CounterStaff from '../models/CounterStaff.js';
import bcrypt from 'bcryptjs';

// GET /api/admin/counter-staff/:counterId
export const getCounterStaffByCounter = async (req, res) => {
  try {
    const staff = await CounterStaff.findOne({ counterId: req.params.counterId }).select('-password');
    res.status(200).json({
      status: 'success',
      data: staff,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// POST /api/admin/counter-staff
export const createCounterStaff = async (req, res) => {
  try {
    const { counterId, branchId, staffName, email, password, status } = req.body;

    // Check if email already exists
    const emailExists = await CounterStaff.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is already registered to a counter staff',
      });
    }

    // Check if counter already has an assigned staff
    const counterExists = await CounterStaff.findOne({ counterId });
    if (counterExists) {
      return res.status(400).json({
        status: 'error',
        message: 'This counter already has an assigned staff',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newStaff = await CounterStaff.create({
      counterId,
      branchId,
      staffName,
      email: email.toLowerCase(),
      password: hashedPassword,
      status: status || 'active',
    });

    const io = req.app.get('io');
    if (io && branchId) {
      io.to(branchId.toString()).emit('queue_updated', { action: 'staffCreated', staff: newStaff });
    }

    res.status(201).json({
      status: 'success',
      message: 'Counter Staff created successfully.',
      data: newStaff,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// PUT /api/admin/counter-staff/:id
export const updateCounterStaff = async (req, res) => {
  try {
    const { staffName, email, status, password } = req.body;

    const staff = await CounterStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter Staff not found',
      });
    }

    if (email && email.toLowerCase() !== staff.email) {
      const emailExists = await CounterStaff.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is already taken',
        });
      }
      staff.email = email.toLowerCase();
    }

    if (staffName) staff.staffName = staffName;
    if (status) staff.status = status;
    if (password && password.trim() !== '') {
      if (password.length < 8) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 8 characters long',
        });
      }
      const salt = await bcrypt.genSalt(10);
      staff.password = await bcrypt.hash(password, salt);
    }

    await staff.save();

    const io = req.app.get('io');
    if (io && staff.branchId) {
      io.to(staff.branchId.toString()).emit('queue_updated', { action: 'staffUpdated', staff });
    }

    const updatedStaff = staff.toObject();
    delete updatedStaff.password;

    res.status(200).json({
      status: 'success',
      message: 'Counter Staff updated successfully.',
      data: updatedStaff,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// PATCH /api/admin/counter-staff/:id/reset-password
export const resetCounterStaffPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long',
      });
    }

    const staff = await CounterStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter Staff not found',
      });
    }

    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(password, salt);
    await staff.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully.',
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// PATCH /api/admin/counter-staff/:id/status
export const updateCounterStaffStatus = async (req, res) => {
  try {
    const staff = await CounterStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter Staff not found',
      });
    }

    // Toggle status: Enabled <-> Disabled (supporting active/inactive fallback)
    if (staff.status === 'Enabled' || staff.status === 'active') {
      staff.status = 'Disabled';
    } else {
      staff.status = 'Enabled';
    }

    staff.updatedAt = new Date();
    await staff.save();

    const io = req.app.get('io');
    if (io && staff.branchId) {
      io.to(staff.branchId.toString()).emit('queue_updated', { action: 'staffStatusChanged', staff });
    }

    res.status(200).json({
      status: 'success',
      message: `Counter Staff status updated to ${staff.status}.`,
      data: staff,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// DELETE /api/admin/counter-staff/:id
export const deleteCounterStaff = async (req, res) => {
  try {
    const staff = await CounterStaff.findByIdAndDelete(req.params.id);
    if (!staff) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter Staff not found',
      });
    }

    const io = req.app.get('io');
    if (io && staff.branchId) {
      io.to(staff.branchId.toString()).emit('queue_updated', { action: 'staffDeleted', staff });
    }

    res.status(200).json({
      status: 'success',
      message: 'Counter Staff deleted successfully.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
