'use strict';

/**
 * Smoke test:
 *   1. The FLAT view must decode back to the original URL (scannable).
 *   2. The TREE view must render cleanly for every theme.
 * Run with `npm test`.
 */

const { generateTreeQr, generateFlatQr } = require('./src/generate');

const URL = 'https://example.com/pixel-tree-test';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (buf) => PNG_SIGNATURE.every((b, i) => buf[i] === b);

let failed = false;

// 1. Tree view — render every theme without error.
console.log('--- tree view ---');
for (const theme of ['cherry', 'summer', 'ginkgo', 'rainbow']) {
  const canvas = generateTreeQr(URL, { theme });
  const buf = canvas.toBuffer('image/png');
  const ok = isPng(buf);
  failed = failed || !ok;
  console.log(`  ${theme.padEnd(8)} ${canvas.width}x${canvas.height}px  ${buf.length}B  ${ok ? 'OK' : 'FAIL'}`);
}

// 2. Flat view — verify it decodes back to the URL.
console.log('--- flat view ---');
const flat = generateFlatQr(URL, { scale: 16, seed: 'unit-test' });
const fbuf = flat.toBuffer('image/png');
const signatureOk = isPng(fbuf);
console.log(`  PNG signature : ${signatureOk ? 'OK' : 'FAIL'}`);
console.log(`  Dimensions    : ${flat.width}x${flat.height}px (${fbuf.length} bytes)`);
failed = failed || !signatureOk;

let jsQR = null;
try {
  jsQR = require('jsqr');
} catch (err) {
  jsQR = null;
}

if (jsQR) {
  const { createCanvas } = require('@napi-rs/canvas');
  const img = createCanvas(flat.width, flat.height);
  const ctx = img.getContext('2d');
  ctx.drawImage(flat, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, flat.width, flat.height);
  const code = jsQR(data, width, height);
  if (code && code.data === URL) {
    console.log(`  Decode        : OK -> ${code.data}`);
  } else {
    failed = true;
    console.log(`  Decode        : FAIL (${code ? 'got "' + code.data + '"' : 'no code found'})`);
  }
} else {
  console.log('  Decode        : SKIPPED (jsqr not installed)');
}

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
