import express from 'express';
import {
  createAppointment,
  getCustomerAppointments,
  cancelAppointment,
  getBranchAppointments,
} from '../controllers/appointmentController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Apply auth protection to all routes
router.use(protect);

router.post('/', createAppointment);
router.get('/my', getCustomerAppointments);
router.patch('/:id/cancel', cancelAppointment);

// Admin/Manager only
router.get('/branch/:branchId', restrictTo('admin', 'manager'), getBranchAppointments);

export default router;
