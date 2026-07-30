# Kafka Event Streaming Architecture for GPS Tracking

**When to implement:** When you have >1,000 concurrent drivers sending GPS pings (>2,000 pings/minute)

**Why:** Kafka decouples GPS ingestion from processing, enabling horizontal scaling and guaranteed delivery.

---

## Current Architecture (without Kafka)

```
Driver App → Supabase API → PostgreSQL → Dashboard Queries
                           ↓
                         RLS Policies
                           ↓
                     Triggers/Functions
```

**Limitations at scale:**

- Synchronous writes block on triggers/functions
- Database becomes bottleneck at >5,000 pings/min
- No replay capability for debugging
- Difficult to add new consumers (analytics, ML, etc.)

---

## Kafka Architecture (for >1,000 drivers)

```
Driver App → API Gateway → Kafka Topic "gps-pings"
                              ↓
                        ┌─────┴─────┬──────────┬─────────┐
                        ↓           ↓          ↓         ↓
                   DB Writer  Geofence  Anomaly   ETA
                   Consumer   Processor Detector  Updater
                        ↓           ↓          ↓         ↓
                   PostgreSQL Notifications Alerts  Dashboard
```

---

## Kafka Topic Design

### Topic: `gps-pings`

**Partitioning:** By `driver_id` (ensures ordered delivery per driver)

**Message schema:**

```json
{
  "event_id": "uuid-v4",
  "event_type": "gps_ping",
  "timestamp": "2026-04-10T19:30:00Z",
  "driver_id": "uuid",
  "load_number": "LOAD-ABC123",
  "location": {
    "latitude": 36.1627,
    "longitude": -86.7816,
    "accuracy_m": 15
  },
  "motion": {
    "speed_ms": 25.5,
    "heading_deg": 90
  },
  "metadata": {
    "device_type": "mobile_web",
    "battery_level": 0.75
  }
}
```

**Retention:** 7 days (for replay/debugging)

**Replication factor:** 3 (high availability)

---

## Consumer Groups

### 1. Database Writer Consumer

**Purpose:** Persist GPS pings to PostgreSQL/TimescaleDB

**Parallelism:** 10 workers

**Processing:**

```typescript
async function processBatch(messages: KafkaMessage[]) {
  const pings = messages.map((msg) => JSON.parse(msg.value));

  // Batch insert (10x faster than single inserts)
  await supabase.from('location_pings').insert(pings);

  // Commit offset after successful write
  await consumer.commitOffsets();
}
```

**Error handling:** Dead letter queue for failed inserts

---

### 2. Geofence Processor Consumer

**Purpose:** Detect geofence enter/exit events in real-time

**Parallelism:** 5 workers

**Processing:**

```typescript
async function processGeofenceCheck(ping: GpsPing) {
  const geofences = await getGeofencesForLoad(ping.load_number);

  for (const geofence of geofences) {
    const distance = calculateDistance(ping.location, geofence.center);

    if (distance < geofence.radius_m) {
      // Driver entered geofence
      await publishEvent('geofence-events', {
        event_type: 'enter',
        geofence_id: geofence.id,
        driver_id: ping.driver_id,
        timestamp: ping.timestamp,
      });

      // Send notification
      await notifyShipper(geofence.load_number, 'Driver arrived at pickup');
    }
  }
}
```

---

### 3. Anomaly Detector Consumer

**Purpose:** Detect GPS anomalies (teleportation, excessive speed, spoofing)

**Parallelism:** 3 workers

**Processing:**

```typescript
async function detectAnomalies(ping: GpsPing) {
  const lastPing = await getLastPing(ping.driver_id);

  if (lastPing) {
    const distance = calculateDistance(lastPing.location, ping.location);
    const timeDelta = (ping.timestamp - lastPing.timestamp) / 1000; // seconds
    const speed = (distance / timeDelta) * 3.6; // km/h

    if (speed > 130) {
      await publishEvent('gps-anomalies', {
        anomaly_type: 'excessive_speed',
        driver_id: ping.driver_id,
        speed_kmh: speed,
        severity: speed > 200 ? 'CRITICAL' : 'WARNING',
      });
    }
  }
}
```

---

### 4. ETA Updater Consumer

**Purpose:** Recalculate ETAs when driver location changes

**Parallelism:** 5 workers

**Processing:**

```typescript
async function updateETA(ping: GpsPing) {
  const load = await getLoad(ping.load_number);
  if (!load || load.status !== 'in_transit') return;

  const eta = calculateETA(ping.location, load.destination, ping.motion.speed_ms);

  // Cache updated ETA in Redis (fast dashboard access)
  await redis.setex(
    `eta:${load.load_number}`,
    60, // 60s TTL
    JSON.stringify({ eta_minutes: eta, confidence: 0.85 }),
  );

  // If ETA changed significantly, notify shipper
  if (Math.abs(eta - load.estimated_eta) > 30) {
    await notifyShipper(load.load_number, `ETA updated: ${eta} minutes`);
  }
}
```

---

## Infrastructure Setup

### Option 1: Confluent Cloud (Managed Kafka)

**Pros:**

- Fully managed, no ops overhead
- Auto-scaling
- Built-in monitoring

**Cons:**

- $1-3/GB ingress/egress
- Vendor lock-in

**Setup:**

```bash
# Create Kafka cluster
confluent kafka cluster create gps-tracking --cloud aws --region us-east-1

# Create topic
confluent kafka topic create gps-pings \
  --cluster lkc-xxxxx \
  --partitions 20 \
  --config retention.ms=604800000  # 7 days

# Get credentials
confluent api-key create --resource lkc-xxxxx
```

**Cost estimate:** $500-1000/month for 10,000 drivers

---

### Option 2: Self-hosted Kafka on AWS

**Pros:**

- Lower cost at scale
- Full control

**Cons:**

- Requires Kafka expertise
- Ops overhead (monitoring, scaling, upgrades)

**Setup:**

```bash
# Deploy Kafka cluster via Terraform
terraform apply -var-file=kafka-cluster.tfvars

# Configure topics
kafka-topics.sh --create \
  --topic gps-pings \
  --partitions 20 \
  --replication-factor 3 \
  --bootstrap-server localhost:9092
```

**Cost estimate:** $300-600/month (3 m5.large brokers + EBS)

---

## Producer Implementation (Driver App)

```typescript
// apps/web/src/lib/kafka-producer.ts

import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'freightx-web',
  brokers: [process.env.KAFKA_BROKER_URL!],
  ssl: true,
  sasl: {
    mechanism: 'plain',
    username: process.env.KAFKA_API_KEY!,
    password: process.env.KAFKA_API_SECRET!,
  },
});

const producer = kafka.producer();

export async function publishGpsPing(ping: GpsPing) {
  await producer.send({
    topic: 'gps-pings',
    messages: [
      {
        key: ping.driver_id, // Partition by driver
        value: JSON.stringify(ping),
        headers: {
          event_type: 'gps_ping',
          schema_version: '1.0',
        },
      },
    ],
  });
}

// Batch publishing for efficiency
export async function publishGpsPingsBatch(pings: GpsPing[]) {
  await producer.sendBatch({
    topicMessages: [
      {
        topic: 'gps-pings',
        messages: pings.map((ping) => ({
          key: ping.driver_id,
          value: JSON.stringify(ping),
        })),
      },
    ],
  });
}
```

---

## Consumer Implementation

```typescript
// services/kafka-consumers/db-writer.ts

import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  /* config */
});
const consumer = kafka.consumer({ groupId: 'db-writer' });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'gps-pings', fromBeginning: false });

  await consumer.run({
    eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
      const pings = batch.messages.map((msg) => JSON.parse(msg.value.toString()));

      // Batch insert to database
      await supabase.from('location_pings').insert(pings);

      // Commit offset
      await resolveOffset(batch.messages[batch.messages.length - 1].offset);
      await heartbeat();
    },
  });
}

run().catch(console.error);
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Producer metrics:**
   - Message send rate
   - Send errors
   - Batch size

2. **Topic metrics:**
   - Messages in/sec
   - Lag per partition
   - Disk usage

3. **Consumer metrics:**
   - Lag (messages behind)
   - Processing time (p50, p95, p99)
   - Error rate

### Alerts

```yaml
# Datadog/Prometheus alerts
- name: Kafka Consumer Lag High
  condition: lag > 10000 messages
  action: Page on-call engineer

- name: GPS Ping Processing Slow
  condition: p95 > 5 seconds
  action: Scale up consumers

- name: Dead Letter Queue Growing
  condition: DLQ size > 1000
  action: Investigate failures
```

---

## Migration Path (PostgreSQL → Kafka)

### Phase 1: Dual Write (Week 1)

```typescript
async function sendGpsPing(ping: GpsPing) {
  // Write to both PostgreSQL and Kafka
  await Promise.all([
    supabase.from('location_pings').insert(ping), // Old path
    publishGpsPing(ping), // New path
  ]);
}
```

### Phase 2: Kafka Primary (Week 2)

```typescript
async function sendGpsPing(ping: GpsPing) {
  // Write to Kafka only
  await publishGpsPing(ping);
  // DB write happens via consumer
}
```

### Phase 3: Remove Old Path (Week 3)

```typescript
// Remove direct Supabase writes
// All GPS data flows through Kafka
```

---

## Disaster Recovery

### Kafka Broker Failure

**Detection:** Consumer lag spikes, producer send errors

**Recovery:**

1. Kafka automatically fails over to replica (if replication factor ≥ 2)
2. Monitor lag until recovered
3. No data loss (messages replicated)

### Consumer Failure

**Detection:** Consumer group lag increases

**Recovery:**

1. Kafka rebalances partitions to healthy consumers
2. Scale up consumer group if needed
3. Replay from last committed offset

### Data Corruption

**Recovery:**

1. Stop all consumers
2. Replay from specific offset or timestamp
3. Reprocess corrupted time range

Example:

```bash
# Reset consumer group to specific timestamp
kafka-consumer-groups.sh --reset-offsets \
  --group db-writer \
  --topic gps-pings \
  --to-datetime 2026-04-10T12:00:00.000 \
  --execute
```

---

## When NOT to Use Kafka

**Don't use Kafka if:**

- <500 drivers (<1,000 pings/min) → PostgreSQL handles this fine
- Tight budget (<$500/month) → Operational cost too high
- No Kafka expertise on team → Steep learning curve

**Alternatives:**

- **RabbitMQ:** Simpler, lower throughput
- **AWS SQS:** Managed, pay-per-use, lower performance
- **PostgreSQL LISTEN/NOTIFY:** Built-in, but not scalable

---

## Further Reading

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [KafkaJS Library](https://kafka.js.org/)
- [Confluent Best Practices](https://docs.confluent.io/kafka/operations-tools/kafka-tools.html)
- [Kafka Performance Tuning](https://docs.confluent.io/platform/current/kafka/deployment.html#performance-tuning)
