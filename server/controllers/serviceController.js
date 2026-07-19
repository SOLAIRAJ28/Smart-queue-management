import Service from '../models/Service.js';
import Counter from '../models/Counter.js';

// Get all services
export const getServices = async (req, res) => {
  try {
    const services = await Service.find();
    res.status(200).json({
      status: 'success',
      results: services.length,
      data: { services },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Get a single service by ID
export const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
      });
    }
    res.status(200).json({
      status: 'success',
      data: { service },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Create a new service (Admin only)
export const createService = async (req, res) => {
  const { name, code, description, avgServingTime, prefix } = req.body;

  try {
    // Check if service code is already registered
    const codeExists = await Service.findOne({ code: code.toUpperCase() });
    if (codeExists) {
      return res.status(400).json({
        status: 'error',
        message: `Service with code ${code.toUpperCase()} already exists`,
      });
    }

    const service = await Service.create({
      name,
      code,
      description,
      avgServingTime,
      prefix,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('service_updated', { action: 'create', service });
    }

    res.status(201).json({
      status: 'success',
      data: { service },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Update an existing service (Admin only)
export const updateService = async (req, res) => {
  try {
    const originalService = await Service.findById(req.params.id);
    if (!originalService) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
      });
    }

    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('service_updated', { action: 'update', service });
    }

    // Sync counters if isActive status was updated
    if (req.body.isActive !== undefined && originalService.isActive !== service.isActive) {
      const counters = await Counter.find({ currentService: service._id });
      for (const counter of counters) {
        counter.status = service.isActive ? 'enabled' : 'disabled';
        await counter.save();
        if (io && counter.branch) {
          io.to(counter.branch.toString()).emit('counterStatusChanged', { counter });
          io.to(counter.branch.toString()).emit('queue_updated', { action: 'counterStatusChanged', counter });
        }
      }
    }

    res.status(200).json({
      status: 'success',
      data: { service },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Delete a service (Admin only)
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('service_updated', { action: 'delete', id: req.params.id });
    }

    res.status(200).json({
      status: 'success',
      message: 'Service deleted successfully',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// Toggle service status (Admin only)
export const toggleServiceStatus = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
      });
    }

    service.isActive = !service.isActive;
    await service.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('service_updated', { action: 'toggle', service });
    }

    // Sync counters with service status change
    const counters = await Counter.find({ currentService: service._id });
    for (const counter of counters) {
      counter.status = service.isActive ? 'enabled' : 'disabled';
      await counter.save();
      if (io && counter.branch) {
        io.to(counter.branch.toString()).emit('counterStatusChanged', { counter });
        io.to(counter.branch.toString()).emit('queue_updated', { action: 'counterStatusChanged', counter });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Service status updated successfully',
      data: { service },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

