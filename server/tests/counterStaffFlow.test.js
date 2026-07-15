import mongoose from 'mongoose';
import dotenv from 'dotenv';
import assert from 'assert';
import CounterStaff from '../models/CounterStaff.js';
import Counter from '../models/Counter.js';
import Branch from '../models/Branch.js';
import { createCounterStaff, updateCounterStaff } from '../controllers/counterStaffController.js';
import { login } from '../controllers/authController.js';

dotenv.config();

const makeRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
};

const runFlowTests = async () => {
  console.log('====================================================');
  console.log('    COUNTER STAFF FULL FLOW INTEGRATION TESTS       ');
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

    // Find sample branch and counter
    const branch = await Branch.findOne({});
    const counter = await Counter.findOne({});

    if (!branch || !counter) {
      console.error('Missing branch/counter to run tests.');
      process.exit(1);
    }

    const initialEmail = 'flowtest@apexbank.com';
    const newEmail = 'flowtest_new@apexbank.com';
    const initialPassword = 'initialPassword123';
    const newPassword = 'newPassword12345';

    // Cleanup
    await CounterStaff.deleteOne({ email: initialEmail });
    await CounterStaff.deleteOne({ email: newEmail });
    const existingStaffDoc = await CounterStaff.findOne({ counterId: counter._id });
    let temporaryStaffBackup = null;
    if (existingStaffDoc) {
      temporaryStaffBackup = existingStaffDoc.toObject();
      await CounterStaff.deleteOne({ _id: existingStaffDoc._id });
    }

    let staffId = null;

    // 1. Create Staff
    await test('Create Staff → Hashed password is saved', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          counterId: counter._id.toString(),
          branchId: branch._id.toString(),
          staffName: 'Flow Test Staff',
          email: initialEmail,
          password: initialPassword,
          status: 'active'
        }
      };
      const res = makeRes();

      await createCounterStaff(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.ok(res.jsonData);
      assert.strictEqual(res.jsonData.status, 'success');
      
      const cs = await CounterStaff.findOne({ email: initialEmail });
      assert.ok(cs);
      staffId = cs._id.toString();
      assert.notStrictEqual(cs.password, initialPassword);
      assert.ok(cs.password.startsWith('$2')); // bcrypt hashed
    });

    // 2. Login with Initial Credentials
    await test('Login with Initial Credentials → Successful authentication', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: initialEmail,
          password: initialPassword,
          role: 'staff'
        }
      };
      const res = makeRes();

      await login(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData);
      assert.strictEqual(res.jsonData.status, 'success');
      assert.ok(res.jsonData.data.accessToken);
    });

    // 3. Edit Email
    await test('Edit Email → Email is updated in database', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        params: { id: staffId },
        body: {
          staffName: 'Flow Test Staff',
          email: newEmail,
          status: 'active'
        }
      };
      const res = makeRes();

      await updateCounterStaff(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData);

      const cs = await CounterStaff.findById(staffId);
      assert.strictEqual(cs.email, newEmail);
    });

    // 4. Login with new email
    await test('Login with new email → Success', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: newEmail,
          password: initialPassword,
          role: 'staff'
        }
      };
      const res = makeRes();

      await login(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData);
      assert.strictEqual(res.jsonData.status, 'success');
    });

    // 5. Edit Password
    await test('Edit Password → Hashed new password is saved', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        params: { id: staffId },
        body: {
          staffName: 'Flow Test Staff',
          email: newEmail,
          status: 'active',
          password: newPassword
        }
      };
      const res = makeRes();

      await updateCounterStaff(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData);

      const cs = await CounterStaff.findById(staffId);
      assert.notStrictEqual(cs.password, newPassword);
      assert.ok(cs.password.startsWith('$2'));
    });

    // 6. Login with new password
    await test('Login with new password → Success, old password → Fail', async () => {
      // Test new password works
      const reqSuccess = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: newEmail,
          password: newPassword,
          role: 'staff'
        }
      };
      const resSuccess = makeRes();
      await login(reqSuccess, resSuccess);
      assert.strictEqual(resSuccess.statusCode, 200);

      // Test old password fails
      const reqFail = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: newEmail,
          password: initialPassword,
          role: 'staff'
        }
      };
      const resFail = makeRes();
      await login(reqFail, resFail);
      assert.strictEqual(resFail.statusCode, 401);
      assert.strictEqual(resFail.jsonData.message, 'Invalid email or password.');
    });

    // 7. Edit Name only
    await test('Edit Name only → Old password (newPassword) still works', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        params: { id: staffId },
        body: {
          staffName: 'Flow Test Staff Updated Name',
          email: newEmail,
          status: 'active'
        }
      };
      const res = makeRes();

      await updateCounterStaff(req, res);

      assert.strictEqual(res.statusCode, 200);

      // Check login still works
      const reqLogin = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: newEmail,
          password: newPassword,
          role: 'staff'
        }
      };
      const resLogin = makeRes();
      await login(reqLogin, resLogin);
      assert.strictEqual(resLogin.statusCode, 200);
      assert.strictEqual(resLogin.jsonData.data.user.name, 'Flow Test Staff Updated Name');
    });

    // 8. Assert specific errors
    await test('Login Errors → "User not found" on unknown email', async () => {
      const req = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: 'nonexistent_staff@apexbank.com',
          password: 'somePassword123',
          role: 'staff'
        }
      };
      const res = makeRes();
      await login(req, res);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.message, 'Invalid email or password.');
    });

    await test('Login Errors → "Account disabled" on inactive account', async () => {
      // Deactivate staff
      const reqUpdate = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        params: { id: staffId },
        body: {
          status: 'inactive'
        }
      };
      await updateCounterStaff(reqUpdate, makeRes());

      const reqLogin = {
        headers: {
          'user-agent': 'TEST_AGENT',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          email: newEmail,
          password: newPassword,
          role: 'staff'
        }
      };
      const resLogin = makeRes();
      await login(reqLogin, resLogin);
      assert.strictEqual(resLogin.statusCode, 403);
      assert.strictEqual(resLogin.jsonData.message, 'Your account has been disabled. Please contact the administrator.');
    });

    // Cleanup and restore database state
    await CounterStaff.deleteOne({ _id: staffId });
    if (temporaryStaffBackup) {
      delete temporaryStaffBackup._id;
      delete temporaryStaffBackup.createdAt;
      delete temporaryStaffBackup.updatedAt;
      await CounterStaff.create(temporaryStaffBackup);
    }
    console.log('\nDatabase cleaned up and backup restored.');

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

runFlowTests();
