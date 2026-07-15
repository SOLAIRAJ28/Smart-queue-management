import express from 'express';
import { generateReport } from '../controllers/reportController.js';
import { getDashboardAnalytics } from '../controllers/analyticsController.js';
import { protect, restrictTo, restrictBranch } from '../middleware/auth.js';

const router = express.Router();

// Managers and Admins can export PDF/Excel audits
router.get('/generate', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, generateReport);

// Centralized analytics dashboard stats
router.get('/analytics', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, getDashboardAnalytics);

export default router;
