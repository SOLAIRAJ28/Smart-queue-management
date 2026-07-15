import mongoose from 'mongoose';

const OtpSessionSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    otpCode: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    lastRequestTime: {
      type: Date,
      default: null,
    },
    cooldownUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const OtpSession = mongoose.model('OtpSession', OtpSessionSchema);
export default OtpSession;
