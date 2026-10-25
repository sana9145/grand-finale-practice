/* Draws the dress-up doll as an SVG (shapes and emoji, no image files).
   UI.doll.svg(look, {size: 'big' | 'mini' | 'tile', label}) -> <svg> element. look = {slot: itemId} from GF.dress. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function emoji(parent, ch, x, y, size, extra) {
    return el('text', Object.assign({ x: x, y: y, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }, extra || {}), parent, UI.glyph ? UI.glyph(ch, '⭐') : ch);
  }
  function v(look, slot) {
    var D = window.GF.dress;
    var it = D.BY_ID[look[slot]] || D.BY_ID[D.DEFAULT_LOOK[slot]];
    return it.value;
  }
  // a lighter or darker shade of a #rrggbb colour (amt -1..1)
  function shade(hex, amt) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); };
    return '#' + [f(r), f(g), f(b)].map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }

  // ---------- defs: patterns and gradients (ids unique per drawing) ----------
  function defs(svg, id, look) {
    var d = el('defs', {}, svg);
    var color = v(look, 'outfitColor');
    var pat = v(look, 'pattern');
    var p = el('pattern', { id: id + 'cloth', width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, d);
    el('rect', { width: 14, height: 14, fill: color }, p);
    var light = color === '#f7f7fb' ? '#ff8fab' : '#ffffff';
    if (pat === 'dots') el('circle', { cx: 7, cy: 7, r: 2.4, fill: light, opacity: 0.8 }, p);
    if (pat === 'stripes') el('rect', { width: 14, height: 5, fill: light, opacity: 0.55 }, p);
    if (pat === 'hearts') el('path', { d: 'M7 11 L3 7 A2.2 2.2 0 0 1 7 4.5 A2.2 2.2 0 0 1 11 7 Z', fill: light, opacity: 0.8 }, p);
    if (pat === 'stars') el('path', { d: 'M7 2 L8.5 5.8 L12.5 6 L9.4 8.5 L10.5 12.3 L7 10.1 L3.5 12.3 L4.6 8.5 L1.5 6 L5.5 5.8 Z', fill: light, opacity: 0.8 }, p);
    if (pat === 'flowers') { [[4, 4], [11, 10]].forEach(function (c) { [0, 72, 144, 216, 288].forEach(function (a) { el('circle', { cx: c[0] + 2 * Math.cos(a * Math.PI / 180), cy: c[1] + 2 * Math.sin(a * Math.PI / 180), r: 1.4, fill: light, opacity: 0.85 }, p); }); el('circle', { cx: c[0], cy: c[1], r: 1, fill: '#ffd166' }, p); }); }
    if (pat === 'sparkle') { [[3, 3, 1], [10, 6, 1.4], [6, 11, 0.9], [12, 12, 0.7]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: c[2], fill: '#fff', opacity: 0.95 }, p); }); }
    var rb = el('linearGradient', { id: id + 'rainbow', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].forEach(function (c, i) { el('stop', { offset: (i * 25) + '%', 'stop-color': c }, rb); });
    var gold = el('linearGradient', { id: id + 'gold', x1: 0, y1: 0, x2: 1, y2: 1 }, d);
    el('stop', { offset: '0%', 'stop-color': '#fff3b0' }, gold); el('stop', { offset: '60%', 'stop-color': '#e9b949' }, gold); el('stop', { offset: '100%', 'stop-color': '#b8860b' }, gold);
    var horn = el('linearGradient', { id: id + 'horn', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el('stop', { offset: '0%', 'stop-color': '#ffe066' }, horn); el('stop', { offset: '100%', 'stop-color': '#ff8fab' }, horn);
    return d;
  }

  // ---------- backdrop ----------
  function backdrop(g, id, kind) {
    var sky = { plain: ['#efe7ff', '#fde2f3'], garden: ['#bde0fe', '#e8f7ff'], snow: ['#cfe8ff', '#f4fbff'], beach: ['#8ecae6', '#e0f4ff'],
      mountains: ['#a2d2ff', '#eef6ff'], candy: ['#ffc8dd', '#ffe5ef'], castle: ['#ffd6e8', '#e9e3ff'], stage: ['#3c1642', '#7a1f4b'], space: ['#0b1d51', '#3a0ca3'] }[kind] || ['#efe7ff', '#fde2f3'];
    var lg = el('linearGradient', { id: id + 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, g);
    el('stop', { offset: '0%', 'stop-color': sky[0] }, lg); el('stop', { offset: '100%', 'stop-color': sky[1] }, lg);
    el('rect', { x: 0, y: 0, width: 200, height: 300, rx: 16, fill: 'url(#' + id + 'sky)' }, g);
    if (kind === 'garden') { el('rect', { x: 0, y: 230, width: 200, height: 70, fill: '#8ac926' }, g); emoji(g, '🌷', 22, 236, 22); emoji(g, '🌼', 178, 240, 20); emoji(g, '🦋', 170, 60, 20); emoji(g, '☀️', 30, 34, 26); }
    if (kind === 'snow') { el('rect', { x: 0, y: 235, width: 200, height: 65, fill: '#ffffff' }, g); [[25, 40], [160, 30], [60, 120], [175, 150], [20, 190]].forEach(function (c) { emoji(g, '❄️', c[0], c[1], 16); }); emoji(g, '⛄', 175, 222, 34); }
    if (kind === 'beach') { el('rect', { x: 0, y: 190, width: 200, height: 45, fill: '#4cc9f0' }, g); el('rect', { x: 0, y: 232, width: 200, height: 68, fill: '#f6e3b4' }, g); emoji(g, '☀️', 170, 34, 28); emoji(g, '🐚', 30, 262, 18); emoji(g, '⛵', 40, 200, 22); }
    if (kind === 'mountains') {
      el('path', { d: 'M-10 240 L50 110 L95 190 L140 90 L210 240 Z', fill: '#6c8ea4' }, g);
      el('path', { d: 'M50 110 L38 136 L50 130 L62 138 Z M140 90 L126 120 L140 112 L154 122 Z', fill: '#ffffff' }, g);
      el('rect', { x: 0, y: 236, width: 200, height: 64, fill: '#90be6d' }, g); emoji(g, '🌸', 25, 250, 16); emoji(g, '🌸', 178, 256, 16);
    }
    if (kind === 'candy') { emoji(g, '🍭', 26, 60, 26); emoji(g, '🍬', 175, 46, 22); emoji(g, '🧁', 24, 250, 24); emoji(g, '🍩', 176, 250, 24); emoji(g, '🍓', 170, 140, 18); }
    if (kind === 'castle') { emoji(g, '🏰', 160, 70, 52, { opacity: 0.85 }); emoji(g, '✨', 30, 40, 18); emoji(g, '🌈', 40, 90, 24, { opacity: 0.8 }); }
    if (kind === 'stage') {
      el('path', { d: 'M0 0 L40 0 Q30 150 44 300 L0 300 Z M200 0 L160 0 Q170 150 156 300 L200 300 Z', fill: '#c9184a' }, g);
      el('path', { d: 'M100 0 L40 300 L160 300 Z', fill: '#fff6cc', opacity: 0.18 }, g);
      el('rect', { x: 0, y: 268, width: 200, height: 32, fill: '#6b2737' }, g); emoji(g, '⭐', 100, 18, 18);
    }
    if (kind === 'space') { [[20, 30, 10], [180, 50, 12], [40, 140, 9], [170, 170, 10], [100, 20, 8], [30, 240, 9]].forEach(function (c) { emoji(g, '✨', c[0], c[1], c[2]); }); emoji(g, '🪐', 165, 110, 30); emoji(g, '🌙', 30, 80, 24); }
    if (kind === 'plain') { emoji(g, '✨', 26, 34, 16, { opacity: 0.6 }); emoji(g, '✨', 175, 70, 14, { opacity: 0.6 }); }
  }

  // ---------- the doll ----------
  var FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  function hairBack(g, style, fill) {
    var p = {
      long: 'M64 72 Q58 150 70 172 L130 172 Q142 150 136 72 Z',
      wavy: 'M63 72 Q52 110 62 128 Q50 150 66 176 L134 176 Q150 150 138 128 Q148 110 137 72 Z',
      bob: 'M63 70 Q60 110 74 112 L126 112 Q140 110 137 70 Z',
      curly: null, braids: null, pigtails: null, ponytail: null, bun: null, puffs: null
    }[style];
    if (p) el('path', { d: p, fill: fill }, g);
    if (style === 'curly') [[64, 70], [60, 96], [66, 120], [136, 70], [140, 96], [134, 120], [80, 52], [120, 52], [100, 46]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 16, fill: fill }, g); });
    if (style === 'braids') [70, 130].forEach(function (x) { for (var y = 100; y <= 170; y += 14) el('ellipse', { cx: x, cy: y, rx: 7, ry: 8, fill: fill }, g); el('circle', { cx: x, cy: 180, r: 4, fill: '#ff4d8d' }, g); });
    if (style === 'pigtails') [[56, 98, -20], [144, 98, 20]].forEach(function (c) { el('ellipse', { cx: c[0], cy: c[1], rx: 12, ry: 26, fill: fill, transform: 'rotate(' + c[2] + ' ' + c[0] + ' ' + c[1] + ')' }, g); });
    if (style === 'ponytail') el('ellipse', { cx: 140, cy: 96, rx: 11, ry: 32, fill: fill, transform: 'rotate(18 140 96)' }, g);
    if (style === 'puffs') [[70, 48], [130, 48]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 18, fill: fill }, g); });
  }

  function hairFront(g, style, fill) {
    el('path', { d: 'M66 84 Q63 42 100 42 Q137 42 134 84 Q124 60 100 62 Q78 60 66 84 Z', fill: fill }, g);
    if (style === 'bun') el('circle', { cx: 100, cy: 38, r: 15, fill: fill }, g);
    if (style === 'pigtails' || style === 'puffs') [[70, 66], [130, 66]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 3.5, fill: '#ff4d8d' }, g); });
    if (style === 'ponytail') el('circle', { cx: 133, cy: 72, r: 4, fill: '#ff4d8d' }, g);
  }

  function outfit(g, id, kind, color) {
    var cloth = 'url(#' + id + 'cloth)', dark = shade(color, -0.18), light = shade(color, 0.45);
    var sleeves = function (r) { el('ellipse', { cx: 73, cy: 128, rx: r, ry: r * 0.85, fill: cloth }, g); el('ellipse', { cx: 127, cy: 128, rx: r, ry: r * 0.85, fill: cloth }, g); };
    var top = function (y2) { el('path', { d: 'M76 120 Q100 128 124 120 L127 ' + y2 + ' L73 ' + y2 + ' Z', fill: cloth }, g); };
    if (kind === 'dress') { el('path', { d: 'M78 120 Q100 128 122 120 L126 160 L150 222 Q100 232 50 222 L74 160 Z', fill: cloth }, g); sleeves(9); }
    if (kind === 'teeskirt') { el('path', { d: 'M73 166 L127 166 L144 212 Q100 220 56 212 Z', fill: dark }, g); top(170); sleeves(10); }
    if (kind === 'sporty') { el('path', { d: 'M74 166 L126 166 L128 194 L103 194 L100 182 L97 194 L72 194 Z', fill: dark }, g); top(170); sleeves(10); el('path', { d: 'M88 140 L112 140', stroke: '#fff', 'stroke-width': 3 }, g); }
    if (kind === 'shalwar') {
      [[84, 98], [102, 116]].forEach(function (x) { el('path', { d: 'M' + x[0] + ' 220 L' + x[1] + ' 220 L' + (x[1] - 1) + ' 262 L' + (x[0] + 1) + ' 262 Z', fill: light }, g); });
      el('path', { d: 'M76 120 Q100 128 124 120 L133 232 Q100 238 67 232 Z', fill: cloth }, g);
      el('path', { d: 'M76 122 L92 120 L136 204 L124 212 Z', fill: '#f6c453', opacity: 0.92 }, g);
    }
    if (kind === 'jumpsuit') { [[85, 99], [101, 115]].forEach(function (x) { el('path', { d: 'M' + x[0] + ' 190 L' + x[1] + ' 190 L' + x[1] + ' 262 L' + x[0] + ' 262 Z', fill: cloth }, g); }); top(196); el('rect', { x: 74, y: 166, width: 52, height: 6, fill: dark }, g); }
    if (kind === 'party') {
      el('path', { d: 'M70 188 L130 188 L152 226 Q100 236 48 226 Z', fill: dark }, g);
      el('path', { d: 'M74 160 L126 160 L146 206 Q100 214 54 206 Z', fill: cloth }, g);
      top(164); el('path', { d: 'M100 162 L88 154 L88 170 Z M100 162 L112 154 L112 170 Z', fill: '#ff4d8d' }, g); el('circle', { cx: 100, cy: 162, r: 3.5, fill: '#ff4d8d' }, g);
    }
    if (kind === 'tutu') {
      var d = 'M58 166'; for (var i = 0; i <= 16; i++) d += ' L' + (58 + i * 5.25) + ' ' + (i % 2 ? 198 : 186);
      el('path', { d: d + ' L142 166 Z', fill: light }, g);
      el('path', { d: 'M80 120 Q100 128 120 120 L122 168 L78 168 Z', fill: cloth }, g);
    }
    if (kind === 'gown' || kind === 'lehenga') {
      el('path', { d: 'M76 158 L124 158 L164 266 Q100 280 36 266 Z', fill: cloth }, g);
      if (kind === 'lehenga') {
        el('path', { d: 'M40 260 Q100 274 160 260', stroke: '#f6c453', 'stroke-width': 7, fill: 'none' }, g);
        el('path', { d: 'M80 120 Q100 128 120 120 L121 152 L79 152 Z', fill: dark }, g);
        el('path', { d: 'M78 122 L92 120 L150 250 L136 254 Z', fill: '#f6c453', opacity: 0.55 }, g);
      } else { top(162); sleeves(13); }
    }
  }

  function shoes(g, kind) {
    var c = { trainers: '#ffffff', flats: '#ff8fab', boots: '#7f5539', wellies: '#ffd166', sandals: '#c08552', party: '#ef476f', glass: '#bde0fe' }[kind] || '#fff';
    [[91, 270], [109, 270]].forEach(function (p) {
      if (kind === 'boots' || kind === 'wellies') el('rect', { x: p[0] - 7, y: 244, width: 14, height: 28, rx: 3, fill: c, stroke: shade(c, -0.3), 'stroke-width': 1 }, g);
      el('ellipse', { cx: p[0], cy: p[1] + 2, rx: 10, ry: 5.5, fill: c, stroke: shade(c, -0.3), 'stroke-width': 1, opacity: kind === 'glass' ? 0.85 : 1 }, g);
      if (kind === 'sandals') el('path', { d: 'M' + (p[0] - 6) + ' ' + (p[1] - 2) + ' L' + (p[0] + 6) + ' ' + (p[1] - 2), stroke: shade(c, -0.3), 'stroke-width': 2 }, g);
      if (kind === 'trainers') el('path', { d: 'M' + (p[0] - 8) + ' ' + (p[1] + 5) + ' L' + (p[0] + 9) + ' ' + (p[1] + 5), stroke: '#5aa9e6', 'stroke-width': 2 }, g);
      if (kind === 'glass') emoji(g, '✨', p[0] + 9, p[1] - 4, 7);
    });
  }

  function back(g, id, kind) {
    if (kind === 'cape') el('path', { d: 'M76 124 L124 124 L150 252 Q100 262 50 252 Z', fill: '#e63946' }, g);
    if (kind === 'fairy') [[-1], [1]].forEach(function (s) {
      var x = 100 + s[0] * 34;
      el('ellipse', { cx: x, cy: 132, rx: 26, ry: 38, fill: '#bde0fe', opacity: 0.75, stroke: '#a2d2ff', transform: 'rotate(' + (s[0] * 30) + ' ' + x + ' 132)' }, g);
      el('ellipse', { cx: 100 + s[0] * 28, cy: 178, rx: 16, ry: 24, fill: '#e0c3fc', opacity: 0.75, transform: 'rotate(' + (s[0] * -25) + ' ' + (100 + s[0] * 28) + ' 178)' }, g);
    });
    if (kind === 'butterfly') [[-1], [1]].forEach(function (s) {
      var x = 100 + s[0] * 36;
      el('ellipse', { cx: x, cy: 130, rx: 28, ry: 34, fill: '#ff8fab', stroke: '#c9184a', 'stroke-width': 2 }, g);
      el('circle', { cx: x, cy: 128, r: 9, fill: '#ffd166' }, g);
      el('ellipse', { cx: 100 + s[0] * 28, cy: 178, rx: 17, ry: 22, fill: '#ffb3c6', stroke: '#c9184a', 'stroke-width': 2 }, g);
    });
  }

  function face(g, id, look) {
    var eyes = v(look, 'eyes'), shadow = v(look, 'shadow'), lips = v(look, 'lips'), cheeks = v(look, 'cheeks'), paint = v(look, 'paint');
    if (shadow !== 'none') [88, 112].forEach(function (x) { el('ellipse', { cx: x, cy: 77, rx: 7.5, ry: 4, fill: shadow === 'rainbow' ? 'url(#' + id + 'rainbow)' : shadow, opacity: 0.6 }, g); });
    var ink = '#2b2140';
    [88, 112].forEach(function (x, i) {
      if (eyes === 'happy' || (eyes === 'wink' && i === 1)) { el('path', { d: 'M' + (x - 5) + ' 83 Q' + x + ' 77 ' + (x + 5) + ' 83', stroke: ink, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, g); return; }
      if (eyes === 'hearts') { el('path', { d: 'M' + x + ' 87 L' + (x - 5) + ' 81.5 A2.8 2.8 0 0 1 ' + x + ' 78.5 A2.8 2.8 0 0 1 ' + (x + 5) + ' 81.5 Z', fill: '#e63946' }, g); return; }
      var r = eyes === 'sparkle' ? 5 : 4.2;
      el('circle', { cx: x, cy: 82, r: r, fill: ink }, g);
      el('circle', { cx: x + 1.4, cy: 80.6, r: 1.4, fill: '#fff' }, g);
      if (eyes === 'sparkle') el('circle', { cx: x - 1.5, cy: 83.6, r: 0.9, fill: '#fff' }, g);
      if (eyes === 'lashes' || eyes === 'sparkle') [[-4, -3], [0, -5], [4, -3]].forEach(function (o) { el('path', { d: 'M' + (x + o[0] * 0.8) + ' ' + (80 + o[1] * 0.4) + ' L' + (x + o[0] * 1.3) + ' ' + (80 + o[1]), stroke: ink, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, g); });
    });
    el('path', { d: 'M99 88 Q100 91 102 89', stroke: '#c98b6b', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g);
    if (cheeks === 'rosy') [82, 118].forEach(function (x) { el('ellipse', { cx: x, cy: 92, rx: 6, ry: 3.5, fill: '#ff8fab', opacity: 0.5 }, g); });
    if (cheeks === 'freckles') [[80, 90], [84, 93], [78, 94], [116, 90], [120, 93], [122, 89]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 0.9, fill: '#a0522d' }, g); });
    if (cheeks === 'hearts') [82, 118].forEach(function (x) { el('path', { d: 'M' + x + ' 96 L' + (x - 3.5) + ' 92.3 A2 2 0 0 1 ' + x + ' 90.4 A2 2 0 0 1 ' + (x + 3.5) + ' 92.3 Z', fill: '#ff4d8d', opacity: 0.85 }, g); });
    if (cheeks === 'stars') [82, 118].forEach(function (x) { el('text', { x: x, y: 93, 'font-size': 8, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#f4a300' }, g, '★'); });
    if (lips === 'none') el('path', { d: 'M92 97 Q100 104 108 97', stroke: '#9b3b4b', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, g);
    else {
      el('path', { d: 'M91 96 Q100 107 109 96 Q100 99.5 91 96 Z', fill: lips === 'glitter' ? '#ff6fa3' : lips }, g);
      if (lips === 'glitter') [[96, 100], [101, 102], [105, 99]].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 0.8, fill: '#fff' }, g); });
    }
    if (paint !== 'none') emoji(g, paint, 120, 100, 9);
  }

  function head(g, id, kind, hairFill) {
    if (kind === 'bow') { el('path', { d: 'M126 52 L110 42 L110 62 Z M126 52 L142 42 L142 62 Z', fill: '#ff4d8d' }, g); el('circle', { cx: 126, cy: 52, r: 4.5, fill: '#c9184a' }, g); }
    if (kind === 'headband') el('path', { d: 'M67 72 Q66 40 100 40 Q134 40 133 72', stroke: '#ff4d8d', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, g);
    if (kind === 'flowers') [[70, 58], [80, 46], [92, 41], [104, 40], [116, 43], [127, 50], [132, 62]].forEach(function (c, i) { emoji(g, i % 2 ? '🌼' : '🌸', c[0], c[1], 11); });
    if (kind === 'sunhat') { el('ellipse', { cx: 100, cy: 52, rx: 52, ry: 10, fill: '#f6d186' }, g); el('path', { d: 'M74 52 Q76 22 100 22 Q124 22 126 52 Z', fill: '#f6d186' }, g); el('rect', { x: 75, y: 44, width: 50, height: 6, fill: '#ff8fab' }, g); }
    if (kind === 'catears') [[76, -1], [124, 1]].forEach(function (c) { el('path', { d: 'M' + (c[0] - 11) + ' 52 L' + (c[0] + c[1] * 4) + ' 26 L' + (c[0] + 11) + ' 50 Z', fill: hairFill }, g); el('path', { d: 'M' + (c[0] - 5) + ' 49 L' + (c[0] + c[1] * 3) + ' 34 L' + (c[0] + 5) + ' 48 Z', fill: '#ffb3c6' }, g); });
    if (kind === 'bunny') [[84, -10], [116, 10]].forEach(function (c) { el('ellipse', { cx: c[0], cy: 24, rx: 8, ry: 22, fill: '#ffffff', stroke: '#e0d6e8', transform: 'rotate(' + c[1] + ' ' + c[0] + ' 40)' }, g); el('ellipse', { cx: c[0], cy: 26, rx: 4, ry: 15, fill: '#ffb3c6', transform: 'rotate(' + c[1] + ' ' + c[0] + ' 40)' }, g); });
    if (kind === 'tiara') { el('path', { d: 'M78 50 L84 36 L90 46 L100 30 L110 46 L116 36 L122 50 Q100 44 78 50 Z', fill: 'url(#' + id + 'gold)', stroke: '#b8860b', 'stroke-width': 1 }, g); el('circle', { cx: 100, cy: 38, r: 3, fill: '#4cc9f0' }, g); }
    if (kind === 'unicorn') el('path', { d: 'M92 44 L100 8 L108 44 Z', fill: 'url(#' + id + 'horn)', stroke: '#e9b949', 'stroke-width': 1 }, g);
    if (kind === 'crown') { el('path', { d: 'M74 50 L76 24 L88 38 L100 18 L112 38 L124 24 L126 50 Z', fill: 'url(#' + id + 'gold)', stroke: '#b8860b', 'stroke-width': 1.2 }, g); [[88, 44, '#e63946'], [100, 42, '#4cc9f0'], [112, 44, '#8ac926']].forEach(function (c) { el('circle', { cx: c[0], cy: c[1], r: 3, fill: c[2] }, g); }); }
  }

  function scarf(g, layer) {
    var c = '#c3aed6';
    if (layer === 'back') { el('path', { d: 'M60 74 Q56 140 80 158 L120 158 Q144 140 140 74 Z', fill: c }, g); el('circle', { cx: 100, cy: 80, r: 41, fill: c }, g); }
    else el('path', { d: 'M65 80 Q64 38 100 38 Q136 38 135 80 Q128 56 100 56 Q72 56 65 80 Z', fill: shade(c, -0.08) }, g);
  }

  function glasses(g, kind) {
    if (kind === 'round') { [88, 112].forEach(function (x) { el('circle', { cx: x, cy: 82, r: 8, fill: 'none', stroke: '#3d2c5c', 'stroke-width': 2 }, g); }); el('path', { d: 'M96 82 L104 82', stroke: '#3d2c5c', 'stroke-width': 2 }, g); }
    if (kind === 'sun') { [88, 112].forEach(function (x) { el('rect', { x: x - 9, y: 76, width: 18, height: 12, rx: 5, fill: '#1d1d2b', opacity: 0.9 }, g); }); el('path', { d: 'M97 80 L103 80', stroke: '#1d1d2b', 'stroke-width': 2.5 }, g); }
    if (kind === 'heart') [88, 112].forEach(function (x) { el('path', { d: 'M' + x + ' 91 L' + (x - 9) + ' 81 A4.5 4.5 0 0 1 ' + x + ' 76 A4.5 4.5 0 0 1 ' + (x + 9) + ' 81 Z', fill: '#ff4d8d', 'fill-opacity': 0.35, stroke: '#e63946', 'stroke-width': 2 }, g); });
    if (kind === 'star') [88, 112].forEach(function (x) { el('text', { x: x, y: 83, 'font-size': 22, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#ffd166', stroke: '#f4a300', 'stroke-width': 1, 'fill-opacity': 0.75 }, g, '★'); });
  }

  function neck(g, id, kind) {
    if (kind === 'pearls') for (var i = 0; i <= 8; i++) { var a = Math.PI * (0.15 + 0.7 * i / 8); el('circle', { cx: 100 - 16 * Math.cos(a), cy: 118 + 8 * Math.sin(a), r: 2.4, fill: '#fffaf0', stroke: '#e0d6c8', 'stroke-width': 0.6 }, g); }
    if (kind === 'locket') { el('path', { d: 'M86 116 Q100 132 114 116', stroke: '#e9b949', 'stroke-width': 1.5, fill: 'none' }, g); el('path', { d: 'M100 134 L94 128 A3.5 3.5 0 0 1 100 125 A3.5 3.5 0 0 1 106 128 Z', fill: 'url(#' + id + 'gold)' }, g); }
    if (kind === 'scarf') { el('path', { d: 'M82 114 Q100 126 118 114 L120 122 Q100 134 80 122 Z', fill: '#e63946' }, g); el('path', { d: 'M110 122 L118 150 L108 150 L104 124 Z', fill: '#c9184a' }, g); }
    if (kind === 'bowtie') { el('path', { d: 'M100 122 L90 116 L90 128 Z M100 122 L110 116 L110 128 Z', fill: '#3a86ff' }, g); el('circle', { cx: 100, cy: 122, r: 2.5, fill: '#1d4ed8' }, g); }
    if (kind === 'medal') { el('path', { d: 'M90 116 L100 140 L110 116', stroke: '#3a86ff', 'stroke-width': 5, fill: 'none' }, g); el('circle', { cx: 100, cy: 146, r: 8, fill: 'url(#' + id + 'gold)', stroke: '#b8860b' }, g); el('text', { x: 100, y: 147, 'font-size': 9, 'font-weight': 800, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#7a5200' }, g, '1'); }
  }

  function hand(g, kind) {
    if (kind === 'none') return;
    if (kind === 'wand') { el('path', { d: 'M142 196 L160 150', stroke: '#6a4c93', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); el('text', { x: 161, y: 146, 'font-size': 20, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#ffd166', stroke: '#f4a300', 'stroke-width': 1 }, g, '★'); return; }
    emoji(g, kind, 152, kind === '🎈' ? 158 : 184, kind === '🎈' ? 30 : 24);
    if (kind === '🎈') el('path', { d: 'M150 172 Q146 184 142 194', stroke: '#888', 'stroke-width': 1, fill: 'none' }, g);
  }

  function svg(look, opts) {
    opts = opts || {};
    look = look || {}; // any missing or unknown slot is drawn with its default (v() handles it)
    var id = 'd' + (++uid) + '-';
    var root = el('svg', { viewBox: opts.view || '0 0 200 300', class: 'doll doll-' + (opts.size || 'big'), role: 'img', 'aria-label': opts.label || 'Dress-up doll', focusable: 'false' });
    defs(root, id, look);
    var skin = v(look, 'skin'), hairStyle = v(look, 'hair'), hc = v(look, 'hairColor'), hairFill = hc === 'rainbow' ? 'url(#' + id + 'rainbow)' : hc;
    var headKind = v(look, 'head'), covered = headKind === 'scarf';
    var outfitKind = v(look, 'outfit'), color = v(look, 'outfitColor');
    var g = el('g', {}, root);
    if (opts.backdrop !== false) backdrop(g, id, v(look, 'backdrop'));
    el('ellipse', { cx: 100, cy: 280, rx: 50, ry: 7, fill: '#000', opacity: 0.12 }, g);
    back(g, id, v(look, 'back'));
    if (covered) scarf(g, 'back'); else hairBack(g, hairStyle, hairFill);
    // body
    var longSleeves = outfitKind === 'shalwar' || outfitKind === 'jumpsuit';
    var armFill = longSleeves ? 'url(#' + id + 'cloth)' : skin;
    el('path', { d: 'M74 126 Q64 160 60 190', stroke: armFill, 'stroke-width': 12, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('path', { d: 'M126 126 Q136 160 140 190', stroke: armFill, 'stroke-width': 12, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('circle', { cx: 60, cy: 194, r: 6.5, fill: skin }, g);
    el('circle', { cx: 140, cy: 194, r: 6.5, fill: skin }, g);
    el('rect', { x: 85, y: 196, width: 12, height: 74, rx: 5, fill: skin }, g);
    el('rect', { x: 103, y: 196, width: 12, height: 74, rx: 5, fill: skin }, g);
    shoes(g, v(look, 'shoes'));
    el('rect', { x: 93, y: 104, width: 14, height: 18, rx: 4, fill: skin }, g);
    outfit(g, id, outfitKind, color);
    neck(g, id, v(look, 'neck'));
    // head
    el('circle', { cx: 67, cy: 84, r: 5, fill: skin }, g);
    el('circle', { cx: 133, cy: 84, r: 5, fill: skin }, g);
    el('circle', { cx: 100, cy: 80, r: 33, fill: skin }, g);
    face(g, id, look);
    if (covered) scarf(g, 'front'); else hairFront(g, hairStyle, hairFill);
    glasses(g, v(look, 'glasses'));
    if (!covered) head(g, id, headKind, hairFill);
    hand(g, v(look, 'hand'));
    var pet = v(look, 'pet');
    if (pet !== 'none') emoji(g, pet, 160, 262, 34);
    return root;
  }

  // Which part of the doll a wardrobe tile shows, so small things (eyes, earrings of colour) are big enough to see.
  var VIEWS = { face: '56 50 88 62', head: '30 0 140 140', neck: '62 96 76 64', shoes: '62 222 76 64',
    body: '28 100 144 184', pet: '124 226 72 62', hand: '104 124 92 92', back: '14 78 172 196' };
  var SLOT_VIEW = { eyes: 'face', shadow: 'face', lips: 'face', cheeks: 'face', paint: 'face', glasses: 'face',
    head: 'head', hair: 'head', hairColor: 'head', neck: 'neck', shoes: 'shoes',
    outfit: 'body', pattern: 'body', pet: 'pet', hand: 'hand', back: 'back' };
  function dollView(slot) { return SLOT_VIEW[slot] ? VIEWS[SLOT_VIEW[slot]] : null; }

  UI.doll = { svg: svg, shade: shade, FONT: FONT };
  UI.dollView = dollView;
})();
