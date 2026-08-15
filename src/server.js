'use strict';

/**
 * Optional Express HTTP interface.
 *
 *   GET /                       -> the front-end UI (public/index.html)
 *   GET /?url=https://...       -> tree image (image/png)
 *   GET /?url=...&mode=flat     -> scannable flat QR (image/png)
 *   GET /?url=...&theme=summer  -> theme (cherry|summer|ginkgo|rainbow)
 */

const path = require('path');
const express = require('express');
const { generatePixelTreeQr } = require('./generate');

function createApp() {
  const app = express();

  // Serve the front-end assets (app.js, vendor/qrcode.js, ...). `index: false`
  // so that `GET /` falls through to the route below (which serves index.html
  // when no `url` is given, and a PNG image otherwise).
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

  app.get('/', (req, res) => {
    // No URL -> serve the front-end UI.
    if (!req.query.url) {
      return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }

    const url = req.query.url;
    try {
      const options = {};
      if (req.query.mode !== undefined) options.mode = req.query.mode;
      if (req.query.theme !== undefined) options.theme = req.query.theme;
      if (req.query.seed !== undefined) options.seed = req.query.seed;
      if (req.query.scale !== undefined) options.scale = parseInt(req.query.scale, 10);
      if (req.query.quietZone !== undefined) options.quietZone = parseInt(req.query.quietZone, 10);
      if (req.query.errorCorrection !== undefined) options.errorCorrection = req.query.errorCorrection;

      const canvas = generatePixelTreeQr(url, options);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(canvas.toBuffer('image/png'));
    } catch (err) {
      res
        .status(500)
        .type('text/plain')
        .send(`Failed to generate QR: ${err.message}`);
    }
  });

  return app;
}

module.exports = { createApp };
