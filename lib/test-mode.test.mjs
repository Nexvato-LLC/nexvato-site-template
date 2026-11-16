// Run with `npm test` (node --test). Support #240.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestMode, TEST_MODE_NOTICE } from './test-mode.js';

test('the API flag decides when it is sent', () => {
  assert.equal(isTestMode({ testMode: true, publishableKey: 'pk_live_x', acceptingPayments: true }), true);
  assert.equal(isTestMode({ testMode: false, publishableKey: 'pk_test_x', acceptingPayments: true }), false);
});

test('an older API without the flag is read from the publishable key', () => {
  assert.equal(isTestMode({ publishableKey: 'pk_test_abc', acceptingPayments: true }), true);
  assert.equal(isTestMode({ publishableKey: 'pk_test_abc' }), true);
  assert.equal(isTestMode({ publishableKey: 'pk_live_abc', acceptingPayments: true }), false);
});

test('a store that is not taking payments is never in test mode', () => {
  assert.equal(isTestMode({ publishableKey: 'pk_test_abc', acceptingPayments: false }), false);
  assert.equal(isTestMode({ publishableKey: '' }), false);
  assert.equal(isTestMode(null), false);
  assert.equal(isTestMode(undefined), false);
});

test('the notice names the test card and says nothing is charged', () => {
  assert.match(TEST_MODE_NOTICE, /Test mode/);
  assert.match(TEST_MODE_NOTICE, /no real charges/);
  assert.match(TEST_MODE_NOTICE, /4242 4242 4242 4242/);
  assert.match(TEST_MODE_NOTICE, /any future date, any CVC/);
});
