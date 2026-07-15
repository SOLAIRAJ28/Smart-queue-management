import express from 'express';
import {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  toggleBranchStatus,
  deleteBranch,
  getBranchAnalytics,
  getBranchPerformanceAnalytics,
  getBulkBranchAnalytics,
  getBranchCrowdForecast,
} from '../controllers/branchController.js';
import { protect, restrictTo, optionalProtect, restrictBranch } from '../middleware/auth.js';

const router = express.Router();

// Public/authenticated access to view branches
router.get('/', getBranches);
router.get('/regional/comparison', protect, restrictTo('admin'), getBulkBranchAnalytics);
router.get('/:id', optionalProtect, restrictBranch, getBranchById);
router.get('/:id/analytics', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, getBranchAnalytics);
router.get('/:id/performance-analytics', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, getBranchPerformanceAnalytics);
router.get('/:id/crowd-forecast', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, getBranchCrowdForecast);

// Admin-only operations
router.post('/', protect, restrictTo('admin'), createBranch);
router.put('/:id', protect, restrictTo('admin'), updateBranch);
router.patch('/:id/toggle', protect, restrictTo('admin'), toggleBranchStatus);
router.delete('/:id', protect, restrictTo('admin'), deleteBranch);

export default router;
