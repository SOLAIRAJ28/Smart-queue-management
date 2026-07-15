import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      required: [true, 'Token reference is required'],
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service reference is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comments: {
      type: String,
      trim: true,
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for analytics and report range queries
FeedbackSchema.index({ createdAt: 1 });
FeedbackSchema.index({ branch: 1, createdAt: 1 });

const Feedback = mongoose.model('Feedback', FeedbackSchema);
export default Feedback;
