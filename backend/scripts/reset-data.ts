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

console.log(`[reset-data] Resetting ${TARGET_DIR} from seeds`);

for (const file of SEED_FILES) {
  const seedPath = path.join(SEED_DIR, file);
  const rootPath = path.join(__dirname, '../../data', file);
  const src = fs.existsSync(seedPath) ? seedPath : rootPath;
  const dest = path.join(TARGET_DIR, file);
  if (!fs.existsSync(src)) {
    console.warn(`[reset-data] Skip missing seed: ${file}`);
    continue;
  }
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[reset-data] Restored: ${file}`);
}

console.log('[reset-data] Done');
