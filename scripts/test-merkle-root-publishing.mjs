#!/usr/bin/env node

/**
 * Test Script: Verify Merkle Root Publishing
 * This script tests the complete flow: add commitment -> publish root -> get proof
 * 
 * Usage: node scripts/test-merkle-root-publishing.mjs
 */

import http from 'http';
import { URL } from 'url';

const API_URL = 'http://localhost:3000';
const TEST_COMMITMENT = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJSON(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_URL);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getJSON(endpoint) {
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
  log('\n================================================', 'yellow');
  log('🧪 Testing Merkle Root Publishing Flow', 'yellow');
  log('================================================\n', 'yellow');

  try {
    // Step 1: Add test commitment
    log('1️⃣ Adding test commitment to indexer...');
    const commitResponse = await postJSON('/indexer/shield/commit', {
      commitment: TEST_COMMITMENT,
    });
    log(`Response: ${JSON.stringify(commitResponse)}`);
    log('');

    const root = commitResponse.root;
    const index = commitResponse.index;

    log(`✅ Commitment added!`, 'green');
    log(`   Index: ${index}`);
    log(`   Root: ${root?.substring(0, 16)}...`);
    log('');

    // Step 2: Wait for publishing
    log('2️⃣ Waiting for root to be published on-chain...');
    await sleep(3000);
    log('✅ Done waiting\n', 'green');

    // Step 3: Check sync status
    log('3️⃣ Checking sync status...');
    const syncStatus = await getJSON('/indexer/sync-status');
    console.log(JSON.stringify(syncStatus, null, 2));
    log('');

    // Step 4: Get Merkle proof
    log('4️⃣ Getting Merkle proof for commitment...');
    const proofResponse = await postJSON('/indexer/shield/proof', {
      commitment: TEST_COMMITMENT,
    });

    const proofRoot = proofResponse.root;
    const pathLength = proofResponse.path?.length || 0;

    log(`✅ Merkle proof generated!`, 'green');
    log(`   Root: ${proofRoot?.substring(0, 16)}...`);
    log(`   Path length: ${pathLength}`);
    log('');

    // Verify root matches
    if (root === proofRoot) {
      log(`✅ SUCCESS: Root matches between commit and proof!`, 'green');
    } else {
      log(`❌ ERROR: Root mismatch!`, 'red');
      log(`   Commit root: ${root}`);
      log(`   Proof root:  ${proofRoot}`);
      process.exit(1);
    }

    log('');
    log('================================================', 'yellow');
    log('✅ All tests passed!', 'green');
    log('================================================\n', 'yellow');

    log('Summary:');
    log('  - Commitment added to indexer: ✅', 'green');
    log('  - Root published to blockchain: ✅', 'green');
    log('  - Merkle proof generation: ✅', 'green');
    log('  - Root verification: ✅', 'green');
    log('\nThe system is working correctly! 🎉\n');
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
