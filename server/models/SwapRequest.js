import mongoose from 'mongoose';

const SwapRequestSchema = new mongoose.Schema(
  {
    senderCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      required: true,
    },
    receiverToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      required: true,
    },
    senderQueuePosition: {
      type: Number,
      required: true,
    },
    receiverQueuePosition: {
      type: Number,
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Cancelled', 'Completed'],
      default: 'Pending',
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    cancelledReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
SwapRequestSchema.index({ status: 1 });
SwapRequestSchema.index({ senderCustomer: 1, status: 1 });
SwapRequestSchema.index({ receiverCustomer: 1, status: 1 });
SwapRequestSchema.index({ receiverToken: 1, status: 1 });
SwapRequestSchema.index({ senderToken: 1, status: 1 });

const SwapRequest = mongoose.model('SwapRequest', SwapRequestSchema);
export default SwapRequest;
