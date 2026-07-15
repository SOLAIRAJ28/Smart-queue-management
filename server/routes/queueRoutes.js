import express from 'express';
import {
  callNext,
  startServe,
  skipToken,
  recallToken,
  completeService,
  transferToken,
} from '../controllers/queueController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Apply auth protection & staff restriction to all queue action endpoints
router.use(protect, restrictTo('staff', 'counter_staff', 'admin'));

router.post('/call-next', callNext);
router.post('/start-serve', startServe);
router.post('/skip', skipToken);
router.post('/recall', recallToken);
router.post('/complete', completeService);
router.post('/transfer', transferToken);

export default router;
