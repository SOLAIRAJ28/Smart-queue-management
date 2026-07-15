import AuditLog from '../models/AuditLog.js';

/**
 * Log a system action into the cryptographic audit trail ledger.
 * 
 * @param {Object} params
 * @param {String} params.actor - User ObjectId
 * @param {String} params.action - Name of the action (e.g. 'USER_LOGIN', 'BRANCH_CREATE')
 * @param {String} params.description - Detailed description of the action
 * @param {Object} [params.req] - Express request object to capture IP & User-Agent
 */
export const logAction = async ({ actor, action, description, req }) => {
  try {
    let ipAddress = '0.0.0.0';
    let userAgent = 'UNKNOWN';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      // Normalize IPv6 localhost
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
      }
      userAgent = req.headers['user-agent'] || 'UNKNOWN';
    }

    const logEntry = await AuditLog.create({
      actor,
      action,
      description,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    console.log(`[Audit Trail] Logged: ${action} - ${description} (Hash: ${logEntry.hash.substring(0, 8)}...)`);
    return logEntry;
  } catch (error) {
    console.error('[Audit Trail Error] Failed to write audit log:', error.message);
  }
};
