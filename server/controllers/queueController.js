import Token from '../models/Token.js';
import Counter from '../models/Counter.js';
import Staff from '../models/Staff.js';
import Appointment from '../models/Appointment.js';
import CounterStaff from '../models/CounterStaff.js';
import { sendTokenCalled, sendTokenPositionReminder } from '../services/notificationService.js';
import { autoCancelSwapsForToken } from './swapController.js';

// Helper to get active staff profile by user ID
const getActiveStaff = async (userId) => {
  let staff = await Staff.findOne({ user: userId });
  if (!staff) {
    // Check CounterStaff collection
    const cs = await CounterStaff.findById(userId);
    if (cs) {
      staff = {
        _id: cs._id,
        user: cs._id,
        counter: cs.counterId,
        branch: cs.branchId,
        status: (cs.status === 'active' || cs.status === 'Enabled') ? 'active' : 'offline',
        isCounterStaff: true,
        save: async function() {
          if (this.status === 'offline') {
            cs.status = 'Disabled';
          } else if (this.status === 'active') {
            cs.status = 'Enabled';
          }
          await cs.save();
        }
      };
    }
  }

  if (!staff || staff.status === 'offline') {
    throw new Error('Staff profile not found or offline');
  }
  if (!staff.counter) {
    throw new Error('Staff is not assigned to any counter');
  }
  return staff;
};

// 1. Call Next Token
export const callNext = async (req, res) => {
  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || counter.status !== 'enabled') {
      return res.status(400).json({
        status: 'error',
        message: 'Counter is disabled or not found',
      });
    }

    // Check if counter already has a calling token
    if (counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Please complete or skip the current token first',
      });
    }

    // Find the next waiting token for the counter's assigned service
    // sorted by priority score DESC, then arrival time ASC
    const nextToken = await Token.findOne({
      branch: counter.branch,
      service: counter.currentService,
      status: 'waiting',
    }).sort({ priorityScore: -1, arrivalTime: 1 });

    if (!nextToken) {
      return res.status(200).json({
        status: 'success',
        message: 'No waiting customers in the queue for this service',
        data: null,
      });
    }

    // Update token details
    nextToken.status = 'calling';
    nextToken.counter = counter._id;
    nextToken.staff = staff._id;
    nextToken.callTime = new Date();
    
    // wait time in minutes
    const waitMs = nextToken.callTime - nextToken.arrivalTime;
    nextToken.waitTime = Math.round((waitMs / 60000) * 100) / 100;
    
    await nextToken.save();
    
    // Auto cancel pending swaps involving this called token
    await autoCancelSwapsForToken(nextToken._id, 'Queue has progressed.', req.app.get('io'));

    // Update counter currentToken
    counter.currentToken = nextToken._id;
    await counter.save();

    // Set staff status to busy
    staff.status = 'busy';
    await staff.save();

    // Retrieve fully populated token
    const populatedToken = await Token.findById(nextToken._id)
      .populate('service')
      .populate('customer');

    // Notify Called Customer in background
    if (populatedToken && populatedToken.customer) {
      sendTokenCalled(populatedToken, populatedToken.customer, counter.number)
        .catch((err) => console.error('Error sending token call notification:', err));
    }

    // Notify the Next customer in line (position #1 waiting)
    Token.findOne({
      branch: counter.branch,
      service: counter.currentService,
      status: 'waiting',
    })
      .sort({ priorityScore: -1, arrivalTime: 1 })
      .populate('customer')
      .then((nextWaiting) => {
        if (nextWaiting && nextWaiting.customer) {
          sendTokenPositionReminder(nextWaiting, nextWaiting.customer, 1);
        }
      })
      .catch((err) => console.error('Error sending position alert to next waiting client:', err));

    // Emit socket update (if socket server attached in app state)
    const io = req.app.get('io');
    if (io) {
      io.to(counter.branch.toString()).emit('tokenCalled', {
        counterNumber: counter.number,
        token: populatedToken,
      });
      io.to(counter.branch.toString()).emit('queue_updated', {
        action: 'call_next',
        counterNumber: counter.number,
        token: populatedToken,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { token: populatedToken },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Start serving (Transition from calling to active serve)
export const startServe = async (req, res) => {
  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || !counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No token currently active at this counter',
      });
    }

    const token = await Token.findById(counter.currentToken);
    if (!token.serveTime) {
      token.serveTime = new Date();
      await token.save();
      
      // Auto cancel pending swaps involving this serving token
      await autoCancelSwapsForToken(token._id, 'Queue has progressed.', req.app.get('io'));
    }

    // Emit socket update
    const io = req.app.get('io');
    if (io && counter.branch) {
      io.to(counter.branch.toString()).emit('queue_updated', {
        action: 'start_serve',
        counterNumber: counter.number,
        token,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Serving started',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 2. Skip Token
export const skipToken = async (req, res) => {
  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || !counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No active token to skip',
      });
    }

    const token = await Token.findById(counter.currentToken);
    token.status = 'skipped';
    await token.save();
    
    // Auto cancel pending swaps involving this skipped token
    await autoCancelSwapsForToken(token._id, 'Queue has progressed.', req.app.get('io'));

    // Update associated appointment to cancelled if it exists
    await Appointment.updateOne(
      { token: token._id },
      { status: 'cancelled' }
    );

    // Clear counter token
    counter.currentToken = null;
    await counter.save();

    // Set staff status back to active
    staff.status = 'active';
    await staff.save();

    // Emit socket update (if socket server attached in app state)
    const io = req.app.get('io');
    if (io) {
      io.to(counter.branch.toString()).emit('queue_updated', {
        action: 'skip',
        counterNumber: counter.number,
        token,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Token marked as skipped',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 3. Recall Token
export const recallToken = async (req, res) => {
  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || !counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No active token to recall',
      });
    }

    const token = await Token.findById(counter.currentToken)
      .populate('service')
      .populate('customer');

    // Send Recall Alert Notification in background
    if (token && token.customer) {
      sendTokenCalled(token, token.customer, counter.number)
        .catch((err) => console.error('Error sending token recall notification:', err));
    }

    // Emit Socket alarm/alert for voice call and flash display boards
    const io = req.app.get('io');
    if (io) {
      io.to(counter.branch.toString()).emit('recall_token', {
        counterNumber: counter.number,
        token,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Recall buzzer triggered',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 4. Complete Service
export const completeService = async (req, res) => {
  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || !counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No active token to complete',
      });
    }

    const token = await Token.findById(counter.currentToken);
    token.status = 'completed';
    token.completionTime = new Date();
    
    // Set serveTime if not already set (e.g. if teller bypassed startServe)
    if (!token.serveTime) {
      token.serveTime = token.callTime || new Date();
    }

    // serving time in minutes
    const serveMs = token.completionTime - token.serveTime;
    token.servingTime = Math.round((serveMs / 60000) * 100) / 100;

    await token.save();
    
    // Auto cancel pending swaps involving this completed token
    await autoCancelSwapsForToken(token._id, 'Queue has progressed.', req.app.get('io'));

    // Update associated appointment to completed if it exists
    await Appointment.updateOne(
      { token: token._id },
      { status: 'completed' }
    );

    // Clear counter token
    counter.currentToken = null;
    await counter.save();

    // Set staff status back to active
    staff.status = 'active';
    await staff.save();

    // Emit socket update (if socket server attached in app state)
    const io = req.app.get('io');
    if (io) {
      io.to(counter.branch.toString()).emit('tokenCompleted', {
        token,
      });
      io.to(counter.branch.toString()).emit('queue_updated', {
        action: 'complete',
        counterNumber: counter.number,
        token,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Service completed successfully',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 5. Transfer Token to another service/counter
export const transferToken = async (req, res) => {
  const { toServiceId, reason } = req.body;

  try {
    const staff = await getActiveStaff(req.user._id);
    const counter = await Counter.findById(staff.counter);

    if (!counter || !counter.currentToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No active token to transfer',
      });
    }

    const token = await Token.findById(counter.currentToken);
    const fromService = token.service;

    // Add to transfer history log
    token.transferHistory.push({
      fromCounter: counter._id,
      fromService,
      toService: toServiceId,
      reason: reason || 'Transferred for multi-service processing',
      timestamp: new Date(),
    });

    // Put back in waiting status for the new target service
    token.status = 'waiting';
    token.service = toServiceId;
    token.counter = null;
    token.staff = null;
    token.callTime = null;
    token.serveTime = null;

    // Slight priority boost so they don't wait long at the new service
    token.priorityScore = token.priorityScore + 0.5;
    
    await token.save();
    
    // Auto cancel pending swaps involving this transferred token
    await autoCancelSwapsForToken(token._id, 'Queue has progressed.', req.app.get('io'));

    // Clear counter token
    counter.currentToken = null;
    await counter.save();

    // Set staff status back to active
    staff.status = 'active';
    await staff.save();

    // Emit socket update
    const io = req.app.get('io');
    if (io && counter.branch) {
      io.to(counter.branch.toString()).emit('queue_updated', {
        action: 'transfer',
        counterNumber: counter.number,
        token,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Token transferred successfully',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
