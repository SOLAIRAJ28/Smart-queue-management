import Token from '../models/Token.js';
import Service from '../models/Service.js';
import Branch from '../models/Branch.js';
import Counter from '../models/Counter.js';
import Appointment from '../models/Appointment.js';
import Feedback from '../models/Feedback.js';
import { predictWaitingTime } from '../utils/aiPredictor.js';
import { sendTokenCreated } from '../services/notificationService.js';

// Generate/Take a Token
export const createToken = async (req, res) => {
  const { branch, branchId, service, serviceId, customer, priority } = req.body;
  const actualBranch = branch || branchId;
  const actualService = service || serviceId;

  try {
    // 1. Verify branch and service exist
    const branchDoc = await Branch.findById(actualBranch);
    if (!branchDoc || !branchDoc.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Active branch not found',
      });
    }

    const serviceDoc = await Service.findById(actualService);
    if (!serviceDoc || !serviceDoc.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Active service not found',
      });
    }

    // 2. Determine daily sequence for this branch and service
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const latestTokenForDay = await Token.findOne({
      branch: actualBranch,
      service: actualService,
      arrivalTime: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ sequence: -1 });

    const sequence = latestTokenForDay ? latestTokenForDay.sequence + 1 : 1;

    // 3. Format Token Number (e.g., DEP001)
    const prefix = serviceDoc.prefix || 'T';
    const tokenNumber = `${prefix}${String(sequence).padStart(3, '0')}`;

    // 4. Map priority strings to numeric priorityScores
    // Higher score = higher queue position priority
    let priorityScore = 0;
    const priorityVal = priority ? priority.toLowerCase() : 'regular';
    if (priorityVal === 'premium') priorityScore = 1;
    else if (priorityVal === 'corporate') priorityScore = 2;
    else if (priorityVal === 'senior') priorityScore = 3;
    else if (priorityVal === 'disabled') priorityScore = 4;

    // 5. Create Token record
    const token = await Token.create({
      tokenNumber,
      customer: customer || (req.user ? req.user._id : null),
      branch: actualBranch,
      service: actualService,
      priority: priorityVal,
      priorityScore,
      sequence,
      arrivalTime: new Date(),
      status: 'waiting',
    });

    // 5b. Link to appointment if exists for today
    if (token.customer) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const appointment = await Appointment.findOne({
        customer: token.customer,
        branch: actualBranch,
        service: actualService,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'scheduled',
        token: null,
      });

      if (appointment) {
        appointment.token = token._id;
        await appointment.save();
      }
    }

    // 6. Calculate AI wait prediction metrics
    const waitingCount = await Token.countDocuments({
      branch: actualBranch,
      service: actualService,
      status: 'waiting'
    });

    const activeTellers = await Counter.countDocuments({
      branch: actualBranch,
      currentService: actualService,
      status: 'enabled'
    });

    const prediction = predictWaitingTime(waitingCount, serviceDoc.avgServingTime || 15, activeTellers);

    // Send Token Created alert in background
    Token.findById(token._id)
      .populate('branch')
      .populate('service')
      .populate('customer')
      .then((popToken) => {
        if (popToken && popToken.customer) {
          sendTokenCreated(popToken, popToken.customer);
        }
      })
      .catch((err) => console.error('Error sending token creation notification:', err));

    // Emit Socket events
    const io = req.app.get('io');
    if (io) {
      io.to(actualBranch.toString()).emit('tokenCreated', { token });
      io.to(actualBranch.toString()).emit('queue_updated', { action: 'tokenCreated', token });
    }

    res.status(201).json({
      status: 'success',
      data: { 
        token,
        prediction
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get Token Details
export const getTokenById = async (req, res) => {
  try {
    const token = await Token.findById(req.params.id)
      .populate('branch')
      .populate('service')
      .populate('customer', 'name email phone')
      .populate('counter')
      .populate({
        path: 'staff',
        populate: { path: 'user', select: 'name' }
      });

    if (!token) {
      return res.status(404).json({
        status: 'error',
        message: 'Token not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get active queue status for a branch
export const getActiveBranchQueue = async (req, res) => {
  const { branchId } = req.params;
  const { all } = req.query;

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      branch: branchId,
    };

    if (all === 'true') {
      query.arrivalTime = { $gte: startOfDay, $lte: endOfDay };
    } else {
      query.status = { $in: ['waiting', 'calling'] };
    }

    // Get tokens matching query, sorted by priority score DESC then arrival time ASC
    const queue = await Token.find(query)
      .sort({ status: -1, priorityScore: -1, arrivalTime: 1 }) // calling tokens first, then waiting by priority
      .populate('service')
      .populate('customer', 'name')
      .populate('counter')
      .populate({
        path: 'staff',
        populate: { path: 'user', select: 'name' }
      });

    res.status(200).json({
      status: 'success',
      results: queue.length,
      data: { queue },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get active waiting token for logged-in customer
export const getCustomerActiveToken = async (req, res) => {
  try {
    const activeToken = await Token.findOne({
      customer: req.user._id,
      status: { $in: ['waiting', 'calling'] },
    })
      .populate('branch')
      .populate('service')
      .populate('counter');

    let prediction = null;
    if (activeToken) {
      if (activeToken.status === 'calling') {
        prediction = {
          waitMinutes: 0,
          congestionLevel: 'low',
          advice: 'Your token is being called! Proceed to counter ' + (activeToken.counter?.number || '')
        };
      } else {
        // Count tokens of same service/branch waiting ahead in queue
        const waitingAhead = await Token.countDocuments({
          branch: activeToken.branch._id,
          service: activeToken.service._id,
          status: 'waiting',
          arrivalTime: { $lte: activeToken.arrivalTime }
        });

        const activeTellers = await Counter.countDocuments({
          branch: activeToken.branch._id,
          currentService: activeToken.service._id,
          status: 'enabled'
        });

        prediction = predictWaitingTime(
          waitingAhead, 
          activeToken.service.avgServingTime || 15, 
          activeTellers
        );
      }
    }

    res.status(200).json({
      status: 'success',
      data: { 
        token: activeToken,
        prediction
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get all historical tokens for logged-in customer
export const getCustomerTokensHistory = async (req, res) => {
  try {
    const tokens = await Token.find({ customer: req.user._id })
      .populate('branch')
      .populate('service')
      .populate('counter')
      .populate({ path: 'staff', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    // Identify which completed tokens already have feedback submitted
    const tokenIds = tokens.map((t) => t._id);
    const existingFeedbacks = await Feedback.find({ token: { $in: tokenIds } }).select('token');
    const ratedTokenIds = new Set(existingFeedbacks.map((f) => f.token.toString()));

    // Attach feedbackGiven flag to each token plain object
    const tokensWithFlag = tokens.map((t) => {
      const obj = t.toObject();
      obj.feedbackGiven = ratedTokenIds.has(t._id.toString());
      return obj;
    });

    res.status(200).json({
      status: 'success',
      results: tokensWithFlag.length,
      data: { tokens: tokensWithFlag },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
