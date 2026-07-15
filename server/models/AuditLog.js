import mongoose from 'mongoose';
import crypto from 'crypto';

const AuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor reference is required'],
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    previousHash: {
      type: String,
      default: 'GENESIS_HASH',
    },
    hash: {
      type: String,
    }
  },
  {
    timestamps: false,
  }
);

// Indexes for performance
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ actor: 1 });

// Crypto-Secure Chaining Pre-Save Hook
AuditLogSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  try {
    // 1. Fetch the immediately preceding audit log
    const lastLog = await this.constructor.findOne({}).sort({ timestamp: -1, _id: -1 });
    
    if (lastLog && lastLog.hash) {
      this.previousHash = lastLog.hash;
    } else {
      this.previousHash = 'GENESIS_HASH';
    }

    // 2. Compute SHA-256 of the new log payload block
    const blockString = [
      this.actor ? this.actor.toString() : 'ANONYMOUS',
      this.action,
      this.description,
      this.ipAddress || '0.0.0.0',
      this.userAgent || 'UNKNOWN',
      this.timestamp.toISOString(),
      this.previousHash
    ].join('|');

    this.hash = crypto
      .createHash('sha256')
      .update(blockString)
      .digest('hex');

    next();
  } catch (err) {
    next(err);
  }
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
