import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';

const SEED_DIR = path.join(__dirname, 'data', 'seeds');
const TARGET_DIR = config.dataDir;

const SEED_FILES = [
  'planningOrders.json',
  'operations.json',
  'components.json',
  'materials.json',
  'batches.json',
  'tricCases.json',
  'inspectionLots.json',
  'resources.json',
  'capacityBuckets.json',
  'planningHorizons.json',
  'planningResults.json',
  'setupMatrix.json',
  'workCenters.json',
  'productionLines.json',
  'lineCalendars.json',
  'exceptions.json',
];

function copySeedFile(filename: string, force: boolean): void {
  const seedPath = path.join(SEED_DIR, filename);
  const rootPath = path.join(__dirname, '../../data', filename);
  const src = fs.existsSync(seedPath) ? seedPath : rootPath;
  const dest = path.join(TARGET_DIR, filename);
  if (!fs.existsSync(src)) {
    console.warn(`[seed] Skip missing seed: ${filename}`);
    return;
  }
  if (fs.existsSync(dest) && !force) {
    console.log(`[seed] Keep existing: ${filename}`);
    return;
  }
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[seed] Copied: ${filename}`);
}

const force = process.argv.includes('--force');

console.log(`[seed] Target data dir: ${TARGET_DIR}`);
for (const file of SEED_FILES) {
  copySeedFile(file, force);
}
console.log('[seed] Done');
