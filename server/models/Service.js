import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Service code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    avgServingTime: {
      type: Number,
      default: 10, // default to 10 minutes
    },
    prefix: {
      type: String,
      required: [true, 'Prefix code is required'],
      uppercase: true,
      trim: true,
      maxlength: 2,
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

const Service = mongoose.model('Service', ServiceSchema);
export default Service;
