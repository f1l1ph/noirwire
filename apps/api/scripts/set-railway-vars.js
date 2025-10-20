#!/usr/bin/env node

/**
 * Set Railway environment variables
 * Run: npm run railway:vars
 */

const { execSync } = require('child_process');

const variables = {
  NODE_ENV: 'production',
  PORT: '3000',
  SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  NOIRWIRE_PROGRAM_ID: 'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz',
  SOLANA_COMMITMENT: 'confirmed',
};

const manualVariables = [
  'SUPABASE_URL (your Supabase project URL)',
  'SUPABASE_SERVICE_KEY (your Supabase service role key)',
  'CORS_ORIGINS (add your Vercel URL after frontend deployment)',
];

console.log('🔧 Setting Railway environment variables...\n');

try {
  // Set each variable
  for (const [key, value] of Object.entries(variables)) {
    console.log(`Setting ${key}...`);
    execSync(`railway variables --set "${key}=${value}"`, {
      stdio: 'pipe',
    });
  }

  console.log('\n✅ Basic variables set!\n');
  console.log('⚠️  IMPORTANT: You still need to set these variables manually in Railway dashboard:');
  manualVariables.forEach((variable) => {
    console.log(`   - ${variable}`);
  });
  console.log('\n📊 Go to: https://railway.com/dashboard');
  console.log('   → Click your project → Variables tab\n');
  console.log('✅ Railway will auto-redeploy once you add the missing ones.');
} catch (error) {
  console.error('\n❌ Error setting variables:');
  console.error(error.message);
  console.log('\nTip: Make sure you are logged in (run: railway login)');
  console.log('Tip: Make sure project is linked (run: railway link)');
  process.exit(1);
}
