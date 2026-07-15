import Appointment from '../models/Appointment.js';
import { sendAppointmentConfirmation, sendAppointmentCancellation } from '../services/notificationService.js';

// Create a new appointment
export const createAppointment = async (req, res) => {
  const {
    branch, branchId,
    service, serviceId,
    date, appointmentDate,
    timeSlot,
    priority, priorityCategory
  } = req.body;

  const actualBranch = branch || branchId;
  const actualService = service || serviceId;
  const rawDate = date || appointmentDate;
  const actualPriority = priority || priorityCategory || 'regular';

  try {
    const apptDateParsed = new Date(rawDate);
    apptDateParsed.setHours(0, 0, 0, 0);

    // Limit capacity: Check how many bookings already exist for this slot
    const existingBookingsCount = await Appointment.countDocuments({
      branch: actualBranch,
      service: actualService,
      date: apptDateParsed,
      timeSlot,
      status: { $ne: 'cancelled' },
    });

    // Limit to 3 appointments per 30-minute time slot per service
    if (existingBookingsCount >= 3) {
      return res.status(400).json({
        status: 'error',
        message: 'This time slot is fully booked. Please choose another time or day.',
      });
    }

    // Generate unique appointment ID
    const appointmentId = 'APT-' + Math.floor(100000 + Math.random() * 900000);

    const appointment = await Appointment.create({
      customer: req.user._id,
      branch: actualBranch,
      service: actualService,
      date: apptDateParsed,
      appointmentDate: apptDateParsed,
      timeSlot,
      priorityCategory: actualPriority,
      priority: actualPriority,
      appointmentId,
    });

    // Send Confirmation Notification in background
    Appointment.findById(appointment._id)
      .populate('branch')
      .populate('service')
      .then((popAppt) => {
        if (popAppt) sendAppointmentConfirmation(popAppt, req.user);
      })
      .catch((err) => console.error('Error sending confirmation email:', err));

    res.status(201).json({
      status: 'success',
      data: { appointment },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get logged in customer's appointments
export const getCustomerAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ customer: req.user._id })
      .populate('branch')
      .populate('service')
      .populate('token')
      .sort({ date: 1, timeSlot: 1 });

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: { appointments },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Cancel an appointment
export const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found or not authorized',
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Send Cancellation Notification in background
    Appointment.findById(appointment._id)
      .populate('branch')
      .populate('service')
      .then((popAppt) => {
        if (popAppt) sendAppointmentCancellation(popAppt, req.user);
      })
      .catch((err) => console.error('Error sending cancellation email:', err));

    res.status(200).json({
      status: 'success',
      message: 'Appointment cancelled successfully',
      data: { appointment },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Admin/Manager: List all appointments for a branch
export const getBranchAppointments = async (req, res) => {
  const { branchId } = req.params;
  const { date } = req.query;

  const filter = { branch: branchId };
  if (date) {
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    filter.date = queryDate;
  }

  try {
    const appointments = await Appointment.find(filter)
      .populate('customer', 'name email phone')
      .populate('service')
      .sort({ date: 1, timeSlot: 1 });

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: { appointments },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
