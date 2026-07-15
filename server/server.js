import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import counterRoutes from './routes/counterRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import branchManagerRoutes from './routes/branchManagerRoutes.js';
import { initQueueSockets } from './sockets/queueSocket.js';
import { generalLimiter, authLimiter, sanitizeInput } from './middleware/security.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Initialize Socket.io rooms logic
initQueueSockets(io);

// Middleware
app.use(compression()); // Gzip all responses — reduces payload size ~60-80%
app.use(helmet({
  contentSecurityPolicy: false, // For easier local dev / APIs
}));
app.use(cors({
  origin: '*', // Dynamic configurations in production
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data sanitization and XSS protection
app.use(sanitizeInput);

// Rate limiting configurations
app.use('/api/auth', authLimiter); // Strict limit on auth routes
app.use('/api', generalLimiter); // General limits on APIs

// Serve uploaded files (placeholder upload folder)
app.use('/uploads', express.static('uploads'));

// Auth routes registration
app.use('/api/auth', authRoutes);

// Branch routes registration
app.use('/api/branches', branchRoutes);

// Service routes registration
app.use('/api/services', serviceRoutes);

// Counter routes registration
app.use('/api/counters', counterRoutes);

// Token routes registration
app.use('/api/tokens', tokenRoutes);

// Queue routes registration
app.use('/api/queue', queueRoutes);

// Appointment routes registration
app.use('/api/appointments', appointmentRoutes);

// Feedback routes registration
app.use('/api/feedback', feedbackRoutes);

// Audit Log routes registration
app.use('/api/audit-logs', auditLogRoutes);

// Report routes registration
app.use('/api/reports', reportRoutes);

// Customer operations registration
app.use('/api/customer', customerRoutes);

// Staff operations registration
app.use('/api/staff', staffRoutes);

// Admin operations registration
app.use('/api/admin', adminRoutes);

// Branch Manager operations registration
app.use('/api/branch-managers', branchManagerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Smart Queue Management API is operational',
    timestamp: new Date(),
  });
});

// Store io in app state for controllers to access
app.set('io', io);

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

export { app, httpServer, io };
