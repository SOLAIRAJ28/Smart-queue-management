import express from 'express';
import {
  getAllCustomers,
  getCustomerById,
  getCustomerHistoryAdmin
} from '../controllers/adminCustomerController.js';
import { toggleServiceStatus } from '../controllers/serviceController.js';
import {
  getCounterStaffByCounter,
  createCounterStaff,
  updateCounterStaff,
  resetCounterStaffPassword,
  updateCounterStaffStatus,
  deleteCounterStaff
} from '../controllers/counterStaffController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/customers', getAllCustomers);
router.get('/customer/:id', getCustomerById);
router.get('/customer-history/:id', getCustomerHistoryAdmin);

router.patch('/services/:id/status', toggleServiceStatus);

// Counter Staff Routes
router.get('/counter-staff/:counterId', getCounterStaffByCounter);
router.post('/counter-staff', createCounterStaff);
router.put('/counter-staff/:id', updateCounterStaff);
router.patch('/counter-staff/:id/password', resetCounterStaffPassword);
router.patch('/counter-staff/:id/reset-password', resetCounterStaffPassword);
router.patch('/counter-staff/:id/status', updateCounterStaffStatus);
router.delete('/counter-staff/:id', deleteCounterStaff);

export default router;
