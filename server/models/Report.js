import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: [true, 'Report type is required'],
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Generator user link is required'],
    },
    dateRange: {
      start: {
        type: Date,
        required: [true, 'Start date is required'],
      },
      end: {
        type: Date,
        required: [true, 'End date is required'],
      },
    },
    metrics: {
      totalTokens: {
        type: Number,
        default: 0,
      },
      servedTokens: {
        type: Number,
        default: 0,
      },
      skippedTokens: {
        type: Number,
        default: 0,
      },
      avgWaitTime: {
        type: Number, // in minutes
        default: 0,
      },
      avgServeTime: {
        type: Number, // in minutes
        default: 0,
      },
    },
    filePath: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model('Report', ReportSchema);
export default Report;
