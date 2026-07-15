import express from 'express';
import { submitFeedback, getBranchFeedback, getStaffFeedback } from '../controllers/feedbackController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Customer submits feedback for a completed service
router.post('/', protect, submitFeedback);

// Staff member views their own rating/feedback history
router.get('/my-feedback', protect, restrictTo('staff', 'counter_staff'), getStaffFeedback);

// Manager/Admin views branch feedback reports
router.get('/branch/:branchId', protect, restrictTo('admin', 'manager'), getBranchFeedback);

export default router;
