import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';

// 1. Get all audit logs (Admin only)
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .populate('actor', 'name email role')
      .sort({ timestamp: -1 });

    res.status(200).json({
      status: 'success',
      results: logs.length,
      data: { logs },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// 2. Validate cryptographic blockchain integrity of the audit ledger
export const verifyLedgerIntegrity = async (req, res) => {
  try {
    // Fetch logs in chronological order (oldest to newest) to verify sequentially
    const logs = await AuditLog.find({}).sort({ timestamp: 1, _id: 1 });

    let expectedPrevHash = 'GENESIS_HASH';
    const failures = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // 1. Verify block link
      if (log.previousHash !== expectedPrevHash) {
        failures.push({
          logId: log._id,
          action: log.action,
          timestamp: log.timestamp,
          reason: `Cryptographic link broken. Expected prevHash: ${expectedPrevHash}, found: ${log.previousHash}`,
        });
      }

      // 2. Recalculate block hash to check for tampering
      const blockString = [
        log.actor ? log.actor.toString() : 'ANONYMOUS',
        log.action,
        log.description,
        log.ipAddress || '0.0.0.0',
        log.userAgent || 'UNKNOWN',
        new Date(log.timestamp).toISOString(),
        log.previousHash
      ].join('|');

      const computedHash = crypto
        .createHash('sha256')
        .update(blockString)
        .digest('hex');

      if (log.hash !== computedHash) {
        failures.push({
          logId: log._id,
          action: log.action,
          timestamp: log.timestamp,
          reason: `Payload tampered. DB stored hash: ${log.hash}, but calculated: ${computedHash}`,
        });
      }

      // Update expected hash for next iteration
      expectedPrevHash = log.hash;
    }

    const isSecure = failures.length === 0;

    res.status(200).json({
      status: 'success',
      data: {
        isSecure,
        totalChecked: logs.length,
        violationsFound: failures.length,
        failures,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
