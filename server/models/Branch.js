import mongoose from 'mongoose';

const BranchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Branch code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    contact: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    workingHours: {
      open: {
        type: String,
        required: [true, 'Opening time is required'],
        default: '09:00',
      },
      close: {
        type: String,
        required: [true, 'Closing time is required'],
        default: '17:00',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Branch = mongoose.model('Branch', BranchSchema);
export default Branch;
