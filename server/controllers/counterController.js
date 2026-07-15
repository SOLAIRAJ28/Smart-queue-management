import Counter from '../models/Counter.js';
import Staff from '../models/Staff.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Service from '../models/Service.js';
import Token from '../models/Token.js';
import CounterStaff from '../models/CounterStaff.js';

// Get all counters (can filter by branch)
export const getCounters = async (req, res) => {
  const { branch } = req.query;
  const filter = branch ? { branch } : {};

  try {
    const counters = await Counter.find(filter)
      .populate('branch')
      .populate({
        path: 'currentStaff',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('currentService')
      .populate({
        path: 'currentToken',
        populate: [
          { path: 'service' },
          { path: 'customer', select: 'name fullName username email phone mobile branch createdAt lastLogin' }
        ]
      });

    // Find and map CounterStaff records to their counters
    const counterStaffs = await CounterStaff.find().select('-password');
    const staffMap = {};
    counterStaffs.forEach(cs => {
      staffMap[cs.counterId.toString()] = cs;
    });

    // Count completed tokens for each counter today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const completedTokens = await Token.find({
      branch: branch || { $exists: true },
      status: 'completed',
      arrivalTime: { $gte: startOfDay, $lte: endOfDay }
    });

    const completedMap = {};
    completedTokens.forEach(t => {
      if (t.counter) {
        completedMap[t.counter.toString()] = (completedMap[t.counter.toString()] || 0) + 1;
      }
    });

    const countersWithStaff = counters.map(c => {
      const cObj = c.toObject();
      cObj.counterStaff = staffMap[c._id.toString()] || null;
      cObj.completedCountToday = completedMap[c._id.toString()] || 0;
      return cObj;
    });

    res.status(200).json({
      status: 'success',
      results: countersWithStaff.length,
      data: { counters: countersWithStaff },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get a single counter by ID
export const getCounterById = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('branch')
      .populate({
        path: 'currentStaff',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('currentService')
      .populate({
        path: 'currentToken',
        populate: [
          { path: 'service' },
          { path: 'customer', select: 'name fullName username email phone mobile branch createdAt lastLogin' }
        ]
      });

    if (!counter) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter not found',
      });
    }

    const counterStaff = await CounterStaff.findOne({ counterId: counter._id }).select('-password');
    const counterObj = counter.toObject();
    counterObj.counterStaff = counterStaff;

    res.status(200).json({
      status: 'success',
      data: { counter: counterObj },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Create a new counter (Admin only)
export const createCounter = async (req, res) => {
  const { number, branch, currentStaff, currentService, status } = req.body;

  try {
    // Check if counter number already exists in this branch
    const counterExists = await Counter.findOne({ number, branch });
    if (counterExists) {
      return res.status(400).json({
        status: 'error',
        message: `Counter number ${number} already exists in this branch`,
      });
    }

    const counter = await Counter.create({
      number,
      branch,
      currentStaff,
      currentService,
      status,
    });

    res.status(201).json({
      status: 'success',
      data: { counter },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Update counter, assign staff or service (Admin / Manager)
export const updateCounter = async (req, res) => {
  const { currentStaff, currentService } = req.body;

  try {
    // If staff is being assigned, make sure they exist
    if (currentStaff) {
      const staffExists = await Staff.findById(currentStaff);
      if (!staffExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Referenced staff profile not found',
        });
      }
    }

    const counter = await Counter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate({
      path: 'currentStaff',
      populate: { path: 'user', select: 'name' }
    }).populate('currentService');

    if (!counter) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter not found',
      });
    }

    // If staff is assigned to this counter, update staff's counter field as well
    if (currentStaff) {
      await Staff.findByIdAndUpdate(currentStaff, { counter: counter._id });
    }

    res.status(200).json({
      status: 'success',
      data: { counter },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Toggle counter enablement status (Admin / Manager)
export const toggleCounterStatus = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter not found',
      });
    }

    counter.status = counter.status === 'enabled' ? 'disabled' : 'enabled';
    await counter.save();

    const io = req.app.get('io');
    if (io && counter.branch) {
      io.to(counter.branch.toString()).emit('counterStatusChanged', { counter });
      io.to(counter.branch.toString()).emit('queue_updated', { action: 'counterStatusChanged', counter });
    }

    res.status(200).json({
      status: 'success',
      message: `Counter has been ${counter.status}`,
      data: { counter },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Delete a counter (Admin only)
export const deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findByIdAndDelete(req.params.id);
    if (!counter) {
      return res.status(404).json({
        status: 'error',
        message: 'Counter not found',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Counter deleted successfully',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
