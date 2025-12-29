const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flatten(obj, prefix = '') {
  const res = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flatten(v, key));
    } else {
      res[key] = v;
    }
  }
  return res;
}

const localesDir = path.join(__dirname, '..', 'l10n');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
const data = {};
for (const f of files) {
  data[f] = flatten(readJson(path.join(localesDir, f)));
}

const baseFile = 'en.json';
if (!data[baseFile]) {
  console.error('Base locale en.json not found');
  process.exit(1);
}

const baseKeys = Object.keys(data[baseFile]).sort();
console.log('Locales found:', files.join(', '));
console.log('Total keys in en.json:', baseKeys.length);
console.log('---');

for (const f of files) {
  if (f === baseFile) continue;
  const keys = Object.keys(data[f]);
  const missing = baseKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !baseKeys.includes(k));
  console.log(`Locale: ${f}`);
  console.log(`  keys: ${keys.length}`);
  console.log(`  missing compared to en.json: ${missing.length}`);
  if (missing.length) console.log('    -', missing.join('\n    - '));
  console.log(`  extra keys not in en.json: ${extra.length}`);
  if (extra.length) console.log('    -', extra.join('\n    - '));
  console.log('');
}

// Also list all translation keys used in code via simple grep of t('\nconst { execSync } = require('child_process');
try {
  const out = execSync(
    'git grep -n "t(\'\|t(\"\) -- src || true',
    { encoding: 'utf8' }
  );
  console.log('Translation function usages in code (git grep):');
  console.log(out);
} catch (e) {
  console.log('Could not run git grep for usages (maybe not a git repo). Skipping.');
}
