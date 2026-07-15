import express from 'express';
import {
  getCustomerDetails,
  getCustomerQueueHistory,
  getCustomerTokensList,
  getCustomerStatistics
} from '../controllers/staffCustomerController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('staff', 'counter_staff'));

router.get('/customer/:id', getCustomerDetails);
router.get('/customer/:id/history', getCustomerQueueHistory);
router.get('/customer/:id/tokens', getCustomerTokensList);
router.get('/customer/:id/statistics', getCustomerStatistics);

export default router;
