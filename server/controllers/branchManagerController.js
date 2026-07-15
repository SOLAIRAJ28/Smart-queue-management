import BranchManager from '../models/BranchManager.js';
import Branch from '../models/Branch.js';
import { logAction } from '../utils/auditLogger.js';

// Get branch manager by branchId
export const getBranchManagerByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const manager = await BranchManager.findOne({ branchId }).select('-password');
    
    res.status(200).json({
      status: 'success',
      data: manager,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Create a new Branch Manager
export const createBranchManager = async (req, res) => {
  try {
    const { branchId, managerName, email, password, confirmPassword, phone, status } = req.body;

    // Validations
    if (!managerName || !managerName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Manager name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ status: 'error', message: 'Email address is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }
    if (!password) {
      return res.status(400).json({ status: 'error', message: 'Password is required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters long' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ status: 'error', message: 'Passwords do not match' });
    }

    const emailNormalized = email.toLowerCase().trim();

    // Check if email already exists
    const emailExists = await BranchManager.findOne({ email: emailNormalized });
    if (emailExists) {
      return res.status(400).json({ status: 'error', message: 'A branch manager with this email already exists' });
    }

    // Check if branch already has a manager assigned
    const managerExists = await BranchManager.findOne({ branchId });
    if (managerExists) {
      return res.status(400).json({ status: 'error', message: 'This branch already has an assigned manager' });
    }

    const newManager = await BranchManager.create({
      branchId,
      managerName,
      email: emailNormalized,
      password,
      phone,
      status: status || 'Enabled',
    });

    const branch = await Branch.findById(branchId);
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_MANAGER_CREATE',
      description: `Assigned Branch Manager ${managerName} to branch ${branch ? branch.name : branchId}`,
      req,
    });

    const managerObj = newManager.toObject();
    delete managerObj.password;

    res.status(201).json({
      status: 'success',
      message: 'Branch Manager created successfully.',
      data: managerObj,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Update an existing Branch Manager
export const updateBranchManager = async (req, res) => {
  try {
    const { managerName, email, phone, status, password, confirmPassword } = req.body;
    const { id } = req.params;

    const manager = await BranchManager.findById(id);
    if (!manager) {
      return res.status(404).json({ status: 'error', message: 'Branch Manager not found' });
    }

    // Validations
    if (managerName && !managerName.trim()) {
      return res.status(400).json({ status: 'error', message: 'Manager name is required' });
    }
    if (email && !email.trim()) {
      return res.status(400).json({ status: 'error', message: 'Email address is required' });
    }
    if (phone && !phone.trim()) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }

    if (password && password.trim() !== '') {
      if (password.length < 8) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters long' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ status: 'error', message: 'Passwords do not match' });
      }
      manager.password = password;
    }

    if (email && email.toLowerCase().trim() !== manager.email) {
      const emailNormalized = email.toLowerCase().trim();
      const emailExists = await BranchManager.findOne({ email: emailNormalized });
      if (emailExists) {
        return res.status(400).json({ status: 'error', message: 'Email address is already taken' });
      }
      manager.email = emailNormalized;
    }

    if (managerName) manager.managerName = managerName;
    if (phone) manager.phone = phone;
    if (status) manager.status = status;

    await manager.save();

    const branch = await Branch.findById(manager.branchId);
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_MANAGER_UPDATE',
      description: `Updated Branch Manager details for branch ${branch ? branch.name : manager.branchId}`,
      req,
    });

    const managerObj = manager.toObject();
    delete managerObj.password;

    res.status(200).json({
      status: 'success',
      message: 'Branch Manager updated successfully.',
      data: managerObj,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Delete a Branch Manager
export const deleteBranchManager = async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await BranchManager.findById(id);
    if (!manager) {
      return res.status(404).json({ status: 'error', message: 'Branch Manager not found' });
    }

    await BranchManager.findByIdAndDelete(id);

    const branch = await Branch.findById(manager.branchId);
    await logAction({
      actor: req.user._id,
      action: 'BRANCH_MANAGER_DELETE',
      description: `Deleted Branch Manager for branch ${branch ? branch.name : manager.branchId}`,
      req,
    });

    res.status(200).json({
      status: 'success',
      message: 'Branch Manager account deleted successfully.',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
