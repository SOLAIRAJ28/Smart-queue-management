import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Counter from '../models/Counter.js';
import Staff from '../models/Staff.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Service from '../models/Service.js';

dotenv.config();

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ role: 'staff' });
    console.log('\n--- Staff Users in DB ---');
    users.forEach(u => console.log(`User: ${u.name}, ID: ${u._id}, Email: ${u.email}`));

    const staff = await Staff.find({}).populate('user');
    console.log('\n--- Staff Profiles in DB ---');
    staff.forEach(s => console.log(`Staff Profile ID: ${s._id}, User Name: ${s.user?.name}, User ID: ${s.user?._id}`));

    const counters = await Counter.find({})
      .populate('branch')
      .populate({
        path: 'currentStaff',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('currentService');
    console.log('\n--- Counters in DB ---');
    counters.forEach(c => {
      console.log(`Counter #${c.number}, ID: ${c._id}`);
      console.log(`  Staff ID: ${c.currentStaff?._id}`);
      console.log(`  Staff User ID: ${c.currentStaff?.user?._id}`);
      console.log(`  Staff User Name: ${c.currentStaff?.user?.name}`);
      console.log(`  Service: ${c.currentService?.name}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkDB();
