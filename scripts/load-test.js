#!/usr/bin/env node
/**
 * Load Test — Phase 7
 * Fires concurrent requests at the FreightX API to measure throughput.
 * Usage: node scripts/load-test.js [--concurrency 20] [--requests 200]
 *
 * Does NOT mutate data — only hits GET endpoints.
 */

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? Number(args[idx + 1]) : fallback;
}

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
const CONCURRENCY = getArg('--concurrency', 20);
const TOTAL = getArg('--requests', 200);
const ENDPOINT = `${BASE_URL}/api/loads`;

async function runRequest() {
  const start = performance.now();
  try {
    const res = await fetch(ENDPOINT);
    return { ok: res.ok, ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - start) };
  }
}

async function runBatch(size) {
  return Promise.all(Array.from({ length: size }, runRequest));
}

async function main() {
  console.log(`Load Test — ${TOTAL} requests, concurrency ${CONCURRENCY}`);
  console.log(`Target: ${ENDPOINT}\n`);

  const results = [];
  let completed = 0;

  while (completed < TOTAL) {
    const batchSize = Math.min(CONCURRENCY, TOTAL - completed);
    const batch = await runBatch(batchSize);
    results.push(...batch);
    completed += batchSize;
    process.stdout.write(`\r  ${completed}/${TOTAL} completed`);
  }

  console.log('\n');
  const ok = results.filter((r) => r.ok).length;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  console.log(`Success rate : ${ok}/${TOTAL} (${Math.round((ok / TOTAL) * 100)}%)`);
  console.log(`Avg latency  : ${avg} ms`);
  console.log(`p95 latency  : ${p95} ms`);
  console.log(`p99 latency  : ${p99} ms`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Load test error:', err.message);
  process.exit(1);
});
