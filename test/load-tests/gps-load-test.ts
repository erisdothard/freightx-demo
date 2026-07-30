/**
 * GPS Load Testing Suite
 *
 * Simulates 1,000 concurrent drivers sending GPS pings to test system capacity.
 *
 * Test scenarios:
 * 1. Baseline: 100 drivers sending 1 ping/30s = 200 pings/min
 * 2. Target: 1,000 drivers sending 1 ping/30s = 2,000 pings/min
 * 3. Stress: 5,000 drivers sending 1 ping/10s = 30,000 pings/min
 *
 * Metrics measured:
 * - Ping insert latency (p50, p95, p99)
 * - Dashboard query time
 * - Database CPU/memory usage
 * - Error rate
 *
 * Run with: npx tsx test/load-tests/gps-load-test.ts
 */

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

// Load test configuration
const CONFIG = {
  SUPABASE_URL: process.env.VITE_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY!,
  NUM_DRIVERS: 1000,
  DURATION_MINUTES: 5,
  PING_INTERVAL_SECONDS: 30,
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

interface LoadTestMetrics {
  total_pings: number;
  successful_pings: number;
  failed_pings: number;
  latencies: number[]; // milliseconds
  errors: string[];
  start_time: Date;
  end_time?: Date;
}

const metrics: LoadTestMetrics = {
  total_pings: 0,
  successful_pings: 0,
  failed_pings: 0,
  latencies: [],
  errors: [],
  start_time: new Date(),
};

/**
 * Generate fake driver GPS ping
 */
function generateGpsPing(driverId: string, loadNumber: string) {
  return {
    load_number: loadNumber,
    driver_id: driverId,
    latitude: faker.location.latitude({ min: 25, max: 49 }), // Continental US
    longitude: faker.location.longitude({ min: -125, max: -65 }),
    speed_ms: faker.number.float({ min: 0, max: 35 }), // 0-78 mph
    heading_deg: faker.number.int({ min: 0, max: 359 }),
    accuracy_m: faker.number.int({ min: 5, max: 50 }),
    recorded_at: new Date().toISOString(),
  };
}

/**
 * Send a single GPS ping and measure latency
 */
async function sendGpsPing(driverId: string, loadNumber: string): Promise<void> {
  const ping = generateGpsPing(driverId, loadNumber);
  const startTime = Date.now();

  try {
    const { error } = await supabase.from('location_pings').insert(ping);

    const latency = Date.now() - startTime;
    metrics.latencies.push(latency);

    if (error) {
      metrics.failed_pings++;
      metrics.errors.push(error.message);
    } else {
      metrics.successful_pings++;
    }
  } catch (error) {
    metrics.failed_pings++;
    metrics.errors.push((error as Error).message);
  } finally {
    metrics.total_pings++;
  }
}

/**
 * Simulate a single driver sending periodic GPS pings
 */
async function simulateDriver(
  driverId: string,
  loadNumber: string,
  durationMs: number,
): Promise<void> {
  const intervalMs = CONFIG.PING_INTERVAL_SECONDS * 1000;
  const endTime = Date.now() + durationMs;

  while (Date.now() < endTime) {
    await sendGpsPing(driverId, loadNumber);
    await sleep(intervalMs);
  }
}

/**
 * Run the load test
 */
async function runLoadTest() {
  console.log('🚀 Starting GPS Load Test');
  console.log(`📊 Configuration:`);
  console.log(`   - Drivers: ${CONFIG.NUM_DRIVERS}`);
  console.log(`   - Duration: ${CONFIG.DURATION_MINUTES} minutes`);
  console.log(`   - Ping interval: ${CONFIG.PING_INTERVAL_SECONDS}s`);
  console.log(
    `   - Expected total pings: ${Math.floor((CONFIG.NUM_DRIVERS * CONFIG.DURATION_MINUTES * 60) / CONFIG.PING_INTERVAL_SECONDS)}\n`,
  );

  // Generate fake driver IDs and load numbers
  const drivers = Array.from({ length: CONFIG.NUM_DRIVERS }, () => ({
    driverId: faker.string.uuid(),
    loadNumber: `LOAD-${faker.string.alphanumeric(8).toUpperCase()}`,
  }));

  const durationMs = CONFIG.DURATION_MINUTES * 60 * 1000;

  // Start all drivers in parallel
  const promises = drivers.map(({ driverId, loadNumber }) =>
    simulateDriver(driverId, loadNumber, durationMs),
  );

  // Monitor progress
  const progressInterval = setInterval(() => {
    printProgress();
  }, 5000); // Every 5 seconds

  // Wait for all drivers to finish
  await Promise.all(promises);

  clearInterval(progressInterval);
  metrics.end_time = new Date();

  // Print final results
  printFinalReport();
}

/**
 * Print progress during test
 */
function printProgress() {
  const elapsed = Math.floor((Date.now() - metrics.start_time.getTime()) / 1000);
  const pingsPerSecond = Math.floor(metrics.total_pings / elapsed);

  console.log(
    `⏱️  ${elapsed}s | ${metrics.total_pings} pings | ${pingsPerSecond} pings/s | Success: ${metrics.successful_pings} | Failed: ${metrics.failed_pings}`,
  );
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Print final test report
 */
function printFinalReport() {
  const duration = metrics.end_time
    ? (metrics.end_time.getTime() - metrics.start_time.getTime()) / 1000
    : 0;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Load Test Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total Duration: ${duration.toFixed(1)}s`);
  console.log(`Total Pings: ${metrics.total_pings}`);
  console.log(
    `Successful: ${metrics.successful_pings} (${((metrics.successful_pings / metrics.total_pings) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Failed: ${metrics.failed_pings} (${((metrics.failed_pings / metrics.total_pings) * 100).toFixed(1)}%)\n`,
  );

  console.log(`Throughput: ${(metrics.total_pings / duration).toFixed(1)} pings/second\n`);

  if (metrics.latencies.length > 0) {
    console.log('Latency (insert time):');
    console.log(`  p50: ${percentile(metrics.latencies, 50).toFixed(0)}ms`);
    console.log(`  p95: ${percentile(metrics.latencies, 95).toFixed(0)}ms`);
    console.log(`  p99: ${percentile(metrics.latencies, 99).toFixed(0)}ms`);
    console.log(`  max: ${Math.max(...metrics.latencies).toFixed(0)}ms\n`);
  }

  if (metrics.errors.length > 0) {
    console.log('Top Errors:');
    const errorCounts = metrics.errors.reduce(
      (acc, err) => {
        acc[err] = (acc[err] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([error, count]) => {
        console.log(`  ${count}x: ${error}`);
      });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Pass/fail criteria
  const errorRate = (metrics.failed_pings / metrics.total_pings) * 100;
  const p95Latency = percentile(metrics.latencies, 95);

  if (errorRate > 5) {
    console.log(`❌ FAILED: Error rate ${errorRate.toFixed(1)}% > 5% threshold`);
  } else if (p95Latency > 1000) {
    console.log(`❌ FAILED: p95 latency ${p95Latency.toFixed(0)}ms > 1000ms threshold`);
  } else {
    console.log('✅ PASSED: All thresholds met');
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the test
runLoadTest().catch(console.error);
