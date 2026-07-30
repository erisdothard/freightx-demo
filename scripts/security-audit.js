#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(chalk.red('Missing required environment variables'));
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function checkDependencies() {
  console.log(chalk.blue('Checking dependencies for vulnerabilities...'));
  try {
    const output = execSync('npm audit --json', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const audit = JSON.parse(output);

    return {
      status: audit.metadata?.vulnerabilities?.total === 0 ? 'pass' : 'fail',
      vulnerabilities: audit.metadata?.vulnerabilities || {},
      details: audit.vulnerabilities || {},
    };
  } catch (e) {
    // npm audit returns non-zero exit code when vulnerabilities found
    try {
      const output = e.stdout?.toString() || e.stderr?.toString() || '';
      const audit = JSON.parse(output);

      return {
        status: audit.metadata?.vulnerabilities?.total === 0 ? 'pass' : 'fail',
        vulnerabilities: audit.metadata?.vulnerabilities || {},
        details: audit.vulnerabilities || {},
      };
    } catch {
      return {
        status: 'fail',
        error: 'Unable to parse npm audit output',
        vulnerabilities: {},
      };
    }
  }
}

async function checkSecrets() {
  console.log(chalk.blue('Checking for exposed secrets...'));

  const patterns = [
    {
      name: 'Supabase Service Role Key',
      pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i,
    },
    {
      name: 'Stripe Secret Key',
      pattern: /STRIPE_SECRET_KEY\s*=\s*['"][^'"]+['"]/i,
    },
  ];

  const results = [];
  const srcDir = path.resolve('apps/web/src');

  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        await scanDir(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = await fs.readFile(full, 'utf-8');
        for (const { name, pattern } of patterns) {
          if (pattern.test(content)) {
            results.push({ file: full, secret: name });
          }
        }
      }
    }
  }

  await scanDir(srcDir);

  return {
    status: results.length === 0 ? 'pass' : 'fail',
    exposed: results,
  };
}

async function main() {
  console.log(chalk.bold('\nFreightX Security Audit\n'));

  const deps = await checkDependencies();
  const secrets = await checkSecrets();

  console.log(
    deps.status === 'pass' ? chalk.green('Dependencies: PASS') : chalk.red('Dependencies: FAIL'),
  );

  console.log(
    secrets.status === 'pass' ? chalk.green('Secrets: PASS') : chalk.red('Secrets: FAIL'),
  );

  if (secrets.exposed?.length > 0) {
    for (const s of secrets.exposed) {
      console.log(chalk.red(`  ${s.secret} found in ${s.file}`));
    }
  }

  const failed = deps.status === 'fail' || secrets.status === 'fail';
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
