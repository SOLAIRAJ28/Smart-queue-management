import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const CounterStaffSchema = new mongoose.Schema(
  {
    counterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      required: [true, 'Counter ID is required'],
      unique: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch ID is required'],
    },
    staffName: {
      type: String,
      required: [true, 'Staff name is required'],
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
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type: String,
      default: 'counter_staff',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'Enabled', 'Disabled'],
      default: 'Enabled',
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving
CounterStaffSchema.pre('save', async function (next) {
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

// Compare password method
CounterStaffSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const CounterStaff = mongoose.model('CounterStaff', CounterStaffSchema);
export default CounterStaff;
