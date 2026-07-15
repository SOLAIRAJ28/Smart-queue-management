import express from 'express';
import {
  getCustomerHistory,
  getCustomerProfile,
  getCustomerTokens,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/customerController.js';
import { getCustomerAppointments, createAppointment } from '../controllers/appointmentController.js';
import { createToken } from '../controllers/tokenController.js';
import {
  getPendingSwaps,
  getEligibleTokens,
  requestSwap,
  respondToSwap,
  cancelSwap,
  getSwapHistory
} from '../controllers/swapController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('customer'));

router.get('/history', getCustomerHistory);
router.get('/profile', getCustomerProfile);
router.get('/tokens', getCustomerTokens);
router.get('/appointments', getCustomerAppointments);

router.post('/token', createToken);
router.post('/appointment', createAppointment);

// Lobby Swaps
router.get('/swaps/pending', getPendingSwaps);
router.get('/swaps/eligible/:tokenId', getEligibleTokens);
router.get('/swaps/history', getSwapHistory);
router.post('/swaps/request', requestSwap);
router.post('/swaps/respond', respondToSwap);
router.post('/swaps/cancel', cancelSwap);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
