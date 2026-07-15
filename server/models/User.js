import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['customer', 'staff', 'manager', 'admin'],
      default: 'customer',
    },
    branch: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving & synchronize compatible fields
UserSchema.pre('save', async function (next) {
  if (this.fullName && !this.name) this.name = this.fullName;
  if (this.name && !this.fullName) this.fullName = this.name;
  if (this.mobile && !this.phone) this.phone = this.mobile;
  if (this.phone && !this.mobile) this.mobile = this.phone;
  if (this.mobileNumber) {
    if (!this.phone) this.phone = this.mobileNumber;
    if (!this.mobile) this.mobile = this.mobileNumber;
  }
  if (this.email && !this.username) {
    this.username = this.email.split('@')[0];
  }

  if (!this.password) {
    return next();
  }

  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare user password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);
export default User;
