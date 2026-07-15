import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer link is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch reference is required'],
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service reference is required'],
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      type: String, // format e.g. "10:30 - 11:00"
      required: [true, 'Time slot is required'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'rescheduled', 'cancelled'],
      default: 'scheduled',
    },
    priorityCategory: {
      type: String,
      enum: ['regular', 'senior', 'disabled', 'premium', 'corporate'],
      default: 'regular',
    },
    priority: {
      type: String,
      enum: ['regular', 'senior', 'disabled', 'premium', 'corporate'],
      default: 'regular',
    },
    appointmentDate: {
      type: Date,
    },
    appointmentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      default: null,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to avoid duplicate bookings in the same slot for a branch service
AppointmentSchema.index({ branch: 1, date: 1, timeSlot: 1, service: 1, status: 1 });

const Appointment = mongoose.model('Appointment', AppointmentSchema);
export default Appointment;
