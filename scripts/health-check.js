#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import chalk from 'chalk';
import fs from 'fs/promises';
import { execSync } from 'child_process';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(chalk.red('❌ Missing required environment variables'));
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const redis = new Redis({
  host: redisHost,
  port: parseInt(redisPort),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

async function checkDatabase() {
  try {
    const start = Date.now();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const duration = Date.now() - start;

    return {
      status: error ? 'fail' : 'pass',
      error: error?.message,
      responseTime: duration,
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
      responseTime: 0,
    };
  }
}

async function checkRedis() {
  try {
    const start = Date.now();
    await redis.ping();
    const duration = Date.now() - start;

    return {
      status: 'pass',
      responseTime: duration,
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
      responseTime: 0,
    };
  }
}

async function checkAPI() {
  try {
    const start = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
      },
    });
    const duration = Date.now() - start;

    return {
      status: response.ok ? 'pass' : 'fail',
      responseTime: duration,
      statusCode: response.status,
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
      responseTime: 0,
    };
  }
}

async function checkRLSPolicies() {
  try {
    // Check if RLS is enabled on key tables
    const tables = ['profiles', 'loads', 'trucks', 'bids', 'messages'];
    const results = [];

    for (const table of tables) {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, row_security')
        .eq('table_schema', 'public')
        .eq('table_name', table);

      if (error) {
        results.push({ table, rls_enabled: false, error: error.message });
      } else {
        results.push({
          table,
          rls_enabled: data?.[0]?.row_security === true,
          error: null,
        });
      }
    }

    const failedTables = results.filter((r) => !r.rls_enabled);

    return {
      status: failedTables.length === 0 ? 'pass' : 'fail',
      tablesWithoutRLS: failedTables.map((r) => r.table),
      details: results,
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
      tablesWithoutRLS: [],
    };
  }
}

async function checkWebhookDelivery() {
  try {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return {
        status: 'fail',
        error: error.message,
      };
    }

    const successRate =
      data?.length > 0 ? data.filter((d) => d.status === 'delivered').length / data.length : 1;

    return {
      status: successRate >= 0.9 ? 'pass' : 'fail',
      successRate: Math.round(successRate * 100),
      totalDeliveries: data?.length || 0,
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
    };
  }
}

async function checkJobQueue() {
  try {
    // Check if BullMQ is configured (this would need actual BullMQ setup)
    // For now, just check if Redis is working which is required for queues
    const redisCheck = await checkRedis();

    return {
      status: redisCheck.status === 'pass' ? 'pass' : 'fail',
      redisWorking: redisCheck.status === 'pass',
    };
  } catch (e) {
    return {
      status: 'fail',
      error: e.message,
    };
  }
}

async function checkDependencies() {
  try {
    const output = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
    const audit = JSON.parse(output);

    return {
      status: audit.metadata?.vulnerabilities?.total === 0 ? 'pass' : 'fail',
      vulnerabilities: audit.metadata?.vulnerabilities || {},
    };
  } catch (e) {
    // npm audit returns non-zero exit code when vulnerabilities found
    try {
      const output = e.stdout?.toString() || e.stderr?.toString() || '';
      const audit = JSON.parse(output);

      return {
        status: audit.metadata?.vulnerabilities?.total === 0 ? 'pass' : 'fail',
        vulnerabilities: audit.metadata?.vulnerabilities || {},
      };
    } catch {
      return {
        status: 'fail',
        error: 'Unable to parse npm audit output',
      };
    }
  }
}

async function runHealthCheck() {
  console.log(chalk.blue.bold('\n🏥 FreightX Health Check\n'));
  console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}\n`));

  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    api: await checkAPI(),
    rls: await checkRLSPolicies(),
    webhookDelivery: await checkWebhookDelivery(),
    jobQueue: await checkJobQueue(),
    dependencies: await checkDependencies(),
  };

  // Print results
  for (const [name, result] of Object.entries(checks)) {
    const icon = result.status === 'pass' ? '✅' : '❌';
    const color = result.status === 'pass' ? chalk.green : chalk.red;
    const nameDisplay = name.replace(/([A-Z])/g, ' $1').toLowerCase();

    console.log(color(`${icon} ${nameDisplay.toUpperCase()}: ${result.status}`));

    if (result.error) {
      console.log(chalk.red(`   Error: ${result.error}`));
    }

    if (result.responseTime) {
      console.log(chalk.gray(`   Response time: ${result.responseTime}ms`));
    }

    if (result.statusCode) {
      console.log(chalk.gray(`   Status code: ${result.statusCode}`));
    }

    if (result.tablesWithoutRLS?.length > 0) {
      console.log(chalk.red(`   Tables without RLS: ${result.tablesWithoutRLS.join(', ')}`));
    }

    if (result.successRate !== undefined) {
      console.log(chalk.gray(`   Success rate: ${result.successRate}%`));
    }

    if (result.vulnerabilities) {
      const vulns = result.vulnerabilities;
      console.log(chalk.yellow(`   Vulnerabilities: ${JSON.stringify(vulns)}`));
    }

    console.log('');
  }

  const allPassed = Object.values(checks).every((c) => c.status === 'pass');
  const passedCount = Object.values(checks).filter((c) => c.status === 'pass').length;
  const totalCount = Object.values(checks).length;

  console.log(
    allPassed
      ? chalk.green.bold(`✅ All checks passed! (${passedCount}/${totalCount})`)
      : chalk.red.bold(
          `❌ ${totalCount - passedCount} checks failed! (${passedCount}/${totalCount})`,
        ),
  );

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    checks,
    overall: allPassed ? 'healthy' : 'unhealthy',
    summary: {
      passed: passedCount,
      total: totalCount,
      successRate: Math.round((passedCount / totalCount) * 100),
    },
  };

  try {
    await fs.writeFile('health-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.gray('\n📊 Report saved to health-report.json'));
  } catch (e) {
    console.error(chalk.red('❌ Failed to save report:', e.message));
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Unhandled promise rejection:'), error);
  process.exit(1);
});

runHealthCheck();
