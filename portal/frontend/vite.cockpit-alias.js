import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalSrc = path.resolve(__dirname, './src');
const cockpitSrc = path.resolve(__dirname, '../../cockpit/src');
const configDir = path.resolve(__dirname, '../../config');

function existsAsModule(basePath) {
  const fileCandidates = [`${basePath}.js`, `${basePath}.vue`, `${basePath}.json`];
  for (const candidate of fileCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const indexCandidate = path.join(basePath, 'index.js');
  if (fs.existsSync(indexCandidate)) {
    return indexCandidate;
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  return null;
}

function isCockpitImporter(importer) {
  if (!importer) return false;
  return importer.replace(/\\/g, '/').includes('/cockpit/src/');
}

export function cockpitAliasPlugin() {
  return {
    name: 'cockpit-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('@config/')) {
        return path.resolve(configDir, source.slice('@config/'.length));
      }

      if (!source.startsWith('@/')) {
        return null;
      }

      const rel = source.slice(2);
      const bases = isCockpitImporter(importer)
        ? [cockpitSrc, portalSrc]
        : [portalSrc, cockpitSrc];

      for (const base of bases) {
        const candidate = existsAsModule(path.resolve(base, rel));
        if (candidate) {
          return candidate;
        }
      }

      return path.resolve(cockpitSrc, rel);
    },
  };
}
