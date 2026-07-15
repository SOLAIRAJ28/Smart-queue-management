import Feedback from '../models/Feedback.js';
import Token from '../models/Token.js';
import Staff from '../models/Staff.js';
import CounterStaff from '../models/CounterStaff.js';

// Simple rule-based sentiment analyzer
const analyzeSentiment = (text) => {
  if (!text) return 'neutral';

  const positiveWords = ['good', 'great', 'excellent', 'awesome', 'fast', 'helpful', 'friendly', 'satisfied', 'perfect', 'quick', 'love', 'nice', 'smooth'];
  const negativeWords = ['bad', 'slow', 'poor', 'rude', 'worst', 'terrible', 'unhelpful', 'angry', 'dissatisfied', 'hate', 'frustrated', 'delay', 'waste', 'horrible'];

  const lowerText = text.toLowerCase();
  let posCount = 0;
  let negCount = 0;

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) posCount++;
  });

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negCount++;
  });

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
};

// 1. Submit customer feedback
export const submitFeedback = async (req, res) => {
  const { tokenId, rating, comments } = req.body;

  try {
    // Verify token exists and is completed
    const token = await Token.findById(tokenId);
    if (!token) {
      return res.status(404).json({
        status: 'error',
        message: 'Token ticket not found.',
      });
    }

    if (token.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Feedback can only be submitted for completed transactions.',
      });
    }

    // Verify feedback doesn't already exist for this token
    const existingFeedback = await Feedback.findOne({ token: tokenId });
    if (existingFeedback) {
      return res.status(400).json({
        status: 'error',
        message: 'Feedback has already been submitted for this service ticket.',
      });
    }

    const sentiment = analyzeSentiment(comments);

    const feedback = await Feedback.create({
      token: tokenId,
      customer: req.user?._id || token.customer || null,
      service: token.service,
      branch: token.branch,
      rating,
      comments,
      sentiment,
    });

    res.status(201).json({
      status: 'success',
      data: { feedback },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 2. Get all feedback for a branch (Admin/Manager)
export const getBranchFeedback = async (req, res) => {
  const { branchId } = req.params;

  try {
    const feedbacks = await Feedback.find({ branch: branchId })
      .populate('customer', 'name email phone')
      .populate('service', 'name code')
      .populate('token', 'tokenNumber sequence')
      .sort({ createdAt: -1 });

    // Calculate aggregated metrics
    const totalCount = feedbacks.length;
    let sumRatings = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    feedbacks.forEach(f => {
      sumRatings += f.rating;
      if (f.sentiment === 'positive') positiveCount++;
      else if (f.sentiment === 'negative') negativeCount++;
      else neutralCount++;
    });

    const averageRating = totalCount > 0 ? Math.round((sumRatings / totalCount) * 10) / 10 : 0;
    const sentimentDistribution = {
      positive: totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0,
      neutral: totalCount > 0 ? Math.round((neutralCount / totalCount) * 100) : 0,
      negative: totalCount > 0 ? Math.round((negativeCount / totalCount) * 100) : 0,
    };

    res.status(200).json({
      status: 'success',
      results: totalCount,
      metrics: {
        averageRating,
        sentimentDistribution,
        totalFeedbackCount: totalCount,
      },
      data: { feedbacks },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 3. Get feedback for the logged-in staff member
export const getStaffFeedback = async (req, res) => {
  try {
    let staffId = null;
    let staff = await Staff.findOne({ user: req.user._id });
    if (staff) {
      staffId = staff._id;
    } else {
      const cs = await CounterStaff.findById(req.user._id);
      if (cs) {
        staffId = cs._id;
      }
    }

    if (!staffId) {
      return res.status(404).json({
        status: 'error',
        message: 'Staff profile not found.',
      });
    }

    // Find all tokens served by this staff member
    const tokens = await Token.find({ staff: staffId }).select('_id');
    const tokenIds = tokens.map(t => t._id);

    // Find all feedback for these tokens
    const feedbacks = await Feedback.find({ token: { $in: tokenIds } })
      .populate('customer', 'name')
      .populate('service', 'name code')
      .populate('token', 'tokenNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: feedbacks.length,
      data: { feedbacks },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
