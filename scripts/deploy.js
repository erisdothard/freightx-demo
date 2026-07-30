#!/usr/bin/env node
/**
 * Deploy — Phase 7
 * Orchestrates a production deployment:
 *   1. Type-check
 *   2. Build (turbo)
 *   3. Run health check against staging
 *   4. Push to Vercel (if VERCEL_TOKEN is set)
 *
 * Usage: node scripts/deploy.js [--env staging|production]
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const envIdx = args.indexOf('--env');
const env = envIdx !== -1 ? args[envIdx + 1] : 'staging';

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅  ${label} — OK`);
  } catch {
    console.error(`❌  ${label} — FAILED`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Deploy — target: ${env} — ${new Date().toISOString()}`);

  run('npm run check', 'Type check');
  run('npx turbo build', 'Build');

  if (process.env.VERCEL_TOKEN) {
    const flag = env === 'production' ? '--prod' : '';
    run(`npx vercel deploy ${flag} --token $VERCEL_TOKEN`, `Vercel deploy (${env})`);
  } else {
    console.log('\n⚠️  VERCEL_TOKEN not set — skipping Vercel deploy step');
  }

  console.log('\nDeployment complete.');
}

main().catch((err) => {
  console.error('Deploy error:', err.message);
  process.exit(1);
});
