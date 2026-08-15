'use strict';

/**
 * Browser-side renderer + animated "tree <-> flat QR" transition.
 *
 * The tree is drawn as an isometric 3D scene (leaves / trunk / QR ground).
 * Clicking "查看二维码" smoothly rotates and flattens it into a top-down,
 * scannable square QR — exactly like the reference site's toggle.
 *
 * Requires `qrcode-generator` (window.qrcode) loaded before this script.
 */

(function () {
  var W = 1152, H = 928; // fixed internal canvas resolution

  // ---- palettes ----------------------------------------------------------

  var THEMES = {
    cherry: { label: '樱花粉', treeLabel: '樱花树', top: ['#ffd1df', '#f8aec8', '#ef91b4', '#f4b2cc'], flat: ['#9d4667', '#873653', '#a64d70', '#793047'] },
    summer: { label: '夏日绿', treeLabel: '夏日树', top: ['#b8dc72', '#77bd68', '#4fa76a', '#91c96a'], flat: ['#3d6f39', '#285f3d', '#1f654e', '#356d3c'] },
    ginkgo: { label: '银杏黄', treeLabel: '银杏树', top: ['#fff08a', '#f4d94e', '#e8bf35', '#f6df68'], flat: ['#bd8b16', '#ae7800', '#c4931d', '#b78109'] },
    rainbow: { label: '渐变彩虹', treeLabel: '彩虹树', top: ['#f58fbd', '#ef5350', '#f7943d', '#f2d54a', '#54c7c2', '#4fa66d'], flat: ['#a82962', '#a12e2e', '#9a4e16', '#7d6812', '#176f70', '#236743'] },
    custom: { label: '自定义配色', treeLabel: '自定义树', top: [], flat: [] }
  };

  var STRUCTURE = {
    soil: { top: '#e3dbc6', left: '#c9bea5', right: '#d5cbb4' },
    'shadow-soil': { top: '#a9ad86', left: '#788169', right: '#909a78' },
    moss: { top: '#587a4b', left: '#355f43', right: '#466b46' },
    shade: { top: '#6f853f', left: '#3f613e', right: '#526f40' },
    wood: { top: '#6a4a32', left: '#463024', right: '#573b2a' },
    leaf: { top: '#52c7a5', left: '#146b6a', right: '#329b84' }
  };

  var FLAT_STRUCTURE = {
    soil: '#f2eddf', 'shadow-soil': '#f2eddf',
    moss: '#355f43', shade: '#587540', wood: '#553725', leaf: '#146b6a'
  };

  // ---- math / colour -----------------------------------------------------

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function hexToRgb(c) {
    if (c.charAt(0) === '#') {
      return { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16) };
    }
    var m = c.match(/[\d.]+/g);
    return (!m || m.length < 3) ? { r: 0, g: 0, b: 0 } : { r: +m[0], g: +m[1], b: +m[2] };
  }
  function mix(a, b, t) {
    var ca = hexToRgb(a), cb = hexToRgb(b);
    return 'rgb(' + Math.round(lerp(ca.r, cb.r, t)) + ' ' + Math.round(lerp(ca.g, cb.g, t)) + ' ' + Math.round(lerp(ca.b, cb.b, t)) + ')';
  }
  function samplePalette(arr, t) {
    var n = t * (arr.length - 1);
    var i = Math.min(Math.floor(n), arr.length - 2);
    return mix(arr[i], arr[i + 1], n - i);
  }
  function jitter(x, z, y) {
    var s = Math.sin(x * 91.7 + z * 247.3 + (y || 0) * 37.1) * 15347.31;
    return s - Math.floor(s);
  }

  // ---- matrix + scene ----------------------------------------------------

  function getMatrix(url) {
    var qr = qrcode(0, 'H');
    qr.addData(url, 'Byte');
    qr.make();
    var n = qr.getModuleCount();
    var m = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  }

  function buildScene(matrix) {
    var n = matrix.length;
    var center = (n - 1) / 2;
    var canopyR = n * 0.43;
    var blocks = [];

    for (var z = 0; z < n; z++) {
      for (var x = 0; x < n; x++) {
        var dark = matrix[z][x];
        var d = Math.hypot(x - center, z - center);
        var kind = d < canopyR * 0.9 ? 'shadow-soil' : 'soil';
        if (dark && d < 2.25) kind = 'wood';
        else if (dark && d < canopyR) kind = 'shade';
        else if (dark) kind = 'moss';
        blocks.push({ x: x, z: z, y: 0, kind: kind, extra: false, jitter: jitter(x, z) });
      }
    }
    for (var z2 = 0; z2 < n; z2++) {
      for (var x2 = 0; x2 < n; x2++) {
        if (matrix[z2][x2] && Math.hypot(x2 - center, z2 - center) < 2.05) {
          for (var y = 1; y <= 8; y++) blocks.push({ x: x2, z: z2, y: y, kind: 'wood', extra: true, jitter: jitter(x2, z2, y) });
        }
      }
    }
    for (var z3 = 0; z3 < n; z3++) {
      for (var x3 = 0; x3 < n; x3++) {
        if (!matrix[z3][x3]) continue;
        var d2 = Math.hypot(x3 - center, z3 - center);
        if (d2 < canopyR) {
          var t = 1 - d2 / canopyR;
          var count = 3 + Math.floor(4 * t * t + jitter(x3, z3, 11) * 2);
          for (var i = 0; i < count; i++) {
            blocks.push({ x: x3, z: z3, y: 9 + i + Math.floor(t * 2), kind: 'leaf', extra: true, jitter: jitter(x3, z3, i + 20) });
          }
        }
      }
    }

    // Last block written at each cell (a leaf for canopy cells) = flat-mode colour.
    var cellBlock = Array.from({ length: n }, function () { return Array(n).fill(null); });
    blocks.forEach(function (b) { cellBlock[b.z][b.x] = b; });

    return { blocks: blocks, cellBlock: cellBlock };
  }

  // ---- colours -----------------------------------------------------------

  function leafPos(b) {
    if (state.theme === 'rainbow') return clamp01((18 - b.y) / 9 + (b.jitter - 0.5) * 0.04);
    if (state.theme === 'custom') return clamp01((b.y - 9) / 9); // bottom -> top
    return b.jitter; // built-in themes: deterministic random per leaf
  }

  // Sample the custom colour track at position t in [0,1].
  function customSample(t) {
    var colors = state.customColors;
    var n = colors.length;
    if (n === 0) return '#65D97D';
    if (n === 1) return colors[0];
    if (state.customGradient) {
      var pos = t * (n - 1);
      var i = Math.min(Math.floor(pos), n - 2);
      return mix(colors[i], colors[i + 1], pos - i);
    }
    var band = Math.floor(t * n);
    if (band >= n) band = n - 1;
    return colors[band];
  }

  function leafTopFlat(b) {
    var j = leafPos(b);
    if (state.theme === 'custom') {
      var top = customSample(j);
      return { top: top, flat: mix(top, '#000000', 0.7) };
    }
    var t = THEMES[state.theme];
    return { top: samplePalette(t.top, j), flat: samplePalette(t.flat, j) };
  }

  function treeColor(b) {
    if (b.kind === 'leaf') {
      var lc = leafTopFlat(b);
      return { top: lc.top, left: mix(lc.top, lc.flat, 0.68), right: mix(lc.top, lc.flat, 0.38) };
    }
    var c = STRUCTURE[b.kind] || STRUCTURE.soil;
    if (b.kind === 'shadow-soil') {
      var light = b.jitter > 0.84;
      var target = light ? '#d7d98f' : '#667558';
      var a = light ? 0.42 : 0.18;
      return { top: mix(c.top, target, a), left: mix(c.left, target, a * 0.5), right: mix(c.right, target, a * 0.65) };
    }
    return c;
  }

  function flatColor(b) {
    if (b.kind === 'leaf') return leafTopFlat(b).flat;
    return FLAT_STRUCTURE[b.kind] || FLAT_STRUCTURE.soil;
  }

  function blockColor(b, x) {
    var tc = treeColor(b);
    var fc = flatColor(b);
    return { top: mix(tc.top, fc, x), left: mix(tc.left, fc, x), right: mix(tc.right, fc, x) };
  }

  // ---- drawing -----------------------------------------------------------

  function drawBlock(ctx, x, y, r, hgt, color, o) {
    var s = [[0, -r * 0.31], [r * 0.52, 0], [0, r * 0.31], [-r * 0.52, 0]];
    var c = [[-r * 0.5, -r * 0.5], [r * 0.5, -r * 0.5], [r * 0.5, r * 0.5], [-r * 0.5, r * 0.5]];
    var l = s.map(function (p, i) {
      return { x: x + lerp(p[0], c[i][0], o), y: y + lerp(p[1], c[i][1], o) };
    });

    if (hgt > 0.2) {
      ctx.fillStyle = color.left;
      ctx.beginPath();
      ctx.moveTo(l[3].x, l[3].y); ctx.lineTo(l[2].x, l[2].y);
      ctx.lineTo(l[2].x, l[2].y + hgt); ctx.lineTo(l[3].x, l[3].y + hgt);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = color.right;
      ctx.beginPath();
      ctx.moveTo(l[1].x, l[1].y); ctx.lineTo(l[2].x, l[2].y);
      ctx.lineTo(l[2].x, l[2].y + hgt); ctx.lineTo(l[1].x, l[1].y + hgt);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = color.top;
    ctx.beginPath();
    ctx.moveTo(l[0].x, l[0].y);
    ctx.lineTo(l[1].x, l[1].y);
    ctx.lineTo(l[2].x, l[2].y);
    ctx.lineTo(l[3].x, l[3].y);
    ctx.closePath(); ctx.fill();
  }

  function drawBackground(ctx, x) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#ece8d9', '#ffffff', x));
    g.addColorStop(0.62, mix('#f1e8cf', '#ffffff', x));
    g.addColorStop(1, mix('#e5d6b7', '#ffffff', x));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShadow(ctx, x, rot, n, E) {
    var alpha = 0.3 * (1 - x);
    if (alpha < 0.02) return;
    var cx = W / 2 + E * 5.5;
    var cy = H * 0.76;
    var rx = n * E * 0.52;
    var ry = n * E * 0.16;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.18 + (rot + 0.74) * 0.3);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(41,71,56,' + alpha.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(41,71,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function drawTree(ctx, x, now) {
    var n = state.matrix.length;
    var T = (n - 1) / 2;
    var E = Math.min(W, H) / Math.max(n * 1.45, 36);
    var D = Math.floor(Math.min(W * 0.7, H * 0.73) / (n + 8));
    var rot = -0.74 + Math.sin(now / 5000) * 0.025 + state.pointer.x * 0.09 * (1 - x);

    drawShadow(ctx, x, rot, n, E);

    var swayPhase = now / 1200;
    var proj = state.blocks.map(function (b) {
      var cx = b.x - T, cz = b.z - T;
      var px = cx * Math.cos(rot) - cz * Math.sin(rot);
      var pz = cx * Math.sin(rot) + cz * Math.cos(rot);
      var leafSway = b.kind === 'leaf' ? Math.sin(swayPhase + b.jitter * 8) * 0.08 * (1 - x) : 0;
      var isoX = W / 2 + (px + leafSway) * E;
      var isoY = H * 0.7 + pz * E * 0.46 - b.y * E * 0.86 + state.pointer.y * E * 0.7 * (1 - x);
      var flatX = W / 2 + cx * D;
      var flatY = H / 2 + cz * D;
      return { b: b, sx: lerp(isoX, flatX, x), sy: lerp(isoY, flatY, x), depth: pz + b.y * 0.06 };
    });

    proj.sort(function (a, b) {
      if (a.b.extra !== b.b.extra) return a.b.extra ? 1 : -1;
      return (a.depth - b.depth) || (a.b.y - b.b.y);
    });

    var size = lerp(E * 1.03, D, x);
    var hgt = size * 0.5 * (1 - x);

    for (var i = 0; i < proj.length; i++) {
      drawBlock(ctx, proj[i].sx, proj[i].sy, size, hgt, blockColor(proj[i].b, x), x);
    }
  }

  // Final top-down QR (scannable): plain dark squares on a light background.
  function drawFlat(ctx) {
    var n = state.matrix.length;
    var D = Math.floor(Math.min(W * 0.7, H * 0.73) / (n + 8));
    var total = D * (n + 8);
    var ox = Math.round((W - total) / 2);
    var oy = Math.round((H - total) / 2);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!state.matrix[r][c]) continue;
        ctx.fillStyle = flatColor(state.cellBlock[r][c]);
        ctx.fillRect(ox + (c + 4) * D, oy + (r + 4) * D, D, D);
      }
    }
  }

  function paint(ctx, x, now) {
    drawBackground(ctx, x);
    if (x > 0.985) drawFlat(ctx);
    else drawTree(ctx, x, now);
  }

  // ---- state + DOM -------------------------------------------------------

  var state = {
    url: 'https://openai.com',
    theme: 'cherry',
    flat: false,      // target: false = tree, true = flat
    s: 0,             // eased progress 0..1
    pointer: { x: 0, y: 0 },
    matrix: null,
    blocks: null,
    cellBlock: null,
    customColors: ['#65D97D', '#f4d94e', '#ef91b4'],
    customGradient: true,
    blockMap: {} // 颜色(小写) -> 方块 id
  };

  var canvas = document.getElementById('preview');
  var ctx = canvas.getContext('2d');
  var urlInput = document.getElementById('url');
  var stageLabel = document.getElementById('stage-label');
  var toggleBtn = document.getElementById('toggle');
  var download = document.getElementById('download');
  var downloadFlat = document.getElementById('download-flat');
  var themeButtons = Array.prototype.slice.call(document.querySelectorAll('.theme'));

  canvas.width = W;
  canvas.height = H;

  function rebuild() {
    try {
      state.matrix = getMatrix(state.url);
      var scene = buildScene(state.matrix);
      state.blocks = scene.blocks;
      state.cellBlock = scene.cellBlock;
    } catch (e) {
      // Too long / invalid: keep the previous scene.
    }
  }

  function render() {
    if (!state.url) return;
    rebuild();
    stageLabel.textContent = state.flat ? 'SCAN ME' : THEMES[state.theme].treeLabel;
    toggleBtn.innerHTML = state.flat
      ? '<span>↙</span> 回到' + THEMES[state.theme].treeLabel
      : '<span>⌗</span> 查看二维码';
    themeButtons.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme') === state.theme);
    });
    renderBlockMap();
  }

  function exportPng(flat) {
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var octx = off.getContext('2d');
    paint(octx, flat ? 1 : 0, 0);
    return off.toDataURL('image/png');
  }

  // ---- events ------------------------------------------------------------

  var debounce;
  urlInput.addEventListener('input', function () {
    state.url = urlInput.value.trim();
    clearTimeout(debounce);
    debounce = setTimeout(render, 250);
  });
  toggleBtn.addEventListener('click', function () {
    state.flat = !state.flat;
    render();
  });
  themeButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-theme');
      if (t === 'custom') { openModal(); return; }
      state.theme = t;
      render();
    });
  });
  // ---- custom colour modal ----
  var modal = document.getElementById('custom-modal');
  var hexInput = document.getElementById('custom-hex');
  var colorPicker = document.getElementById('custom-picker');
  var addBtn = document.getElementById('custom-add');
  var applyBtn = document.getElementById('custom-apply');
  var cancelBtn = document.getElementById('custom-cancel');
  var gradientChk = document.getElementById('custom-gradient');
  var trackEl = document.getElementById('custom-track');
  var swatchesEl = document.getElementById('custom-swatches');
  var customError = document.getElementById('custom-error');
  var customCount = document.getElementById('custom-count');

  function showError(msg) { customError.textContent = msg; }

  function renderCustomUI() {
    showError('');
    var colors = state.customColors;
    var n = colors.length;
    if (n === 0) {
      trackEl.style.background = 'rgba(0,0,0,.06)';
    } else if (state.customGradient) {
      trackEl.style.background = 'linear-gradient(to right, ' + colors.join(', ') + ')';
    } else {
      var stops = [];
      for (var i = 0; i < n; i++) {
        stops.push(colors[i] + ' ' + (i / n * 100).toFixed(1) + '%');
        stops.push(colors[i] + ' ' + ((i + 1) / n * 100).toFixed(1) + '%');
      }
      trackEl.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';
    }
    swatchesEl.innerHTML = '';
    colors.forEach(function (c, i) {
      var s = document.createElement('span');
      s.className = 'custom-swatch';
      s.style.background = c;
      s.title = '点击移除 ' + c;
      s.addEventListener('click', function () {
        state.customColors.splice(i, 1);
        renderCustomUI();
      });
      swatchesEl.appendChild(s);
    });
    gradientChk.checked = state.customGradient;
    customCount.textContent = n + ' / 6';
  }

  function addColor() {
    var v = hexInput.value.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(v)) { showError('请输入 6 位十六进制颜色，如 #65D97D'); return; }
    if (v.charAt(0) !== '#') v = '#' + v;
    v = v.toUpperCase();
    if (state.customColors.length >= 6) { showError('最多只能添加 6 种颜色'); return; }
    state.customColors.push(v);
    hexInput.value = '';
    renderCustomUI();
  }

  function openModal() { renderCustomUI(); modal.classList.add('open'); }
  function closeModal() { modal.classList.remove('open'); }

  addBtn.addEventListener('click', addColor);
  hexInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addColor(); } });
  colorPicker.addEventListener('input', function () { hexInput.value = colorPicker.value; });
  gradientChk.addEventListener('change', function () { state.customGradient = gradientChk.checked; renderCustomUI(); });
  applyBtn.addEventListener('click', function () {
    if (state.customColors.length === 0) { showError('请先添加至少一种颜色'); return; }
    state.theme = 'custom';
    closeModal();
    render();
  });
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  function triggerDownload(href, filename) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  download.addEventListener('click', function (e) {
    e.preventDefault();
    triggerDownload(exportPng(state.flat), state.flat ? 'pixel-tree-qr.png' : 'pixel-tree.png');
  });
  downloadFlat.addEventListener('click', function (e) {
    e.preventDefault();
    triggerDownload(exportPng(true), 'pixel-tree-qr.png');
  });
  canvas.parentElement.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    state.pointer.x = (e.clientX - rect.left) / rect.width - 0.5;
    state.pointer.y = (e.clientY - rect.top) / rect.height - 0.5;
  });
  canvas.parentElement.addEventListener('pointerleave', function () {
    state.pointer.x = 0; state.pointer.y = 0;
  });

  // ---- animation loop ----------------------------------------------------

  // ===== Minecraft 方块映射 / 投影预览 / Litematica 导出 =====

  var downloadProjectionBtn = document.getElementById('download-projection');
  var blockMapEl = document.getElementById('block-map');
  var blockModal = document.getElementById('block-modal');
  var blockSearch = document.getElementById('block-search');
  var blockListEl = document.getElementById('block-list');
  var STAINED_GLASS = null;
  var activeBlockKey = null;

  function getBlock(id) {
    if (!id) return null;
    for (var i = 0; i < MC_BLOCKS.length; i++) if (MC_BLOCKS[i].id === id) return MC_BLOCKS[i];
    return null;
  }

  function closestStainedGlass(hex) {
    if (!STAINED_GLASS) STAINED_GLASS = MC_BLOCKS.filter(function (b) { return /_stained_glass$/.test(b.id); });
    var t = hexToRgb(hex), best = STAINED_GLASS[0], bd = Infinity;
    STAINED_GLASS.forEach(function (b) {
      var c = hexToRgb(b.color);
      var d = (c.r - t.r) * (c.r - t.r) + (c.g - t.g) * (c.g - t.g) + (c.b - t.b) * (c.b - t.b);
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }

  function leafPalette() {
    return state.theme === 'custom' ? state.customColors : THEMES[state.theme].top;
  }

  function leafBlock(b) {
    var pal = leafPalette();
    var n = pal.length;
    if (n === 0) return null;
    var band = Math.min(Math.floor(leafPos(b) * n), n - 1);
    return getBlock(state.blockMap[pal[band].toLowerCase()]);
  }

  function ensureBlockMap() {
    leafPalette().forEach(function (c) {
      var k = c.toLowerCase();
      if (!state.blockMap[k]) state.blockMap[k] = closestStainedGlass(c).id;
    });
  }

  // --- 选择对应方块 UI ---
  function renderBlockMap() {
    ensureBlockMap();
    var pal = leafPalette();
    blockMapEl.innerHTML = '';
    pal.forEach(function (c) {
      var k = c.toLowerCase();
      var blk = getBlock(state.blockMap[k]) || closestStainedGlass(c);
      var row = document.createElement('div');
      row.className = 'block-row';
      row.innerHTML =
        '<span class="color-dot" style="background:' + c + '"></span>' +
        '<code class="hex" style="color:' + c + '">' + c + '</code>' +
        '<span class="arrow">——</span>' +
        '<button type="button" class="block-pick"><span class="block-icon" style="background:' + blk.color + '"></span><span>' + blk.name + '</span></button>';
      row.querySelector('.block-pick').addEventListener('click', function () { openBlockModal(k); });
      blockMapEl.appendChild(row);
    });
  }

  function renderBlockList(q) {
    q = (q || '').toLowerCase();
    var list = MC_BLOCKS.filter(function (b) {
      return !q || b.name.toLowerCase().indexOf(q) !== -1 || b.id.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 80);
    blockListEl.innerHTML = '';
    if (!list.length) blockListEl.innerHTML = '<div class="block-empty">未找到匹配的方块</div>';
    list.forEach(function (b) {
      var item = document.createElement('div');
      item.className = 'block-option';
      item.innerHTML = '<span class="block-icon" style="background:' + b.color + '"></span><span class="bname">' + b.name + '</span><code>' + b.id + '</code>';
      item.addEventListener('click', function () {
        state.blockMap[activeBlockKey] = b.id;
        blockModal.classList.remove('open');
        renderBlockMap();
      });
      blockListEl.appendChild(item);
    });
  }

  function openBlockModal(key) {
    activeBlockKey = key;
    blockSearch.value = '';
    renderBlockList('');
    blockModal.classList.add('open');
    blockSearch.focus();
  }

  blockSearch.addEventListener('input', function () { renderBlockList(blockSearch.value); });
  blockModal.addEventListener('click', function (e) { if (e.target === blockModal) blockModal.classList.remove('open'); });

  // --- Litematica (.litematic) 生成 ---
  var SCHEMATIC_VERSION = 7; // Litematica 原理图版本（MC 1.20.5+ 为 7）
  var DATA_VERSION = 4189;   // Minecraft 数据版本（可调整）

  function buildMinecraftGrid() {
    var n = state.matrix.length;
    var maxY = 0;
    state.blocks.forEach(function (b) { if (b.y > maxY) maxY = b.y; });
    var sizeY = maxY + 1;
    var grid = new Map();
    state.blocks.forEach(function (b) {
      var id;
      if (!b.extra) {
        id = (b.kind === 'soil' || b.kind === 'shadow-soil') ? 'minecraft:white_concrete' : 'minecraft:black_concrete';
      } else if (b.kind === 'leaf') {
        var blk = leafBlock(b);
        id = blk ? blk.id : 'minecraft:white_stained_glass';
      } else {
        id = 'minecraft:oak_log'; // 树干
      }
      if (id !== 'minecraft:air') grid.set((b.y * n * n) + (b.z * n) + b.x, id);
    });
    return { sizeX: n, sizeY: sizeY, sizeZ: n, grid: grid };
  }

  // --- NBT 编码（大端） ---
  function NBT() { this.b = []; }
  NBT.prototype.u8 = function (v) { this.b.push(v & 0xff); };
  NBT.prototype.u16 = function (v) { this.b.push((v >>> 8) & 0xff, v & 0xff); };
  NBT.prototype.i32 = function (v) { this.b.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); };
  NBT.prototype.i64 = function (v) {
    var x = BigInt.asIntN(64, typeof v === 'bigint' ? v : BigInt(v));
    for (var i = 56; i >= 0; i -= 8) this.b.push(Number((x >> BigInt(i)) & 0xffn));
  };
  NBT.prototype.str = function (s) {
    var e = new TextEncoder().encode(s);
    this.u16(e.length);
    for (var i = 0; i < e.length; i++) this.b.push(e[i]);
  };
  NBT.prototype.out = function () { return new Uint8Array(this.b); };

  function buildLitematicBytes() {
    var m = buildMinecraftGrid();
    var palette = ['minecraft:air'];
    var index = { 'minecraft:air': 0 };
    var used = new Set();
    m.grid.forEach(function (id) { used.add(id); });
    Array.from(used).sort().forEach(function (id) { index[id] = palette.length; palette.push(id); });

    var bits = Math.max(2, Math.ceil(Math.log2(palette.length)));
    var total = m.sizeX * m.sizeY * m.sizeZ;
    var longCount = Math.ceil(total * bits / 64);
    var longs = new Array(longCount).fill(0n);
    var MASK = (1n << BigInt(bits)) - 1n;
    m.grid.forEach(function (id, pos) {
      var val = BigInt(index[id]) & MASK;
      var bp = BigInt(pos) * BigInt(bits);
      var li = Number(bp >> 6n);
      var off = Number(bp & 63n);
      longs[li] = (longs[li] | (val << BigInt(off))) & 0xffffffffffffffffn;
      if (off + bits > 64) longs[li + 1] = (longs[li + 1] | (val >> BigInt(64 - off))) & 0xffffffffffffffffn;
    });

    var w = new NBT();
    w.u8(10); w.str(''); // 根
    w.u8(3); w.str('Version'); w.i32(SCHEMATIC_VERSION);
    // Metadata
    w.u8(10); w.str('Metadata');
    w.u8(8); w.str('Name'); w.str('pixel-tree');
    w.u8(8); w.str('Author'); w.str('pixel-tree-qr');
    w.u8(8); w.str('Description'); w.str('Generated by pixel-tree-qr');
    w.u8(3); w.str('RegionCount'); w.i32(1);
    w.u8(4); w.str('TimeCreated'); w.i64(0n);
    w.u8(4); w.str('TimeModified'); w.i64(0n);
    w.u8(3); w.str('TotalBlocks'); w.i32(m.grid.size);
    w.u8(3); w.str('TotalVolume'); w.i32(total);
    w.u8(10); w.str('EnclosingSize');
    w.u8(3); w.str('x'); w.i32(m.sizeX);
    w.u8(3); w.str('y'); w.i32(m.sizeY);
    w.u8(3); w.str('z'); w.i32(m.sizeZ);
    w.u8(0);
    w.u8(0); // Metadata end
    // Regions（根级，与 Metadata 同级）
    w.u8(10); w.str('Regions');
    w.u8(10); w.str('pixel-tree');
    w.u8(10); w.str('Position');
    w.u8(3); w.str('x'); w.i32(0);
    w.u8(3); w.str('y'); w.i32(0);
    w.u8(3); w.str('z'); w.i32(0);
    w.u8(0);
    w.u8(10); w.str('Size');
    w.u8(3); w.str('x'); w.i32(m.sizeX);
    w.u8(3); w.str('y'); w.i32(m.sizeY);
    w.u8(3); w.str('z'); w.i32(m.sizeZ);
    w.u8(0);
    // BlockStatePalette (TAG_List<TAG_Compound>)
    w.u8(9); w.str('BlockStatePalette'); w.u8(10); w.i32(palette.length);
    palette.forEach(function (name) { w.u8(8); w.str('Name'); w.str(name); w.u8(0); });
    // BlockStates (TAG_Long_Array)
    w.u8(12); w.str('BlockStates'); w.i32(longs.length);
    longs.forEach(function (v) { w.i64(v); });
    // 空列表
    ['Entities', 'TileEntities', 'PendingBlockTicks', 'PendingFluidTicks'].forEach(function (nm) {
      w.u8(9); w.str(nm); w.u8(10); w.i32(0);
    });
    w.u8(0); // region end
    w.u8(0); // Regions end
    w.u8(3); w.str('MinecraftDataVersion'); w.i32(DATA_VERSION);
    w.u8(0); // root end

    return w.out();
  }

  function gzipBytes(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }

  downloadProjectionBtn.addEventListener('click', function (e) {
    e.preventDefault();
    ensureBlockMap();
    var missing = leafPalette().filter(function (c) { return !state.blockMap[c.toLowerCase()]; });
    if (missing.length) {
      alert('以下颜色还没有对应方块，请先分配：\n' + missing.join('、'));
      return;
    }
    gzipBytes(buildLitematicBytes()).then(function (buf) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
      a.download = 'pixel-tree.litematic';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }).catch(function (err) { alert('生成失败：' + err.message); });
  });

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var target = state.flat ? 1 : 0;
    state.s += (target - state.s) * Math.min(1, 4.2 * dt);
    if (Math.abs(target - state.s) < 0.001) state.s = target;
    paint(ctx, ease(state.s), now);
    requestAnimationFrame(frame);
  }

  render();
  requestAnimationFrame(frame);
})();
