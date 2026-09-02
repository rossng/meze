// Image pipeline: download each source photo listed in seed/photos.json,
// centre-crop to 4:3, and write a crushed WebP at two sizes into public/img.
//   node scripts/images.mjs            # only missing images
//   node scripts/images.mjs --force    # regenerate everything
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'img');
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'seed', 'photos.json'), 'utf8'));
const force = process.argv.includes('--force');

const SIZES = [
  { suffix: '', width: 800, height: 600, quality: 72 },
  { suffix: '-thumb', width: 320, height: 240, quality: 68 },
];

async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'meze-night-image-pipeline/0.1 (dev tooling)' } }).catch(() => null);
    if (res?.ok) return Buffer.from(await res.arrayBuffer());
    const wait = 3000 * 2 ** i;
    console.log(`  ${res ? 'HTTP ' + res.status : 'network error'}, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error('gave up after retries');
}

await fs.mkdir(OUT, { recursive: true });
let done = 0, skipped = 0, failed = 0;
for (const [id, { source }] of Object.entries(manifest)) {
  const targets = SIZES.map((s) => path.join(OUT, `${id}${s.suffix}.webp`));
  const exists = await Promise.all(targets.map((t) => fs.access(t).then(() => true, () => false)));
  if (!force && exists.every(Boolean)) { skipped++; continue; }
  try {
    // Ask Commons for a 1200px render rather than the multi-megabyte original;
    // it is plenty for an 800px output and far less likely to be throttled.
    const url = source.includes('wikimedia.org') ? `${source}?width=1200` : source;
    const input = await fetchWithRetry(url);
    const base = sharp(input, { failOn: 'none' }).rotate(); // honour EXIF orientation
    for (const [i, s] of SIZES.entries()) {
      await base.clone()
        .resize(s.width, s.height, { fit: 'cover', position: 'attention', withoutEnlargement: false })
        .webp({ quality: s.quality, effort: 6 })
        .toFile(targets[i]);
    }
    const sizes = await Promise.all(targets.map(async (t) => (await fs.stat(t)).size));
    console.log(`${id}: ${(input.length / 1024).toFixed(0)}kB -> ${sizes.map((b) => (b / 1024).toFixed(0) + 'kB').join(' / ')}`);
    done++;
  } catch (e) {
    console.error(`${id}: FAILED ${e.message}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 1500)); // be polite to Commons
}
console.log(`processed ${done}, skipped ${skipped}, failed ${failed}`);
if (failed) process.exit(1);
