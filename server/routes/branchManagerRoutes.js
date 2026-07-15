import express from 'express';
import {
  getBranchManagerByBranch,
  createBranchManager,
  updateBranchManager,
  deleteBranchManager,
} from '../controllers/branchManagerController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Apply protect & admin restriction globally to these routes
router.use(protect);
router.use(restrictTo('admin'));

router.get('/branch/:branchId', getBranchManagerByBranch);
router.post('/', createBranchManager);
router.put('/:id', updateBranchManager);
router.delete('/:id', deleteBranchManager);

export default router;
