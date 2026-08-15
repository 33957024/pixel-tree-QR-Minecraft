'use strict';

/**
 * pixel-tree-qr — command-line + server entry point.
 *
 *   node index.js <url> [output.png] [--flat] [--theme=cherry]   Generate a PNG
 *   node index.js serve                                           Start the HTTP server
 */

const fs = require('fs');
const path = require('path');
const { generatePixelTreeQr } = require('./src/generate');

const [, , command, ...rest] = process.argv;

if (command === 'serve' || command === 'server' || command === 'start') {
  const { createApp } = require('./src/server');
  const port = Number(process.env.PORT) || 3000;
  const server = createApp().listen(port, () => {
    console.log(`Pixel-tree QR server listening on http://localhost:${port}`);
    console.log(`Tree:   http://localhost:${port}/?url=https://example.com`);
    console.log(`Scan:   http://localhost:${port}/?url=https://example.com&mode=flat`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[错误] 端口 ${port} 已被占用，请换一个端口重试，例如: start.bat 8080`);
    } else {
      console.error(`\n[错误] ${err.message}`);
    }
    process.exit(1);
  });
} else {
  const url = command;
  const opts = { mode: 'tree', theme: 'cherry' };
  let outPath = 'pixel-tree-qr.png';

  for (const a of rest) {
    if (a === '--flat') opts.mode = 'flat';
    else if (a.startsWith('--theme=')) opts.theme = a.slice(8);
    else if (!a.startsWith('--')) outPath = a;
  }

  if (!url) {
    console.error('Usage:');
    console.error('  node index.js <url> [output.png] [--flat] [--theme=cherry|summer|ginkgo|rainbow]');
    console.error('  node index.js serve                Start the HTTP server');
    process.exit(1);
  }

  try {
    const canvas = generatePixelTreeQr(url, opts);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`Saved ${canvas.width}x${canvas.height} PNG to ${path.resolve(outPath)} (${opts.mode} mode)`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
