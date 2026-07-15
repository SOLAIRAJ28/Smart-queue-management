import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public/authenticated access to view services
router.get('/', getServices);
router.get('/:id', getServiceById);

// Admin-only operations
router.post('/', protect, restrictTo('admin'), createService);
router.put('/:id', protect, restrictTo('admin'), updateService);
router.delete('/:id', protect, restrictTo('admin'), deleteService);

export default router;
