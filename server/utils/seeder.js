import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Service from '../models/Service.js';
import Counter from '../models/Counter.js';
import Staff from '../models/Staff.js';
import Token from '../models/Token.js';
import Appointment from '../models/Appointment.js';
import Feedback from '../models/Feedback.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing collection records
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Service.deleteMany({});
    await Counter.deleteMany({});
    await Staff.deleteMany({});
    await Token.deleteMany({});
    await Appointment.deleteMany({});
    await Feedback.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});
    console.log('🧹 Database collections cleared.');

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
    console.log(`🏢 Seeded ${branches.length} branches.`);
    const mainBranch = branches[0];

    // 2. Create Services
    const services = await Service.insertMany([
      {
        name: 'Teller & Cash Deposits',
        code: 'DEPOSITS',
        description: 'Deposits, withdrawals, and currency exchange services.',
        avgServingTime: 10,
        prefix: 'DP',
        isActive: true
      },
      {
        name: 'Personal & Business Loans',
        code: 'LOANS',
        description: 'Loan requests, credit consulting, and mortgage assistance.',
        avgServingTime: 25,
        prefix: 'LN',
        isActive: true
      },
      {
        name: 'Client Support & Inquiries',
        code: 'SUPPORT',
        description: 'Card issues, account closures, and general inquiries.',
        avgServingTime: 15,
        prefix: 'CS',
        isActive: true
      }
    ]);
    console.log(`⚙️ Seeded ${services.length} lobby services.`);
    const depService = services[0];
    const loanService = services[1];
    const supportService = services[2];

    // 3. Create Users
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@apexbank.com',
      password: 'admin123',
      phone: '555-0101',
      role: 'admin',
      isVerified: true
    });

    const managerUser = await User.create({
      name: 'Lobby Manager',
      email: 'manager@apexbank.com',
      password: 'manager123',
      phone: '555-0102',
      role: 'manager',
      isVerified: true
    });

    // Main Branch Staff Users
    const staffUserJane = await User.create({
      name: 'Teller Jane',
      email: 'jane@apexbank.com',
      password: 'staff123',
      phone: '555-0103',
      role: 'staff',
      isVerified: true
    });

    const staffUserJohn = await User.create({
      name: 'Teller John',
      email: 'john@apexbank.com',
      password: 'staff123',
      phone: '555-0104',
      role: 'staff',
      isVerified: true
    });

    const staffUserMainSupport = await User.create({
      name: 'Teller Main Support',
      email: 'main_support@apexbank.com',
      password: 'staff123',
      phone: '555-0107',
      role: 'staff',
      isVerified: true
    });

    // North Plaza Branch Staff Users
    const staffUserNorthDeposits = await User.create({
      name: 'Teller North Deposits',
      email: 'north_staff@apexbank.com',
      password: 'staff123',
      phone: '555-0106',
      role: 'staff',
      isVerified: true
    });

    const staffUserNorthLoans = await User.create({
      name: 'Teller North Loans',
      email: 'north_loans@apexbank.com',
      password: 'staff123',
      phone: '555-0108',
      role: 'staff',
      isVerified: true
    });

    const staffUserNorthSupport = await User.create({
      name: 'Teller North Support',
      email: 'north_support@apexbank.com',
      password: 'staff123',
      phone: '555-0109',
      role: 'staff',
      isVerified: true
    });

    const customerUser = await User.create({
      name: 'Joe Customer',
      email: 'customer@apexbank.com',
      password: 'customer123',
      phone: '555-0105',
      role: 'customer',
      isVerified: true
    });
    console.log('👤 Seeded users (Admin, Manager, Staff, Customer).');

    // 4. Create Staff Profiles
    const staffJane = await Staff.create({
      user: staffUserJane._id,
      branch: mainBranch._id,
      services: [depService._id],
      status: 'active'
    });

    const staffJohn = await Staff.create({
      user: staffUserJohn._id,
      branch: mainBranch._id,
      services: [loanService._id],
      status: 'active'
    });

    const staffMainSupport = await Staff.create({
      user: staffUserMainSupport._id,
      branch: mainBranch._id,
      services: [supportService._id],
      status: 'active'
    });

    const staffNorthDeposits = await Staff.create({
      user: staffUserNorthDeposits._id,
      branch: branches[1]._id,
      services: [depService._id],
      status: 'active'
    });

    const staffNorthLoans = await Staff.create({
      user: staffUserNorthLoans._id,
      branch: branches[1]._id,
      services: [loanService._id],
      status: 'active'
    });

    const staffNorthSupport = await Staff.create({
      user: staffUserNorthSupport._id,
      branch: branches[1]._id,
      services: [supportService._id],
      status: 'active'
    });
    console.log('💼 Seeded staff profiles.');

    // 5. Create Counters
    const counterMain1 = await Counter.create({
      number: 1,
      branch: mainBranch._id,
      currentStaff: staffJane._id,
      currentService: depService._id,
      status: 'enabled'
    });

    const counterMain2 = await Counter.create({
      number: 2,
      branch: mainBranch._id,
      currentStaff: staffJohn._id,
      currentService: loanService._id,
      status: 'enabled'
    });

    const counterMain3 = await Counter.create({
      number: 3,
      branch: mainBranch._id,
      currentStaff: staffMainSupport._id,
      currentService: supportService._id,
      status: 'enabled'
    });

    const counterNorth1 = await Counter.create({
      number: 1,
      branch: branches[1]._id,
      currentStaff: staffNorthDeposits._id,
      currentService: depService._id,
      status: 'enabled'
    });

    const counterNorth2 = await Counter.create({
      number: 2,
      branch: branches[1]._id,
      currentStaff: staffNorthLoans._id,
      currentService: loanService._id,
      status: 'enabled'
    });

    const counterNorth3 = await Counter.create({
      number: 3,
      branch: branches[1]._id,
      currentStaff: staffNorthSupport._id,
      currentService: supportService._id,
      status: 'enabled'
    });

    // Update staff profiles with their counters
    staffJane.counter = counterMain1._id;
    await staffJane.save();
    staffJohn.counter = counterMain2._id;
    await staffJohn.save();
    staffMainSupport.counter = counterMain3._id;
    await staffMainSupport.save();

    staffNorthDeposits.counter = counterNorth1._id;
    await staffNorthDeposits.save();
    staffNorthLoans.counter = counterNorth2._id;
    await staffNorthLoans.save();
    staffNorthSupport.counter = counterNorth3._id;
    await staffNorthSupport.save();

    console.log('🎛️ Seeded branch counters.');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
