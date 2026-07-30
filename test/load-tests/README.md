# GPS Load Testing

Enterprise-grade load testing for FreightX GPS tracking system.

## Prerequisites

```bash
# Install dependencies
pnpm add -D @faker-js/faker tsx

# Set environment variables
cp .env.example .env.local
# Add your Supabase credentials
```

## Running Load Tests

### 1. Baseline Test (100 drivers)

Tests current capacity with realistic load.

```bash
NUM_DRIVERS=100 DURATION_MINUTES=5 npx tsx test/load-tests/gps-load-test.ts
```

**Expected results:**

- Total pings: ~1,000 (100 drivers × 5 min × 2 pings/min)
- Throughput: ~3-4 pings/second
- Error rate: <1%
- p95 latency: <500ms

### 2. Target Test (1,000 drivers)

Tests enterprise-scale capacity.

```bash
NUM_DRIVERS=1000 DURATION_MINUTES=5 npx tsx test/load-tests/gps-load-test.ts
```

**Expected results:**

- Total pings: ~10,000
- Throughput: ~33 pings/second
- Error rate: <5%
- p95 latency: <1000ms

### 3. Stress Test (5,000 drivers)

Tests breaking point and failure modes.

```bash
NUM_DRIVERS=5000 DURATION_MINUTES=2 PING_INTERVAL_SECONDS=10 npx tsx test/load-tests/gps-load-test.ts
```

**Expected results:**

- Total pings: ~60,000 (5000 × 2 min × 6 pings/min)
- Throughput: ~500 pings/second
- Error rate: May exceed 10% (expected at this scale)
- p95 latency: May exceed 2000ms

## Interpreting Results

### Success Criteria

- ✅ **Error rate < 5%** - System can handle load without excessive failures
- ✅ **p95 latency < 1000ms** - 95% of pings insert within 1 second
- ✅ **Throughput meets target** - System processes expected pings/second

### Common Failure Modes

**High error rate (>10%)**

- Cause: Database connection pool exhausted
- Fix: Increase Supabase connection limit or add PgBouncer

**High latency (p95 >2000ms)**

- Cause: Slow inserts due to index overhead or unoptimized schema
- Fix: Implement TimescaleDB (migration 048) or add Redis caching

**Timeout errors**

- Cause: Database overloaded
- Fix: Scale up Supabase plan or implement write queue

## Advanced Testing

### Test with Redis Caching

Enable Redis to test performance improvement:

```bash
# Set Redis credentials
VITE_UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
VITE_UPSTASH_REDIS_REST_TOKEN=your-token

# Run test with caching enabled
USE_REDIS_CACHE=true NUM_DRIVERS=1000 npx tsx test/load-tests/gps-load-test.ts
```

**Expected improvement:**

- Dashboard query time: 2-3s → <500ms
- Database load: 70% reduction

### Test with TimescaleDB

After running migration 048:

```bash
# Run test against TimescaleDB hypertable
USE_TIMESCALEDB=true NUM_DRIVERS=5000 npx tsx test/load-tests/gps-load-test.ts
```

**Expected improvement:**

- p95 latency: 1000ms → <200ms
- Storage compression: 50-70% reduction

## Monitoring During Load Tests

### Database Metrics (Supabase Dashboard)

Monitor these while test is running:

- **CPU usage** - Should stay <80%
- **Memory usage** - Should stay <90%
- **Active connections** - Should not hit pool limit
- **Disk I/O** - Should remain stable

### Application Metrics

```bash
# Monitor error logs in real-time
tail -f logs/gps-errors.log

# Check GPS ping queue depth
curl http://localhost:5173/api/health/gps-queue

# Monitor Redis cache hit rate
curl http://localhost:5173/api/health/redis-stats
```

## Load Test Schedule

Run these tests regularly to catch performance regressions:

- **Daily (CI/CD):** Baseline test (100 drivers, 1 min)
- **Weekly:** Target test (1,000 drivers, 5 min)
- **Monthly:** Stress test (5,000 drivers, 10 min)
- **Pre-release:** Full suite (all 3 tests)

## Troubleshooting

### Test fails with "connection refused"

```bash
# Check Supabase credentials
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Verify network access
curl -I $VITE_SUPABASE_URL
```

### Test hangs or times out

```bash
# Reduce number of drivers
NUM_DRIVERS=10 npx tsx test/load-tests/gps-load-test.ts

# Increase timeout
TIMEOUT_MS=10000 npx tsx test/load-tests/gps-load-test.ts
```

### Memory errors (out of memory)

```bash
# Run with increased Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npx tsx test/load-tests/gps-load-test.ts
```

## Results Archive

Save test results for comparison:

```bash
# Run test and save output
NUM_DRIVERS=1000 npx tsx test/load-tests/gps-load-test.ts | tee test-results/$(date +%Y%m%d-%H%M%S).log
```

Compare results over time to track performance trends.
