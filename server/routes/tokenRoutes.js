import express from 'express';
import {
  createToken,
  getTokenById,
  getActiveBranchQueue,
  getCustomerActiveToken,
  getCustomerTokensHistory,
} from '../controllers/tokenController.js';
import { protect, optionalProtect, restrictBranch } from '../middleware/auth.js';

const router = express.Router();

// General token routes
router.post('/', optionalProtect, createToken);
router.get('/my-active', protect, getCustomerActiveToken);
router.get('/my-history', protect, getCustomerTokensHistory);
router.get('/:id', getTokenById);
router.get('/branch/:branchId', optionalProtect, restrictBranch, getActiveBranchQueue);

export default router;
