#!/usr/bin/env node

/**
 * Test Script - Verify Solana Program Configuration
 * 
 * This script:
 * 1. Verifies the program is deployed on devnet
 * 2. Shows the environment configuration
 * 3. Tests RPC connectivity
 */

const axios = require('axios');

const programId = process.env.NOIRWIRE_PROGRAM_ID || 'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz';
const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║         Solana Program Configuration Verification            ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

console.log('✅ Configuration:');
console.log(`  • Program ID: ${programId}`);
console.log(`  • RPC URL: ${rpcUrl}`);
console.log(`  • Commitment: ${process.env.SOLANA_COMMITMENT || 'confirmed'}`);
console.log('');

// Test RPC connectivity
const runChecks = async () => {
  console.log('🔗 Testing RPC connectivity...');
  try {
    const { data } = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5_000,
      },
    );

    if (data.result === 'ok') {
      console.log('  ✅ RPC is healthy');
    } else {
      console.log('  ❌ RPC health check failed');
    }
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.statusText || err.message
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('  ❌ RPC connection error:', message);
  }

  // Check program account
  console.log('');
  console.log('📋 Fetching program account...');

  try {
    const { data } = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          programId,
          { encoding: 'base64' },
        ],
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5_000,
      },
    );

    if (data.result && data.result.value) {
      const account = data.result.value;
      console.log('  ✅ Program account found');
      console.log(`  • Owner: ${account.owner}`);
      console.log(`  • Lamports: ${account.lamports / 1e9} SOL`);
      console.log(`  • Executable: ${account.executable}`);
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║                                                               ║');
      console.log('║              ✅ ALL CHECKS PASSED                             ║');
      console.log('║                                                               ║');
      console.log('║   Your API is configured to use the deployed devnet program  ║');
      console.log('║   Start the indexer with: npm run dev --filter=api           ║');
      console.log('║                                                               ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
    } else {
      console.log('  ❌ Program account not found');
      console.log('  Please verify the program ID is correct');
    }
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.response?.statusText || err.message
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('  ❌ Error fetching program:', message);
  }
};

runChecks();
