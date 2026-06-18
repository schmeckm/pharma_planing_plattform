#!/usr/bin/env node
/**
 * Phase E — reset mock demo environment for cockpit walkthroughs.
 * - Regenerates playable JSON master data (E1)
 * - Archives + trims auditTrail, jobs, whatIf (E2)
 *
 * Usage:
 *   node scripts/reset-demo-environment.js [orderCount] [batchCount] [historicalCount]
 *   npm run reset:demo
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DATA_DIR = process.env.HAP_DATA_DIR || path.join(__dirname, '../data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const ORDER_COUNT = process.argv[2] || '60';
const BATCH_COUNT = process.argv[3] || '96';
const HISTORICAL_COUNT = process.argv[4] || '120';
const AUDIT_KEEP = parseInt(process.env.HAP_AUDIT_KEEP || '20', 10);
const ARCHIVE_THRESHOLD_BYTES = parseInt(process.env.HAP_AUDIT_ARCHIVE_BYTES || '500000', 10);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function archiveIfLarge(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (stat.size < ARCHIVE_THRESHOLD_BYTES) return null;
  ensureDir(ARCHIVE_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(ARCHIVE_DIR, `${fileName.replace('.json', '')}-${stamp}.json`);
  fs.renameSync(filePath, dest);
  console.log(`  ↪ archived ${fileName} (${Math.round(stat.size / 1024)} KB) → ${path.basename(dest)}`);
  return dest;
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : data.items?.length ?? '?';
  console.log(`  ✓ ${name}.json (${count} records)`);
}

function seedAuditTrail() {
  const existingPath = path.join(DATA_DIR, 'auditTrail.json');
  let seedItems = [];

  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
      seedItems = (existing.items || []).slice(-AUDIT_KEEP);
    } catch {
      seedItems = [];
    }
  }

  if (!seedItems.length) {
    seedItems = [
      {
        decisionId: 'DEC-DEMO-001',
        timestamp: new Date().toISOString(),
        packagingOrderId: 'FG-20001',
        batchId: 'BATCH-0001',
        allocatedQuantity: 2000,
        status: 'SIMULATED',
        destinationCountry: 'DE',
        executionMode: 'SIMULATE',
        userId: 'USR-PLANNER01',
        explanation: 'Demo seed — compliant allocation for FG-20001',
        ruleChecks: [],
        gmpAudit: { immutable: true, complianceFirst: true, recordedAt: new Date().toISOString() },
      },
      {
        decisionId: 'DEC-DEMO-002',
        timestamp: new Date().toISOString(),
        packagingOrderId: 'FG-20002',
        batchId: 'BATCH-0017',
        allocatedQuantity: 3000,
        status: 'SIMULATED',
        destinationCountry: 'GB',
        executionMode: 'SIMULATE',
        userId: 'USR-PLANNER01',
        explanation: 'Demo seed — GB market release passed',
        ruleChecks: [],
        gmpAudit: { immutable: true, complianceFirst: true, recordedAt: new Date().toISOString() },
      },
    ];
  }

  writeJson('auditTrail', {
    repositoryVersion: '1.0.0',
    label: 'Demo audit trail (trimmed)',
    items: seedItems,
  });
}

function trimHeavyCollections() {
  archiveIfLarge('auditTrail.json');
  archiveIfLarge('jobs.json');
  archiveIfLarge('whatIfScenarios.json');

  writeJson('jobs', {
    repositoryVersion: '1.0.0',
    items: [],
    label: 'Reset — start Mass Allocation from cockpit',
  });

  writeJson('whatIfScenarios', {
    repositoryVersion: '1.0.0',
    items: [],
    label: 'Reset — run What-If from cockpit',
  });

  writeJson('sequenceScenarios', {
    repositoryVersion: '1.0.0',
    items: [],
    label: 'Reset — optimize via Production Sequencing',
  });

  seedAuditTrail();
}

function runGenerator() {
  const script = path.join(__dirname, 'generate-demo-data.js');
  const result = spawnSync(
    process.execPath,
    [script, ORDER_COUNT, BATCH_COUNT, HISTORICAL_COUNT],
    { stdio: 'inherit', env: { ...process.env, HAP_DATA_DIR: DATA_DIR } },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}

function main() {
  console.log('\n== Hard Allocation — reset demo environment (Phase E) ==\n');
  console.log(`  orders=${ORDER_COUNT} batches=${BATCH_COUNT} historical=${HISTORICAL_COUNT}\n`);

  console.log('Step 1 — trim / archive heavy JSON (E2)');
  trimHeavyCollections();

  console.log('\nStep 2 — regenerate mock master data (E1)');
  runGenerator();

  console.log('\nReady. Start stack: .\\scripts\\start.ps1 dev\n');
}

main();
