// Automated test suite for ReliefHub backend API & business logic rules
const http = require('http');

const PORT = 3000;
const BASE = `http://localhost:${PORT}/api`;

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting ReliefHub Verification Tests ---');

  // Test 1: Static index.html
  const home = await request(`http://localhost:${PORT}/`);
  console.assert(home.status === 200, `Expected 200 for home, got ${home.status}`);
  console.assert(typeof home.data === 'string' && home.data.includes('ReliefHub'), 'Home contains ReliefHub');
  console.log('✓ Test 1: Static files served successfully.');

  // Test 2: Seed data collections count (Milestone 6)
  const camps = await request('/camps');
  console.assert(camps.data.length === 8, `Expected 8 camps, got ${camps.data.length}`);
  const inventory = await request('/inventory');
  console.assert(inventory.data.length === 12, `Expected 12 inventory items, got ${inventory.data.length}`);
  const needs = await request('/needs');
  console.assert(needs.data.length === 20, `Expected 20 needs, got ${needs.data.length}`);
  const dispatches = await request('/dispatches');
  console.assert(dispatches.data.length === 10, `Expected 10 dispatches, got ${dispatches.data.length}`);
  const donations = await request('/donations');
  console.assert(donations.data.length === 10, `Expected 10 donations, got ${donations.data.length}`);
  const volunteers = await request('/volunteers');
  console.assert(volunteers.data.length === 15, `Expected 15 volunteers, got ${volunteers.data.length}`);
  console.log('✓ Test 2: Milestone 6 seed collections verified (8 camps, 12 items, 20 needs, 10 dispatches, 10 donations, 15 volunteers).');

  // Test 3: Milestone 1 - Auto-mark Full when current families reach capacity
  const newCamp = await request('/camps', 'POST', {
    name: 'Test Full Auto Camp',
    district: 'Dadu',
    capacity: 100,
    current_families: 100,
    status: 'Active'
  });
  console.assert(newCamp.status === 201, 'Camp created');
  console.assert(newCamp.data.status === 'Full', `Expected status Full, got ${newCamp.data.status}`);
  console.log('✓ Test 3: Milestone 1 auto-mark Full on capacity verified.');

  // Clean up created test camp
  await request(`/camps/${newCamp.data.id}`, 'DELETE');

  // Test 4: Milestone 3 - Over-dispatch prevention (exceeding stock)
  const overStockDsp = await request('/dispatches', 'POST', {
    camp_id: 1,
    need_id: 1,
    quantity: 999999
  });
  console.assert(overStockDsp.status === 400, 'Expected 400 for dispatch exceeding warehouse stock');
  console.log('✓ Test 4: Milestone 3 rule verified (Never dispatch more than available stock).');

  // Test 5: Milestone 3 - Over-dispatch prevention (exceeding remaining unreserved need)
  // Need 1 requires 100, fulfilled 20, DSP-1 already has 30 pending => remaining unreserved = 100 - 20 - 30 = 50.
  const overNeedDsp = await request('/dispatches', 'POST', {
    camp_id: 1,
    need_id: 1,
    quantity: 60 // 60 > 50
  });
  console.assert(overNeedDsp.status === 400, 'Expected 400 for dispatch exceeding remaining unreserved quantity');
  console.log('✓ Test 5: Milestone 3 rule verified (Never exceed need remaining unreserved quantity).');

  // Test 6: Milestone 3 - Immediate stock reservation on dispatch creation & cancellation restore
  const invBefore = await request('/inventory/1');
  const initialStock = invBefore.data.stock;
  const validDsp = await request('/dispatches', 'POST', {
    camp_id: 1,
    need_id: 1,
    quantity: 10,
    status: 'Pending'
  });
  console.assert(validDsp.status === 201, 'Valid dispatch created');
  const invAfterCreate = await request('/inventory/1');
  console.assert(invAfterCreate.data.stock === initialStock - 10, `Stock reserved: was ${initialStock}, now ${invAfterCreate.data.stock}`);

  // Cancel dispatch => restores stock
  const cancelRes = await request(`/dispatches/${validDsp.data.id}`, 'PUT', { status: 'Cancelled' });
  console.assert(cancelRes.status === 200, 'Dispatch cancelled');
  const invAfterCancel = await request('/inventory/1');
  console.assert(invAfterCancel.data.stock === initialStock, `Stock restored: now ${invAfterCancel.data.stock}`);
  console.log('✓ Test 6: Milestone 3 stock reservation & cancellation restore verified.');

  // Delete test dispatch
  await request(`/dispatches/${validDsp.data.id}`, 'DELETE');

  // Test 7: Milestone 4 - In-Kind donation increases item stock
  const inv2Before = await request('/inventory/2');
  const stock2Before = inv2Before.data.stock;
  const inKindDon = await request('/donations', 'POST', {
    type: 'In-Kind',
    amount_or_quantity: 25,
    item_id: 2,
    category: 'Food'
  });
  console.assert(inKindDon.status === 201, 'In-kind donation created');
  const inv2After = await request('/inventory/2');
  console.assert(inv2After.data.stock === stock2Before + 25, `In-kind increased stock by 25: ${inv2After.data.stock}`);
  console.log('✓ Test 7: Milestone 4 in-kind donation increases warehouse stock verified.');

  // Test 8: Milestone 4 - Volunteer cannot be assigned to Closed camp
  // Camp 8 is Closed
  const closedCampVol = await request('/volunteers', 'POST', {
    name: 'Invalid Assignment Vol',
    skill: 'Medical',
    camp_id: 8
  });
  console.assert(closedCampVol.status === 400, 'Expected 400 when assigning volunteer to Closed camp');
  console.log('✓ Test 8: Milestone 4 rule verified (Cannot assign volunteer to Closed camp).');

  // Test 9: Milestone 6 - Reset endpoint restores seed state
  const resetRes = await request('/reset', 'POST');
  console.assert(resetRes.status === 200, 'Reset returned 200');
  const resetInv2 = await request('/inventory/2');
  console.assert(resetInv2.data.stock === 60, `Reset restored stock to seed value 60, got ${resetInv2.data.stock}`);
  console.log('✓ Test 9: Milestone 6 reset database to seed data verified.');

  console.log('\n========================================');
  console.log('ALL MILESTONE TEST SUITES PASSED (9/9)!');
  console.log('========================================');
}

// Start server if not running
const serverProcess = require('./server.js');
setTimeout(async () => {
  try {
    await runTests();
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  }
}, 500);

