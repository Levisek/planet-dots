// Audit textur — pro každý JPG v textures/ detekuj dark hemisphere
// (>40% pixelů s RGB sum < 120). Output: textures/audit.json + console table.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEXDIR = path.join(ROOT, 'textures');
const OUTPUT = path.join(TEXDIR, 'audit.json');

async function auditTexture(filepath) {
  const buf = await fs.readFile(filepath);
  const img = sharp(buf, { failOn: 'none' });
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();

  let darkCount = 0;
  for (let i = 0; i < raw.length; i += 3) {
    if (raw[i] + raw[i+1] + raw[i+2] < 120) darkCount++;
  }
  return {
    width,
    height,
    darkRatio: darkCount / (width * height),
  };
}

const files = (await fs.readdir(TEXDIR)).filter(f => f.endsWith('.jpg'));
const audit = {};
for (const f of files) {
  const name = f.replace('.jpg', '');
  const result = await auditTexture(path.join(TEXDIR, f));
  audit[name] = {
    ...result,
    status: result.darkRatio > 0.40 ? 'incomplete' : 'ok',
  };
}

await fs.writeFile(OUTPUT, JSON.stringify(audit, null, 2));

console.log('\n=== Texture audit ===');
console.log('name'.padEnd(15), 'WxH'.padEnd(12), 'dark%', 'status');
for (const [name, info] of Object.entries(audit).sort((a, b) => b[1].darkRatio - a[1].darkRatio)) {
  console.log(
    name.padEnd(15),
    `${info.width}x${info.height}`.padEnd(12),
    `${(info.darkRatio * 100).toFixed(1)}%`.padEnd(7),
    info.status,
  );
}
