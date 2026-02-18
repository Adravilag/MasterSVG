const fs = require('fs');
const path = require('path');

const spritePath = path.join(process.cwd(), 'dist', 'sprite.svg');
const outDir = path.join(process.cwd(), 'src', 'icons');
const out = path.join(outDir, 'types.d.ts');

if (!fs.existsSync(spritePath)) {
  console.error('sprite.svg not found at', spritePath);
  process.exit(1);
}

const content = fs.readFileSync(spritePath, 'utf8');
const ids = [...content.matchAll(/<symbol[^>]*id=["']([^"']+)["']/g)].map(m => m[1]);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const typeContent = `export type IconId = ${ids.map(id => `'${id}'`).join(' | ') || "string"};\n`;
fs.writeFileSync(out, typeContent, 'utf8');
console.log('Wrote', out);
