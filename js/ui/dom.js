/* DOM helpers. Everything is built with createElement/textContent: no innerHTML with data. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});

  // h('button.big', {onclick: fn, type: 'button'}, 'text', childNode, [more])
  function h(tag, attrs) {
    var parts = String(tag).split('.');
    var el = document.createElement(parts[0] || 'div');
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style[s] = v[s]; });
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      });
    }
    append(el, kids);
    return el;
  }

  function append(el, kids) {
    kids.forEach(function (k) {
      if (k === null || k === undefined || k === false) return;
      if (Array.isArray(k)) append(el, k);
      else if (k.nodeType) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    });
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

  function svg(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  // ---------- modal dialogs ----------
  var modalRoot = null;
  function closeModal() { if (modalRoot) { modalRoot.remove(); modalRoot = null; } }

  // opts: {title, body (string|node|array), buttons:[{label, value, cls}], dismissValue}
  function modal(opts) {
    closeModal();
    return new Promise(function (resolve) {
      var done = function (v) { closeModal(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); done(opts.dismissValue); } };
      document.addEventListener('keydown', onKey, true);
      var btns = (opts.buttons || [{ label: 'OK', value: true }]).map(function (b) {
        return h('button.btn' + (b.cls ? '.' + b.cls : ''), { type: 'button', onclick: function () { done(b.value); } }, b.label);
      });
      var box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Message' },
        opts.title ? h('h2', opts.title) : null,
        h('div.modal-body', typeof opts.body === 'string' ? h('p', opts.body) : opts.body),
        h('div.modal-actions', btns));
      modalRoot = h('div.modal-back', { onclick: function (e) { if (e.target === modalRoot) done(opts.dismissValue); } }, box);
      document.body.appendChild(modalRoot);
      var focus = btns[btns.length - 1];
      if (focus) focus.focus();
    });
  }

  // A confirmation that says exactly what will change.
  function confirm(title, lines, okLabel, danger) {
    var body = (Array.isArray(lines) ? lines : [lines]).map(function (l) { return typeof l === 'string' ? h('p', l) : l; });
    return modal({
      title: title, body: body, dismissValue: false,
      buttons: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: okLabel || 'Yes', value: true, cls: danger ? 'danger' : 'primary' }]
    });
  }

  function alert(title, lines) {
    var body = (Array.isArray(lines) ? lines : [lines]).map(function (l) { return typeof l === 'string' ? h('p', l) : l; });
    return modal({ title: title, body: body, buttons: [{ label: 'OK', value: true, cls: 'primary' }], dismissValue: true });
  }

  // ---------- the hidden word must not show anywhere ----------
  // While a question is on screen, App.hiddenWord holds the word. Any UI text that happens to
  // contain it ("Undo last answer" when the word is "answer") is masked too.
  function safe(text) {
    var w = window.App && window.App.hiddenWord;
    return w ? window.GF.mask.mask(String(text), w) : String(text);
  }

  function guardWord(root) {
    var w = window.App && window.App.hiddenWord;
    if (!w || !root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var m = window.GF.mask.mask(t.nodeValue, w);
      if (m !== t.nodeValue) t.nodeValue = m;
    });
    Array.prototype.forEach.call(root.querySelectorAll('[aria-label],[title],[placeholder]'), function (el) {
      ['aria-label', 'title', 'placeholder'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v) { var m = window.GF.mask.mask(v, w); if (m !== v) el.setAttribute(a, m); }
      });
    });
    document.title = safe('Grand Finale Practice');
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    msg = safe(msg);
    var t = document.getElementById('toast');
    if (!t) { t = h('div.toast', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---------- press-and-hold button ----------
  // label: text; ms: hold time; onDone: callback
  function holdButton(label, ms, onDone, cls) {
    var fill = h('span.hold-fill');
    var lbl = h('span.hold-label', label);
    var btn = h('button.btn.hold' + (cls ? '.' + cls : ''), { type: 'button', 'aria-label': label + ' (press and hold)' }, fill, lbl);
    var timer = null, start = 0, raf = null;
    function tick() {
      var p = Math.min(1, (Date.now() - start) / ms);
      fill.style.width = (p * 100) + '%';
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    function begin(e) {
      if (timer) return;
      if (e && e.type === 'pointerdown') { try { btn.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
      start = Date.now();
      btn.classList.add('holding');
      raf = requestAnimationFrame(tick);
      timer = setTimeout(function () { stop(); onDone(); }, ms);
    }
    function stop() {
      clearTimeout(timer); timer = null;
      cancelAnimationFrame(raf);
      fill.style.width = '0%';
      btn.classList.remove('holding');
    }
    // Fingers use touch events: a long press would otherwise open the phone's own menu or start
    // selecting text, which cancels the pointer events part-way through the hold.
    var touching = false;
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); touching = true; begin(); }, { passive: false });
    ['touchend', 'touchcancel'].forEach(function (ev) { btn.addEventListener(ev, function () { touching = false; stop(); }); });
    btn.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch' && !touching) begin(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      btn.addEventListener(ev, function (e) { if (e.pointerType !== 'touch' && !touching) stop(); });
    });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); begin(); } });
    btn.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') stop(); });
    btn.addEventListener('blur', stop);
    return btn;
  }

  // ---------- downloads ----------
  // Blob + <a download>. If that can't start, show the text in a box with a Copy button.
  function download(filename, text, mime) {
    // Inside another page downloads are silently blocked, so go straight to the copy box.
    if (window.App && window.App.embedded) { showText(filename, text); return false; }
    var ok = false;
    try {
      var blob = new Blob([text], { type: mime || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: filename, style: { display: 'none' } });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      ok = true;
    } catch (e) { ok = false; }
    if (!ok) showText(filename, text);
    return ok;
  }

  function showText(filename, text) {
    var ta = h('textarea.copybox', { readonly: true, rows: 10 });
    ta.value = text;
    var copy = function () {
      ta.focus(); ta.select();
      var done = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { done = document.execCommand('copy'); toast(done ? 'Copied' : 'Select the text and copy it'); });
          return;
        }
        done = document.execCommand('copy');
      } catch (e) { done = false; }
      toast(done ? 'Copied' : 'Select the text and copy it');
    };
    return modal({
      title: 'Save this text as ' + filename,
      body: [h('p', (window.App && window.App.embedded ? 'Downloads are not available here. ' : 'The download did not start. ') +
        'Copy this text and keep it somewhere safe, for example in a note or an email to yourself. To restore it, paste it into Parent area → Export and backup → Restore.'), ta,
        h('button.btn.primary', { type: 'button', onclick: copy }, '📋 Copy')],
      buttons: [{ label: 'Close', value: true }], dismissValue: true
    });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(r.error || new Error('Could not read the file.')); };
      r.readAsText(file, 'utf-8');
    });
  }

  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  // ---------- emoji the device can't draw ----------
  // Draws the emoji on a small canvas and compares it with how this device draws a character it
  // doesn't have (U+1FAFF is unassigned): the same picture means it would show an empty box.
  var glyphCache = {}, missingPic = null;
  function picture(text) {
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var x = c.getContext('2d');
    x.textBaseline = 'top';
    x.font = '26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    x.fillText(text, 2, 2);
    return Array.prototype.join.call(x.getImageData(0, 0, 32, 32).data, ',');
  }
  function emojiOk(e) {
    if (e in glyphCache) return glyphCache[e];
    var ok = true;
    try {
      if (missingPic === null) missingPic = picture('🫿');
      ok = picture(e) !== missingPic;
    } catch (err) { ok = true; }
    glyphCache[e] = ok;
    return ok;
  }
  // The emoji, or its stand-in when this device would show an empty box.
  function glyph(e, alt) { return alt && !emojiOk(e) ? alt : e; }

  // ---------- confetti ----------
  function confetti() {
    if (reducedMotion()) { toast('🎉 Amazing! 🎉'); return; }
    var layer = h('div.confetti', { 'aria-hidden': 'true' });
    var colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
    for (var i = 0; i < 90; i++) {
      var p = h('i');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
      p.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 4500);
  }

  UI.h = h; UI.append = append; UI.clear = clear; UI.svg = svg;
  UI.modal = modal; UI.closeModal = closeModal; UI.confirm = confirm; UI.alert = alert; UI.toast = toast;
  UI.holdButton = holdButton; UI.download = download; UI.showText = showText; UI.readFile = readFile;
  UI.reducedMotion = reducedMotion; UI.confetti = confetti; UI.emojiOk = emojiOk; UI.glyph = glyph; UI.safe = safe; UI.guardWord = guardWord;
})();
