import express from 'express';
import {
  getCounters,
  getCounterById,
  createCounter,
  updateCounter,
  toggleCounterStatus,
  deleteCounter,
} from '../controllers/counterController.js';
import { protect, restrictTo, optionalProtect, restrictBranch } from '../middleware/auth.js';

const router = express.Router();

// Public/authenticated access to view counters
router.get('/', optionalProtect, restrictBranch, getCounters);
router.get('/:id', getCounterById);

// Admin-only creation and deletion
router.post('/', protect, restrictTo('admin'), createCounter);
router.delete('/:id', protect, restrictTo('admin'), deleteCounter);

// Admin/Manager operations
router.put('/:id', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, updateCounter);
router.patch('/:id/toggle', protect, restrictTo('admin', 'manager', 'branch_manager'), restrictBranch, toggleCounterStatus);

export default router;
