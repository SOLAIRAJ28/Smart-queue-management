import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const BranchManagerSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch ID is required'],
      unique: true,
    },
    managerName: {
      type: String,
      required: [true, 'Manager name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type: String,
      default: 'branch_manager',
    },
    status: {
      type: String,
      enum: ['Enabled', 'Disabled'],
      default: 'Enabled',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
BranchManagerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const isAlreadyHashed = this.password && this.password.length === 60 && /^\$2[ayb]\$/.test(this.password);
  if (isAlreadyHashed) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
BranchManagerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const BranchManager = mongoose.model('BranchManager', BranchManagerSchema);
export default BranchManager;
