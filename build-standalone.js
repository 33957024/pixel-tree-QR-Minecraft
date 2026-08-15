'use strict';

/**
 * Build a fully self-contained `pixel-tree.html` — no server, no node_modules.
 *
 * It inlines `public/blocks.js`, `qrcode-generator` and `public/app.js` into
 * `public/index.html`, producing a single file you can double-click to open
 * (file://) or share.
 *
 *   node build-standalone.js
 */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, 'public', 'index.html');
const blocksPath = path.join(root, 'public', 'blocks.js');
const qrPath = path.join(root, 'node_modules', 'qrcode-generator', 'qrcode.js');
const appPath = path.join(root, 'public', 'app.js');
const outPath = path.join(root, 'pixel-tree.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const blocks = fs.readFileSync(blocksPath, 'utf8');
const qr = fs.readFileSync(qrPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');

// Defensively escape any accidental closing script tag in the inlined code.
const inline = (src) => '<script>\n' + src.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';

const out = html
  // Use a function replacement so `$` sequences in the JS are taken literally.
  .replace('<script src="/blocks.js"></script>', () => inline(blocks))
  .replace('<script src="/vendor/qrcode.js"></script>', () => inline(qr))
  .replace('<script src="/app.js"></script>', () => inline(app));

fs.writeFileSync(outPath, out);
console.log(`Generated ${path.basename(outPath)} (${(out.length / 1024).toFixed(1)} KB).`);
console.log('Open it directly in a browser — no server or dependencies needed.');
