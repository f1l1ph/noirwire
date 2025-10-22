#!/usr/bin/env node

/**
 * NoirWire Indexer Diagnostic Tool
 * Run this to quickly diagnose commitment/indexer issues
 * 
 * Usage: node scripts/check-indexer.mjs
 */

import http from 'http';
import { URL } from 'url';

const API_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchJSON(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  log('\n🔍 NoirWire Indexer Diagnostic Tool', 'yellow');
  log('====================================\n');

  try {
    // Check if API is running
    log('1. Checking if API is running...');
    try {
      await fetchJSON(`${API_URL}/indexer/status`);
      log('✅ API is running\n', 'green');
    } catch {
      log('❌ API is NOT running!\n', 'red');
      log('   Start it with: yarn dev:api');
      process.exit(1);
    }

    // Get indexer status
    log('2. Checking indexer status...');
    const status = await fetchJSON(`${API_URL}/indexer/status`);
    console.log(JSON.stringify(status, null, 2));

    const shieldCount = status.trees?.shield?.count || 0;
    log('');

    if (shieldCount === 0) {
      log(`❌ Shield tree is EMPTY (count: 0)`, 'red');
      log('   This means commitments are NOT being added after shield!');
      log('');
      log('   Action: Shield some SOL and watch the browser console for:');
      log('   "🔥 ADDING COMMITMENT TO INDEXER"');
    } else {
      log(`✅ Shield tree has ${shieldCount} commitment(s)\n`, 'green');
      log('   Commitments in shield tree:');
      const commitments = await fetchJSON(`${API_URL}/indexer/shield/commitments`);
      console.log(JSON.stringify(commitments, null, 2));
    }

    log('');
    log('====================================');
    log('3. Next steps:\n');

    if (shieldCount === 0) {
      log('   1. Shield 0.1 SOL', 'yellow');
      log('   2. Watch browser console for success/failure', 'yellow');
      log('   3. Run this script again to verify commitment was added', 'yellow');
    } else {
      log('   1. Go to: http://localhost:3001/debug-indexer', 'green');
      log('   2. Click "Load Notes" to get your commitment', 'green');
      log('   3. Test "Get Merkle Proof" - should return 20 elements', 'green');
      log('   4. Try unshielding!', 'green');
    }

    log('\n');
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
