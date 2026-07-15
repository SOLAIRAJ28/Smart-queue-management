import mongoose from 'mongoose';

const TokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: String,
      required: [true, 'Token number is required'],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service reference is required'],
    },
    counter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      default: null,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    status: {
      type: String,
      enum: ['waiting', 'calling', 'completed', 'skipped', 'cancelled'],
      default: 'waiting',
    },
    priority: {
      type: String,
      enum: ['regular', 'senior', 'disabled', 'premium', 'corporate'],
      default: 'regular',
    },
    priorityScore: {
      type: Number,
      default: 0, // Calculated depending on priority category: regular=0, premium=1, corporate=2, senior=3, disabled=4
    },
    sequence: {
      type: Number,
      required: [true, 'Daily sequence number is required'],
    },
    arrivalTime: {
      type: Date,
      default: Date.now,
    },
    callTime: {
      type: Date,
      default: null,
    },
    serveTime: {
      type: Date,
      default: null,
    },
    completionTime: {
      type: Date,
      default: null,
    },
    waitTime: {
      type: Number, // in minutes
      default: 0,
    },
    servingTime: {
      type: Number, // in minutes
      default: 0,
    },
    transferHistory: [
      {
        fromCounter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Counter',
        },
        toCounter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Counter',
        },
        fromService: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
        toService: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
        reason: {
          type: String,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for sorting queue and fetching records
TokenSchema.index({ branch: 1, status: 1, priorityScore: -1, arrivalTime: 1 });
TokenSchema.index({ customer: 1 });
TokenSchema.index({ arrivalTime: 1 });
TokenSchema.index({ branch: 1, arrivalTime: 1 });

const Token = mongoose.model('Token', TokenSchema);
export default Token;
