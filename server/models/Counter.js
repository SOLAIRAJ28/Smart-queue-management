import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: [true, 'Counter number is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    currentStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    currentService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    status: {
      type: String,
      enum: ['enabled', 'disabled'],
      default: 'enabled',
    },
    currentToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index so counter numbers are unique per branch
CounterSchema.index({ number: 1, branch: 1 }, { unique: true });

const Counter = mongoose.model('Counter', CounterSchema);
export default Counter;
