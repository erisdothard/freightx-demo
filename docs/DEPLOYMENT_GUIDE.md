# FreightX — Deployment Guide

**Purpose:** Step-by-step guide to deploy Phase 6 infrastructure  
**Time Required:** 30-60 minutes

---

## 📋 Prerequisites

- [ ] Supabase project created
- [ ] Vercel account set up
- [ ] Git repository connected
- [ ] Environment variables configured

---

## 🚀 Phase 6 Deployment Steps

### Step 1: Deploy Webhook Migration (5 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/009-webhooks.sql`
3. Paste and run the migration
4. Verify tables created:
   ```sql
   SELECT * FROM webhooks LIMIT 1;
   SELECT * FROM webhook_deliveries LIMIT 1;
   ```

**Expected Result:** Both tables exist with proper schema

---

### Step 2: Deploy Edge Functions (10 minutes)

```bash
# Navigate to project root
cd /Users/erisdothard/Desktop/FreightX

# Install Supabase CLI if not already installed
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy webhook delivery function
supabase functions deploy webhook-delivery

# Deploy health check function
supabase functions deploy health

# Test health endpoint
curl https://your-project.supabase.co/functions/v1/health
```

**Expected Result:** Both functions deployed successfully, health endpoint returns JSON

---

### Step 3: Set Up Webhook Cron Job (5 minutes)

**Option A: Supabase Cron (Recommended)**

Add to Supabase Dashboard → Database → Cron Jobs:

```sql
-- Run webhook delivery every minute
SELECT cron.schedule(
  'webhook-delivery',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/webhook-delivery',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

**Option B: External Cron Service**

Use cron-job.org or EasyCron:

- URL: `https://your-project.supabase.co/functions/v1/webhook-delivery`
- Method: POST
- Header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- Schedule: Every 1 minute

---

### Step 4: Set Up Rate Limiting (15 minutes)

1. **Sign up for Upstash Redis**
   - Visit: https://upstash.com
   - Create free account
   - Create new Redis database
   - Copy REST URL and Token

2. **Install Dependencies**

   ```bash
   cd apps/web
   pnpm add @upstash/ratelimit @upstash/redis
   ```

3. **Add to Environment Variables**

   Update `apps/web/.env.local`:

   ```bash
   VITE_UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   VITE_UPSTASH_REDIS_REST_TOKEN=your-token-here
   ```

4. **Test Rate Limiting**

   ```typescript
   // In any service file
   import { rateLimiters, enforceRateLimit } from '@/lib/rate-limit';

   // Before creating a load
   await enforceRateLimit(rateLimiters.loadPost, userId);
   ```

---

### Step 5: Configure Monitoring (10 minutes)

1. **Set Up Uptime Monitoring**
   - Sign up at BetterStack.com or UptimeRobot.com
   - Add monitor for health endpoint:
     - URL: `https://your-project.supabase.co/functions/v1/health`
     - Check interval: 1 minute
     - Alert on: Status code != 200

2. **Configure Sentry Alerts**
   - Open Sentry.io → Your Project → Alerts
   - Create alert rule:
     - Condition: Error count > 10 in 5 minutes
     - Action: Email notification

3. **Test Health Check Script**

   ```bash
   # Install dependencies
   pnpm add -D chalk

   # Run health check
   node scripts/health-check.js
   ```

---

### Step 6: Verify Deployment (5 minutes)

Run through this checklist:

- [ ] Webhook migration applied successfully
- [ ] Edge Functions deployed and accessible
- [ ] Webhook cron job running (check logs)
- [ ] Rate limiting configured (test with API call)
- [ ] Health check endpoint monitored
- [ ] Sentry alerts configured
- [ ] Health check script runs successfully

---

## 🧪 Testing Your Deployment

### Test Webhook System

1. **Create a test webhook:**

   ```sql
   INSERT INTO webhooks (company_id, url, events, secret)
   VALUES (
     'your-company-id',
     'https://webhook.site/unique-url', -- Get from webhook.site
     ARRAY['load.created'],
     'test-secret-key'
   );
   ```

2. **Trigger a webhook event:**

   ```sql
   SELECT trigger_webhook_event(
     'load.created',
     '{"load_id": "test-123", "status": "posted"}'::jsonb
   );
   ```

3. **Check webhook.site** - You should see the delivery

### Test Rate Limiting

```typescript
// Make 101 requests rapidly (should fail on 101st)
for (let i = 0; i < 101; i++) {
  try {
    await enforceRateLimit(rateLimiters.api, 'test-user');
    console.log(`Request ${i + 1}: Success`);
  } catch (error) {
    console.log(`Request ${i + 1}: Rate limited!`);
  }
}
```

### Test Health Check

```bash
# Run automated health check
node scripts/health-check.js

# Should output:
# ✅ DATABASE: PASS
# ✅ API: PASS
# ✅ Edge Functions: PASS
# ✅ Tables: PASS
# ✅ All checks passed!
```

---

## 📊 Monitoring Dashboard

After deployment, monitor these metrics:

### Critical Metrics

- **API Response Time:** < 200ms (p95)
- **Webhook Delivery Success Rate:** > 99%
- **Database Query Time:** < 100ms (p95)
- **Uptime:** > 99.9%
- **Error Rate:** < 0.1%

### Where to Check

- **Supabase Dashboard:** Database performance, API logs
- **Vercel Dashboard:** Frontend performance, build status
- **Sentry:** Error tracking, performance monitoring
- **Uptime Monitor:** Service availability
- **Health Check Script:** Run daily via cron

---

## 🔧 Troubleshooting

### Edge Functions Not Deploying

```bash
# Check Supabase CLI version
supabase --version

# Update if needed
brew upgrade supabase

# Re-link project
supabase link --project-ref your-project-ref

# Try deploying again
supabase functions deploy webhook-delivery --debug
```

### Webhooks Not Delivering

1. Check webhook_deliveries table for errors:

   ```sql
   SELECT * FROM webhook_deliveries
   WHERE failed_at IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. Verify cron job is running:

   ```sql
   SELECT * FROM cron.job WHERE jobname = 'webhook-delivery';
   ```

3. Check Edge Function logs in Supabase Dashboard

### Rate Limiting Not Working

1. Verify Upstash credentials in .env.local
2. Check Redis connection:
   ```typescript
   import { Redis } from '@upstash/redis';
   const redis = new Redis({
     url: process.env.VITE_UPSTASH_REDIS_REST_URL,
     token: process.env.VITE_UPSTASH_REDIS_REST_TOKEN,
   });
   await redis.ping(); // Should return "PONG"
   ```

---

## 🎯 Success Criteria

Your Phase 6 deployment is complete when:

- [x] All Edge Functions deployed and accessible
- [x] Webhook system processing deliveries
- [x] Rate limiting active on API endpoints
- [x] Health check endpoint monitored
- [x] Sentry capturing errors
- [x] All tests passing

---

## 📚 Next Steps

After completing Phase 6:

1. **Phase 7:** Build automation scripts
   - Security audit script
   - Deployment automation
   - Developer SDK

2. **Phase 8:** Create study guide app
   - FreightX Academy
   - Interactive diagrams
   - CEO presentation

---

## 🆘 Need Help?

- **Documentation:** See `docs/PHASE6_GUIDE.md`
- **Status:** Check `docs/IMPLEMENTATION_STATUS.md`
- **Issues:** Review `docs/POST_DEVELOPMENT_CHECKLIST.md`

---

_Last updated: February 19, 2026_
