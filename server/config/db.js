import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Service from '../models/Service.js';
import Counter from '../models/Counter.js';
import Staff from '../models/Staff.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto-migrate legacy pending/approved appointments to scheduled
    await Appointment.updateMany(
      { status: { $in: ['pending', 'approved'] } },
      { status: 'scheduled' }
    );

    // Auto-seed: If no admin user exists, seed essential data
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log('🌱 No admin found — auto-seeding essential data...');

      // 1. Create Branches
      const branches = await Branch.insertMany([
        {
          name: 'Main Banking Square Branch',
          code: 'MAIN',
          address: '100 Financial Way, Banking District',
          contact: '123-456-7890',
          workingHours: { open: '09:00', close: '17:00' },
          isActive: true
        },
        {
          name: 'North Plaza Hub Branch',
          code: 'NPLZ',
          address: '400 North Plaza Boulevard',
          contact: '987-654-3210',
          workingHours: { open: '09:00', close: '17:00' },
          isActive: true
        }
      ]);
      console.log(`  🏢 Seeded ${branches.length} branches.`);

      // 2. Create Services
      const services = await Service.insertMany([
        { name: 'Teller & Cash Deposits', code: 'DEPOSITS', description: 'Deposits, withdrawals, and currency exchange.', avgServingTime: 10, prefix: 'DP', isActive: true },
        { name: 'Personal & Business Loans', code: 'LOANS', description: 'Loan requests, credit consulting, and mortgage.', avgServingTime: 25, prefix: 'LN', isActive: true },
        { name: 'Client Support & Inquiries', code: 'SUPPORT', description: 'Card issues, account closures, and inquiries.', avgServingTime: 15, prefix: 'CS', isActive: true }
      ]);
      console.log(`  ⚙️ Seeded ${services.length} services.`);

      // 3. Create Users
      const adminUser = await User.create({ name: 'System Admin', email: 'admin@apexbank.com', password: 'admin123', phone: '555-0101', role: 'admin', isVerified: true });
      const managerUser = await User.create({ name: 'Lobby Manager', email: 'manager@apexbank.com', password: 'manager123', phone: '555-0102', role: 'manager', isVerified: true });

      const staffUserJane = await User.create({ name: 'Teller Jane', email: 'jane@apexbank.com', password: 'staff123', phone: '555-0103', role: 'staff', isVerified: true });
      const staffUserJohn = await User.create({ name: 'Teller John', email: 'john@apexbank.com', password: 'staff123', phone: '555-0104', role: 'staff', isVerified: true });
      const staffUserSupport = await User.create({ name: 'Teller Support', email: 'support@apexbank.com', password: 'staff123', phone: '555-0107', role: 'staff', isVerified: true });

      const customerUser = await User.create({ name: 'Joe Customer', email: 'customer@apexbank.com', password: 'customer123', phone: '555-0105', role: 'customer', isVerified: true });
      console.log('  👤 Seeded users (Admin, Manager, Staff, Customer).');

      // 4. Create Staff Profiles & Counters
      const mainBranch = branches[0];
      const staffJane = await Staff.create({ user: staffUserJane._id, branch: mainBranch._id, services: [services[0]._id], status: 'active' });
      const staffJohn = await Staff.create({ user: staffUserJohn._id, branch: mainBranch._id, services: [services[1]._id], status: 'active' });
      const staffSupport = await Staff.create({ user: staffUserSupport._id, branch: mainBranch._id, services: [services[2]._id], status: 'active' });

      const c1 = await Counter.create({ number: 1, branch: mainBranch._id, currentStaff: staffJane._id, currentService: services[0]._id, status: 'enabled' });
      const c2 = await Counter.create({ number: 2, branch: mainBranch._id, currentStaff: staffJohn._id, currentService: services[1]._id, status: 'enabled' });
      const c3 = await Counter.create({ number: 3, branch: mainBranch._id, currentStaff: staffSupport._id, currentService: services[2]._id, status: 'enabled' });

      staffJane.counter = c1._id; await staffJane.save();
      staffJohn.counter = c2._id; await staffJohn.save();
      staffSupport.counter = c3._id; await staffSupport.save();

      console.log('  🎛️ Seeded counters & staff profiles.');
      console.log('✅ AUTO-SEED COMPLETED. You can now log in.');
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
