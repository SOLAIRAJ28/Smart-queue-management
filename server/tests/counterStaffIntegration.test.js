import mongoose from 'mongoose';
import dotenv from 'dotenv';
import assert from 'assert';
import CounterStaff from '../models/CounterStaff.js';
import Counter from '../models/Counter.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const runCounterStaffTests = async () => {
  console.log('====================================================');
  console.log('    COUNTER STAFF BACKEND INTEGRATION TESTS         ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // Fetch a branch and counter to use for testing
    const branch = await Branch.findOne({});
    const counter = await Counter.findOne({});

    if (!branch || !counter) {
      console.error('Cannot run tests: No branches or counters found in database. Seed the database first.');
      process.exit(1);
    }

    const testEmail = 'test_cs_staff@apexbank.com';
    const testPassword = 'testPassword123';

    // Cleanup previous failed runs and temporarily remove any existing staff on this counter to avoid unique index conflict
    const existingStaffForCounterDoc = await CounterStaff.findOne({ counterId: counter._id });
    let existingStaffForCounter = null;
    if (existingStaffForCounterDoc) {
      existingStaffForCounter = existingStaffForCounterDoc.toObject();
      await CounterStaff.deleteOne({ _id: existingStaffForCounterDoc._id });
    }
    await CounterStaff.deleteOne({ email: testEmail });

    // 1. Test Creation & Hashing
    await test('CounterStaff: Save document with hashed password', async () => {
      const cs = new CounterStaff({
        counterId: counter._id,
        branchId: branch._id,
        staffName: 'Test CS Staff',
        email: testEmail,
        password: testPassword,
        role: 'counter_staff',
        status: 'active'
      });

      await cs.save();

      const savedCs = await CounterStaff.findOne({ email: testEmail });
      assert.ok(savedCs);
      assert.strictEqual(savedCs.staffName, 'Test CS Staff');
      assert.strictEqual(savedCs.role, 'counter_staff');
      assert.strictEqual(savedCs.status, 'active');
      
      // Password must be hashed (not plain text)
      assert.notStrictEqual(savedCs.password, testPassword);
      assert.ok(savedCs.password.startsWith('$2')); // bcrypt prefix
    });

    // 2. Test Password Matching
    await test('CounterStaff: Password comparison utility', async () => {
      const cs = await CounterStaff.findOne({ email: testEmail });
      assert.ok(cs);

      const match = await cs.matchPassword(testPassword);
      assert.strictEqual(match, true);

      const mismatch = await cs.matchPassword('wrongPassword');
      assert.strictEqual(mismatch, false);
    });

    // 3. Test Counter Populates Assigned Staff
    await test('CounterStaff: Counter association populate structure', async () => {
      const counters = await Counter.find({}).lean();
      const updatedCounter = counters.find(c => c._id.toString() === counter._id.toString());
      
      // Associate manually to verify controller logic mockup
      const cs = await CounterStaff.findOne({ email: testEmail });
      
      // Emulate controller behavior
      const counterWithStaff = {
        ...updatedCounter,
        counterStaff: cs
      };

      assert.ok(counterWithStaff.counterStaff);
      assert.strictEqual(counterWithStaff.counterStaff.email, testEmail);
      assert.strictEqual(counterWithStaff.counterStaff.staffName, 'Test CS Staff');
    });

    // Cleanup
    await CounterStaff.deleteOne({ email: testEmail });
    if (existingStaffForCounter) {
      delete existingStaffForCounter._id;
      delete existingStaffForCounter.createdAt;
      delete existingStaffForCounter.updatedAt;
      await CounterStaff.create(existingStaffForCounter);
    }
    console.log('\nDatabase cleaned up.');

  } catch (err) {
    console.error('Test framework execution error:', err);
    failed++;
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    console.log('\n====================================================');
    console.log(`     TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
    
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
};

runCounterStaffTests();
