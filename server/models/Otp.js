import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    requests: {
      type: [Date],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove documents when expiresAt is reached
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', OtpSchema);
export default Otp;
