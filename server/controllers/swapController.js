import SwapRequest from '../models/SwapRequest.js';
import Token from '../models/Token.js';
import Service from '../models/Service.js';
import Counter from '../models/Counter.js';
import Notification from '../models/Notification.js';
import { userSockets } from '../sockets/userSockets.js';
import { logAction } from '../utils/auditLogger.js';
import { predictWaitingTime } from '../utils/aiPredictor.js';

// GET /api/customer/swaps/pending
export const getPendingSwaps = async (req, res) => {
  try {
    const customerId = req.user._id;

    // Find all Pending swap requests involving this customer
    const swapRequests = await SwapRequest.find({
      status: 'Pending',
      $or: [{ senderCustomer: customerId }, { receiverCustomer: customerId }],
    })
      .populate('senderCustomer', 'name fullName mobileNumber')
      .populate('receiverCustomer', 'name fullName mobileNumber')
      .populate({
        path: 'senderToken',
        populate: [{ path: 'service' }, { path: 'branch' }]
      })
      .populate({
        path: 'receiverToken',
        populate: [{ path: 'service' }, { path: 'branch' }]
      })
      .sort({ createdAt: -1 });

    const activeSwapRequests = [];
    const io = req.app.get('io');
    for (const request of swapRequests) {
      if (
        !request.senderToken ||
        request.senderToken.status !== 'waiting' ||
        !request.receiverToken ||
        request.receiverToken.status !== 'waiting'
      ) {
        // One of the tokens is no longer waiting, mark as Cancelled
        request.status = 'Cancelled';
        request.cancelledReason = 'Queue has progressed.';
        request.respondedAt = new Date();
        await request.save();

        if (io) {
          const branchId = request.branch ? request.branch.toString() : '';
          io.to(branchId).emit('queue_updated', {
            action: 'swapCancelled',
            requestId: request._id
          });
        }
      } else {
        // Calculate dynamic queue positions
        const senderQueuePosition = await Token.countDocuments({
          branch: request.senderToken.branch._id,
          service: request.senderToken.service._id,
          status: 'waiting',
          arrivalTime: { $lte: request.senderToken.arrivalTime }
        });
        const receiverQueuePosition = await Token.countDocuments({
          branch: request.receiverToken.branch._id,
          service: request.receiverToken.service._id,
          status: 'waiting',
          arrivalTime: { $lte: request.receiverToken.arrivalTime }
        });

        const reqObj = request.toObject();
        reqObj.senderQueuePosition = senderQueuePosition;
        reqObj.receiverQueuePosition = receiverQueuePosition;

        activeSwapRequests.push(reqObj);
      }
    }

    res.status(200).json({
      status: 'success',
      results: activeSwapRequests.length,
      data: { swapRequests: activeSwapRequests },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// GET /api/customer/swaps/eligible/:tokenId
export const getEligibleTokens = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const customerId = req.user._id;

    const currentToken = await Token.findById(tokenId);
    if (!currentToken) {
      return res.status(404).json({
        status: 'error',
        message: 'Token not found.',
      });
    }

    if (currentToken.status !== 'waiting') {
      return res.status(400).json({
        status: 'error',
        message: 'Only waiting tokens can be swapped.',
      });
    }

    // Find other waiting tokens in the same branch and service (excluding own)
    const query = {
      branch: currentToken.branch,
      service: currentToken.service,
      status: 'waiting',
      customer: { $ne: customerId },
    };

    const eligibleTokens = await Token.find(query)
      .populate('customer', 'name fullName')
      .sort({ arrivalTime: 1 });

    res.status(200).json({
      status: 'success',
      results: eligibleTokens.length,
      data: { tokens: eligibleTokens },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// POST /api/customer/swaps/request
export const requestSwap = async (req, res) => {
  try {
    const { initiatorTokenId, recipientTokenId, senderTokenId, receiverTokenId, reason } = req.body;
    const customerId = req.user._id;

    const finalSenderTokenId = senderTokenId || initiatorTokenId;
    const finalReceiverTokenId = receiverTokenId || recipientTokenId;

    if (!finalSenderTokenId || !finalReceiverTokenId) {
      return res.status(400).json({
        status: 'error',
        message: 'Sender and receiver token IDs are required.',
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'A reason for swapping is required.',
      });
    }

    // Load sender token
    const senderToken = await Token.findById(finalSenderTokenId);
    if (!senderToken || senderToken.customer.toString() !== customerId.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid sender token.',
      });
    }

    if (senderToken.status !== 'waiting') {
      return res.status(400).json({
        status: 'error',
        message: 'Your token must be waiting to request a swap.',
      });
    }

    // Load receiver token
    const receiverToken = await Token.findById(finalReceiverTokenId);
    if (!receiverToken) {
      return res.status(404).json({
        status: 'error',
        message: 'Receiver token not found.',
      });
    }

    if (receiverToken.status !== 'waiting') {
      return res.status(400).json({
        status: 'error',
        message: 'The target token is no longer waiting and cannot be swapped.',
      });
    }

    // Validate branch and service matching
    if (
      senderToken.branch.toString() !== receiverToken.branch.toString() ||
      senderToken.service.toString() !== receiverToken.service.toString()
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Tokens must belong to the same branch and service to swap.',
      });
    }

    if (senderToken.customer.toString() === receiverToken.customer.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot swap a token with yourself.',
      });
    }

    // (Online check bypassed: swap requests can be sent even if the target is offline)

    // Check for duplicate pending request between the same two tokens
    const existingPending = await SwapRequest.findOne({
      status: 'Pending',
      senderToken: finalSenderTokenId,
      receiverToken: finalReceiverTokenId,
    });

    if (existingPending) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already proposed a swap request to this customer.',
      });
    }

    // Calculate queue positions
    const senderQueuePosition = await Token.countDocuments({
      branch: senderToken.branch,
      service: senderToken.service,
      status: 'waiting',
      arrivalTime: { $lte: senderToken.arrivalTime }
    });

    const receiverQueuePosition = await Token.countDocuments({
      branch: receiverToken.branch,
      service: receiverToken.service,
      status: 'waiting',
      arrivalTime: { $lte: receiverToken.arrivalTime }
    });

    // Create Swap Request in DB
    const newSwap = await SwapRequest.create({
      senderCustomer: customerId,
      receiverCustomer: receiverToken.customer,
      senderToken: finalSenderTokenId,
      receiverToken: finalReceiverTokenId,
      senderQueuePosition,
      receiverQueuePosition,
      branch: senderToken.branch,
      service: senderToken.service,
      reason: reason.trim(),
      status: 'Pending',
    });

    // Create in-app notification for receiver
    await Notification.create({
      recipient: receiverToken.customer,
      type: 'in-app',
      title: 'Token Swap Request',
      message: `Customer ${req.user.fullName || req.user.name} (Token ${senderToken.tokenNumber}) wants to swap with your token ${receiverToken.tokenNumber}. Reason: "${reason.trim()}"`,
    });

    // Log to Audit Ledger
    await logAction({
      actor: customerId,
      action: 'Swap Requested',
      description: `Swap requested by customer from Token ${senderToken.tokenNumber} to Token ${receiverToken.tokenNumber}.`,
      req,
    });

    // Emit live updates
    const io = req.app.get('io');
    if (io) {
      const branchStr = senderToken.branch.toString();
      io.to(branchStr).emit('swapRequested', {
        swap: newSwap,
        senderName: req.user.fullName || req.user.name,
        senderTokenNumber: senderToken.tokenNumber,
        receiverTokenNumber: receiverToken.tokenNumber,
      });
      io.to(branchStr).emit('queue_updated', {
        action: 'swapRequested',
        swapId: newSwap._id,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { swapRequest: newSwap },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// POST /api/customer/swaps/respond
export const respondToSwap = async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: 'accept' or 'decline' / 'reject'
    const customerId = req.user._id;

    if (!requestId || !action) {
      return res.status(400).json({
        status: 'error',
        message: 'Request ID and action are required.',
      });
    }

    // Fetch Swap Request
    const swapReq = await SwapRequest.findById(requestId);
    if (!swapReq || swapReq.receiverCustomer.toString() !== customerId.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Swap request not found or not assigned to you.',
      });
    }

    if (swapReq.status !== 'Pending') {
      return res.status(400).json({
        status: 'error',
        message: 'This swap request is no longer pending.',
      });
    }

    const io = req.app.get('io');
    const branchStr = swapReq.branch.toString();

    // Handle Decline/Reject
    if (action === 'decline' || action === 'reject' || action === 'Reject') {
      swapReq.status = 'Rejected';
      swapReq.respondedAt = new Date();
      await swapReq.save();

      // Notify sender
      await Notification.create({
        recipient: swapReq.senderCustomer,
        type: 'in-app',
        title: 'Swap Request Rejected',
        message: 'Your token swap request has been rejected.',
      });

      // Audit Log
      await logAction({
        actor: customerId,
        action: 'Swap Rejected',
        description: `Swap request ${requestId} was rejected by receiver.`,
        req,
      });

      // Broadcast Socket
      if (io) {
        io.to(branchStr).emit('swapRejected', {
          requestId,
          message: 'Your token swap request has been rejected.',
          senderCustomer: swapReq.senderCustomer,
        });
        io.to(branchStr).emit('queue_updated', { action: 'swapRejected', requestId });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Swap request rejected successfully.',
      });
    }

    // Handle Accept
    const senderToken = await Token.findById(swapReq.senderToken);
    const receiverToken = await Token.findById(swapReq.receiverToken);

    if (!senderToken || !receiverToken) {
      swapReq.status = 'Cancelled';
      swapReq.cancelledReason = 'Queue has progressed.';
      swapReq.respondedAt = new Date();
      await swapReq.save();
      return res.status(404).json({
        status: 'error',
        message: 'One of the tokens involved in the swap could not be found.',
      });
    }

    if (senderToken.status !== 'waiting' || receiverToken.status !== 'waiting') {
      swapReq.status = 'Cancelled';
      swapReq.cancelledReason = 'Queue has progressed.';
      swapReq.respondedAt = new Date();
      await swapReq.save();
      return res.status(400).json({
        status: 'error',
        message: 'One of the tokens is no longer waiting. Swap cancelled.',
      });
    }

    // Atomically swap customer reference field
    const tempCustomer = senderToken.customer;
    senderToken.customer = receiverToken.customer;
    receiverToken.customer = tempCustomer;

    await senderToken.save();
    await receiverToken.save();

    // Set request status to Accepted
    swapReq.status = 'Accepted';
    swapReq.respondedAt = new Date();
    await swapReq.save();

    // Cancel all other pending swap requests involving either token
    const otherPendingRequests = await SwapRequest.find({
      _id: { $ne: swapReq._id },
      status: 'Pending',
      $or: [
        { senderToken: swapReq.senderToken },
        { receiverToken: swapReq.senderToken },
        { senderToken: swapReq.receiverToken },
        { receiverToken: swapReq.receiverToken },
      ],
    }).populate('senderCustomer receiverCustomer');

    if (otherPendingRequests.length > 0) {
      await SwapRequest.updateMany(
        {
          _id: { $in: otherPendingRequests.map((r) => r._id) },
        },
        {
          status: 'Cancelled',
          cancelledReason: 'Other swap request accepted',
          respondedAt: new Date(),
        }
      );

      for (const reqObj of otherPendingRequests) {
        // Create in-app notifications
        if (reqObj.senderCustomer) {
          await Notification.create({
            recipient: reqObj.senderCustomer._id,
            type: 'in-app',
            title: 'Swap Request Cancelled',
            message: 'Swap request cancelled because another swap request was accepted.',
          });
        }
        if (reqObj.receiverCustomer) {
          await Notification.create({
            recipient: reqObj.receiverCustomer._id,
            type: 'in-app',
            title: 'Swap Request Cancelled',
            message: 'Swap request cancelled because another swap request was accepted.',
          });
        }

        // Log audit
        await logAction({
          actor: customerId,
          action: 'Swap Cancelled',
          description: `Swap request ${reqObj._id} was cancelled because another swap request was accepted.`,
        });

        // Emit swapCancelled socket event
        if (io) {
          io.to(branchStr).emit('swapCancelled', {
            requestId: reqObj._id.toString(),
            reason: 'Swap request cancelled because another swap request was accepted.',
            senderCustomer: reqObj.senderCustomer ? reqObj.senderCustomer._id.toString() : null,
            receiverCustomer: reqObj.receiverCustomer ? reqObj.receiverCustomer._id.toString() : null,
          });
          io.to(branchStr).emit('queue_updated', {
            action: 'swapCancelled',
            requestId: reqObj._id.toString()
          });
        }
      }
    }

    // Notify sender of acceptance
    await Notification.create({
      recipient: swapReq.senderCustomer,
      type: 'in-app',
      title: 'Swap Request Accepted',
      message: 'Token Swap Completed Successfully.',
    });

    // Audit Log
    await logAction({
      actor: customerId,
      action: 'Swap Accepted',
      description: `Swap request ${requestId} was accepted. Token ${senderToken.tokenNumber} and Token ${receiverToken.tokenNumber} customer ownerships swapped.`,
      req,
    });

    // Recalculate AI Waiting Times & Broadcast to refresh all dashboards
    if (io) {
      io.to(branchStr).emit('swapAccepted', {
        requestId,
        senderTokenId: senderToken._id,
        receiverTokenId: receiverToken._id,
        senderTokenNumber: senderToken.tokenNumber,
        receiverTokenNumber: receiverToken.tokenNumber,
      });
      io.to(branchStr).emit('queue_updated', {
        action: 'swapAccepted',
        senderTokenId: senderToken._id,
        receiverTokenId: receiverToken._id,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Token Swap Completed Successfully.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// POST /api/customer/swaps/cancel
export const cancelSwap = async (req, res) => {
  try {
    const { requestId } = req.body;
    const customerId = req.user._id;

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'Request ID is required.',
      });
    }

    const swapReq = await SwapRequest.findById(requestId);
    if (!swapReq || swapReq.senderCustomer.toString() !== customerId.toString()) {
      return res.status(404).json({
        status: 'error',
        message: 'Swap request not found.',
      });
    }

    if (swapReq.status !== 'Pending') {
      return res.status(400).json({
        status: 'error',
        message: 'This swap request is no longer pending.',
      });
    }

    swapReq.status = 'Cancelled';
    swapReq.cancelledReason = 'Cancelled by sender';
    swapReq.respondedAt = new Date();
    await swapReq.save();

    // Audit Log
    await logAction({
      actor: customerId,
      action: 'Swap Cancelled',
      description: `Swap request ${requestId} was cancelled by sender.`,
      req,
    });

    const io = req.app.get('io');
    if (io) {
      const branchStr = swapReq.branch.toString();
      io.to(branchStr).emit('swapCancelled', { requestId });
      io.to(branchStr).emit('queue_updated', { action: 'swapCancelled', requestId });
    }

    res.status(200).json({
      status: 'success',
      message: 'Swap request cancelled successfully.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Automatic Cancellation triggered on Queue Progression (e.g. Call, Serve, Complete, Skip, Transfer)
export const autoCancelSwapsForToken = async (tokenId, reason, io) => {
  try {
    const pendingSwaps = await SwapRequest.find({
      status: 'Pending',
      $or: [
        { senderToken: tokenId },
        { receiverToken: tokenId }
      ]
    }).populate('senderCustomer receiverCustomer senderToken receiverToken');

    if (pendingSwaps.length === 0) return;

    // Update status to Cancelled
    await SwapRequest.updateMany(
      {
        status: 'Pending',
        $or: [
          { senderToken: tokenId },
          { receiverToken: tokenId }
        ]
      },
      {
        status: 'Cancelled',
        cancelledReason: reason,
        respondedAt: new Date()
      }
    );

    for (const swap of pendingSwaps) {
      const auditAction = reason === 'Queue has progressed.'
        ? 'Cancelled Because Service Started'
        : 'Swap Cancelled';

      // Log Audit Entry
      await logAction({
        actor: swap.senderCustomer._id,
        action: auditAction,
        description: `Swap request cancelled: ${reason}. Tokens: ${swap.senderToken?.tokenNumber} and ${swap.receiverToken?.tokenNumber}`,
      });

      // Send in-app notification to initiator
      await Notification.create({
        recipient: swap.senderCustomer._id,
        type: 'in-app',
        title: 'Swap Request Cancelled',
        message: 'Swap request cancelled because the service has already started.',
      });

      // Send in-app notification to receiver
      await Notification.create({
        recipient: swap.receiverCustomer._id,
        type: 'in-app',
        title: 'Swap Request Cancelled',
        message: 'Swap request cancelled because the service has already started.',
      });

      if (io) {
        const branchStr = swap.branch.toString();
        io.to(branchStr).emit('swapCancelled', {
          requestId: swap._id,
          reason: 'Swap request cancelled because the service has already started.',
          senderCustomer: swap.senderCustomer._id,
          receiverCustomer: swap.receiverCustomer._id,
        });
        io.to(branchStr).emit('queue_updated', {
          action: 'swapCancelled',
          requestId: swap._id
        });
      }
    }
  } catch (error) {
    console.error('[autoCancelSwapsForToken Error] Failed to cancel swaps:', error);
  }
};

// GET /api/customer/swaps/history
export const getSwapHistory = async (req, res) => {
  try {
    const customerId = req.user._id;

    const history = await SwapRequest.find({
      $or: [{ senderCustomer: customerId }, { receiverCustomer: customerId }],
    })
      .populate('senderCustomer', 'name fullName mobileNumber')
      .populate('receiverCustomer', 'name fullName mobileNumber')
      .populate('senderToken', 'tokenNumber')
      .populate('receiverToken', 'tokenNumber')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: 'success',
      results: history.length,
      data: { history },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
