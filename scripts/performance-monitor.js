#!/usr/bin/env node
/**
 * Performance Monitor — Phase 7
 * Collects and reports key performance metrics from the FreightX API.
 * Usage: node scripts/performance-monitor.js
 */

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
const ENDPOINTS = ['/api/health', '/api/loads', '/api/trucks'];

async function measureEndpoint(url) {
  const start = performance.now();
  try {
    const res = await fetch(url);
    const ms = Math.round(performance.now() - start);
    return { url, status: res.status, ms, ok: res.ok };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return { url, status: 0, ms, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`Performance Monitor — ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}\n`);

  for (const endpoint of ENDPOINTS) {
    const result = await measureEndpoint(`${BASE_URL}${endpoint}`);
    const icon = result.ok ? '✅' : '❌';
    console.log(
      `${icon}  ${result.url.padEnd(30)} ${String(result.ms).padStart(5)} ms  (HTTP ${result.status})`,
    );
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Performance monitor error:', err.message);
  process.exit(1);
});
