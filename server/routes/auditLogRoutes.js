import express from 'express';
import { getAuditLogs, verifyLedgerIntegrity } from '../controllers/auditLogController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Enforce admin-only access on all ledger checks
router.use(protect, restrictTo('admin'));

router.get('/', getAuditLogs);
router.get('/verify', verifyLedgerIntegrity);

export default router;
