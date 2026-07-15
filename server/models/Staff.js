import mongoose from 'mongoose';

const StaffSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User account link is required'],
      unique: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    counter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      default: null,
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    status: {
      type: String,
      enum: ['offline', 'active', 'busy', 'break'],
      default: 'offline',
    },
  },
  {
    timestamps: true,
  }
);

const Staff = mongoose.model('Staff', StaffSchema);
export default Staff;
