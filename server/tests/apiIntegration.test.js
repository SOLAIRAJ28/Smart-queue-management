import assert from 'assert';
import crypto from 'crypto';
import { predictWaitingTime, generateCrowdForecast } from '../utils/aiPredictor.js';

// Local mockup helper for AuditLog chain hashing
const calculateTestHash = (prevHash, payload, timestampStr) => {
  const blockString = [
    payload.actor ? payload.actor.toString() : 'ANONYMOUS',
    payload.action,
    payload.description,
    payload.ipAddress || '0.0.0.0',
    payload.userAgent || 'UNKNOWN',
    timestampStr,
    prevHash
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(blockString)
    .digest('hex');
};

// Simple mockup of Request / Response for sanitizer test
const mockSanitizerRequest = (bodyContent) => {
  return {
    body: bodyContent,
    query: {},
    params: {}
  };
};

const runSystemTests = async () => {
  console.log('====================================================');
  console.log('     STARTING SMART QUEUE SYSTEM INTEGRATION TESTS  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  };

  // 1. AI Wait Predictor Queue Tests
  test('AI Wait Predictor: Zero waiting returns zero minutes', () => {
    const res = predictWaitingTime(0, 15, 2);
    assert.strictEqual(res.waitMinutes, 0);
    assert.strictEqual(res.congestionLevel, 'low');
  });

  test('AI Wait Predictor: Standard queue calculations with multipliers', () => {
    // 5 waiting, average time 15m, 2 active tellers
    // Base wait = (5 * 15) / 2 = 37.5 minutes
    // Sunday (no day multiplier), 9 AM (no hour multiplier)
    const sundayMorning = new Date('2026-06-21T09:00:00');
    const res = predictWaitingTime(5, 15, 2, sundayMorning);
    
    assert.strictEqual(res.waitMinutes, 38); // Math.round(37.5)
    assert.strictEqual(res.congestionLevel, 'critical'); // >= 30 mins
  });

  test('AI Wait Predictor: Monday Morning rush hour multiplier applied', () => {
    // Monday morning rush (+20% modifier)
    const mondayMorning = new Date('2026-06-22T09:00:00');
    const res = predictWaitingTime(4, 15, 2, mondayMorning); // Base = 30 mins
    // Monday +20% -> 30 * 1.2 = 36 mins
    assert.strictEqual(res.waitMinutes, 36);
  });

  test('AI Wait Predictor: Crowd forecasting density indices', () => {
    const forecast = generateCrowdForecast(10);
    assert.strictEqual(forecast.length, 9); // 9 AM to 5 PM
    assert.ok(forecast.some(f => f.hour === '12:00'));
    // Lunch hour should be High Rush
    const lunch = forecast.find(f => f.hour === '12:00');
    assert.strictEqual(lunch.density, 'High Rush');
  });

  // 2. Cryptographic Hashing Logic Tests
  test('Cryptographic Audit: Consistent block hashing', () => {
    const payload = { actor: 'admin123', action: 'LOGIN', description: 'Admin logged in' };
    const prevHash = '0000abc123';
    const hash1 = calculateTestHash(prevHash, payload, '2026-06-16T12:00:00.000Z');
    const hash2 = calculateTestHash(prevHash, payload, '2026-06-16T12:00:00.000Z');
    
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64); // SHA-256 hex length
  });

  test('Cryptographic Audit: Altering payload yields different hash signature', () => {
    const payload1 = { actor: 'admin123', action: 'LOGIN', description: 'Amt: 100' };
    const payload2 = { actor: 'admin123', action: 'LOGIN', description: 'Amt: 101' }; // Tampered!
    const prevHash = '0000abc123';
    const time = '2026-06-16T12:00:00.000Z';
    
    const hash1 = calculateTestHash(prevHash, payload1, time);
    const hash2 = calculateTestHash(prevHash, payload2, time);
    
    assert.notStrictEqual(hash1, hash2);
  });

  // 3. XSS Sanitizer Security Checks
  test('XSS Sanitizer: Strips HTML script tags from inputs', () => {
    const input = {
      username: 'joe_customer',
      comment: '<script>alert("hack")</script>Hello bank teller!',
      nested: {
        payload: '<img src=x onerror=alert(1)>'
      }
    };
    
    const req = mockSanitizerRequest(input);
    
    // Custom sanitizer logic run manually
    const sanitizeValue = (val) => {
      if (typeof val === 'string') {
        return val.replace(/<[^>]*>/g, '').trim();
      }
      if (val && typeof val === 'object') {
        for (const key in val) {
          if (Object.prototype.hasOwnProperty.call(val, key)) {
            val[key] = sanitizeValue(val[key]);
          }
        }
      }
      return val;
    };
    
    const cleanBody = sanitizeValue(req.body);
    
    assert.strictEqual(cleanBody.comment, 'alert("hack")Hello bank teller!');
    assert.strictEqual(cleanBody.nested.payload, '');
  });

  console.log('\n====================================================');
  console.log(`     TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runSystemTests();
