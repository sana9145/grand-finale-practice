#!/usr/bin/env node
// Phone and tablet check (no dependencies; needs Node 18+ and Chrome or Edge).
// Serves the app on http://127.0.0.1, then on 7 screen sizes (with touch and a phone/tablet browser) it opens
// every screen and pop-up and checks: no sideways scrolling, nothing sticking out past the screen edge,
// buttons big enough to tap, text big enough to read, no cut-off text, pop-ups that fit, and no errors.
// Also checks the app opens offline after the first visit, and how it behaves inside another page.
// Usage: node tools/mobile-check.mjs [--browser path] [--out folder]   (screenshots of every screen at 390 px)

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findBrowser, launch } from './cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const outDir = resolve(arg('--out') || join(tmpdir(), 'gfp-mobile-check'));
mkdirSync(outDir, { recursive: true });
const exe = findBrowser(arg('--browser'));
if (!exe) { console.log('No Chrome or Edge found.'); process.exit(2); }

// ---- a tiny static web server ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.csv': 'text/csv' };
const EMBED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<iframe id="f" src="/index.html" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`;
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/__embed.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(EMBED); return; }
  const file = normalize(join(root, url === '/' ? 'index.html' : url));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await launch(exe);
const { send, handlers } = browser;
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const errors = [];
handlers.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
});
await S('Runtime.enable'); await S('Page.enable'); await S('Network.enable');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 300));
  return r.result.value;
}
async function load(url) {
  const loaded = new Promise((r) => { const h = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); });
  await S('Page.navigate', { url });
  await loaded;
  await sleep(1700);
}
async function shot(name) {
  const r = await S('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
}
const problems = [];
let checks = 0;
const fail = (msg) => { problems.push(msg); console.log('  ✗ ' + msg); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };

// ---- what is checked on every screen ----
const AUDIT = `(() => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const out = { hscroll: document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, sticking: [], small: [], tiny: [], clipped: [], modal: null, oops: !!document.querySelector('.screen > .panel h2') && /Oops/.test(document.body.innerText) };
  const visible = (el) => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const clipsX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return p; } return null; };
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.confetti, .toast, .hold-fill, svg, noscript, .bg-layer')) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !clipsX(el)) out.sticking.push(name(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + vw + ']');
    const s = getComputedStyle(el);
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2 && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.classList.contains('btn') && !el.classList.contains('hold')) out.clipped.push(name(el));
  }
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, summary')) {
    let t = el;
    if (el.type === 'checkbox' || el.type === 'radio') t = el.closest('label') || el;
    if (!visible(t)) continue;
    const r = t.getBoundingClientRect();
    if (r.height < 44 || (r.width < 44 && el.type !== 'checkbox' && el.type !== 'radio')) out.small.push(name(t) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest('.confetti, .toast, noscript, script, style, svg, .bg-layer')) continue;
    if (!visible(n.parentElement)) continue;
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
    if (fs > 0 && fs < 13) out.tiny.push(name(n.parentElement) + ' ' + fs + 'px');
  }
  const m = document.querySelector('.modal');
  if (m && visible(m)) {
    const r = m.getBoundingClientRect();
    out.modal = { fitsX: r.left >= -1 && r.right <= vw + 1, fitsY: r.height <= vh + 1 || m.scrollHeight > m.clientHeight, h: Math.round(r.height), vh };
  }
  return out;
})()`;

async function audit(device, state) {
  const a = await ev(AUDIT);
  const where = `${device.name} ${device.w}x${device.h} · ${state}`;
  ok(!a.oops, `${where}: screen failed to draw`);
  ok(!a.hscroll, `${where}: page scrolls sideways`);
  ok(!a.sticking.length, `${where}: sticks out past the screen edge: ${a.sticking.slice(0, 4).join(' | ')}`);
  ok(!a.small.length, `${where}: tap target smaller than 44 px: ${a.small.slice(0, 4).join(' | ')}`);
  ok(!a.tiny.length, `${where}: text smaller than 13 px: ${a.tiny.slice(0, 4).join(' | ')}`);
  ok(!a.clipped.length, `${where}: cut-off content: ${a.clipped.slice(0, 4).join(' | ')}`);
  if (a.modal) ok(a.modal.fitsX && a.modal.fitsY, `${where}: pop-up does not fit (${a.modal.h}px tall, screen ${a.modal.vh}px)`);
}

// ---- every screen and pop-up, as a list of steps run in the page ----
const PRE = `const click = (t, sel) => { const b = [...document.querySelectorAll(sel || 'button')].find(x => !x.disabled && x.offsetParent !== null && x.textContent.includes(t)); if (!b) throw new Error('no button ' + t); b.click(); };
  const closeAll = () => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); UI.closeModal(); };`;
const STATES = [
  ['home', `closeAll(); App.go('home')`],
  ['home with ocean background', `GF.stickers.ALL.forEach(x => { App.state.rewards.owned[x.id] = 1; }); App.state.rewards.boardTheme = 'ocean'; App.syncStickers(); App.go('home')`],
  ['today question', `App.state.sessions.today = null; App.startToday()`],
  ['today meaning + sentence', `click('Meaning'); click('Sentence'); click('Part of speech')`],
  ['today after Check', `click('Check')`],
  ['today right, new sticker', `App.state.rewards.run = 2; click('Right')`, 300],
  ['pack opening', `App.givePack('the check'); App.rerender()`, 1600],
  ['surprise box', `closeAll(); App.state.rewards.pending = []; const it = GF.stickers.award(App.state.rewards, GF.util.rng(3), 2, 'box', 'the check'); UI.rewards.openPending(it)`, 1400],
  ['brain break offer', `closeAll(); App.state.rewards.pending = []; UI.rewards.offerBreak()`, 200],
  ['brain break stretch', `closeAll(); UI.rewards.stretch()`, 300],
  ['mock intro', `closeAll(); App.startMock(true)`],
  ['mock choose theme', `App.state.sessions.mock.phase = 'choose'; App.rerender()`],
  ['mock question', `click('Animals', '.choice')`],
  ['mock round 2 choose', `const s = App.state.sessions.mock; s.round = 2; s.phase = 'choose'; s.card = null; App.rerender()`],
  ['mock between rounds', `const s = App.state.sessions.mock; s.phase = 'between'; App.rerender()`],
  ['mock results', `const s = App.state.sessions.mock; const ids = App.words.filter(w => w.round2_focus).slice(0, 10).map(w => w.id);
    s.r1 = ids.slice(0, 5).map((id, i) => ({ choice: 'animals', id, tier: 'easy', right: i % 2 === 0 })); s.r2 = ids.slice(5).map((id, i) => ({ choice: 'hard', id, tier: 'hard', right: i !== 1 }));
    s.phase = 'results'; s.trophies = ['firstMock', 'mock130']; App.rerender()`],
  ['round 1 training', `App.go('train1')`],
  ['round 1 theme tiers', `App.go('train1theme', { theme: 'silent_letter' })`],
  ['silent patterns', `App.go('train1pattern')`],
  ['round 2 training', `App.go('train2')`],
  ['training board', `App.state.sessions.board = null; App.startBoard({ type: 'theme', theme: 'animals', tier: 'easy' })`],
  ['board trophy', `const s = App.state.sessions.board; s.board.finished = true; s.feedback = null; App.rerender()`, 200],
  ['last year list', `closeAll(); App.go('legacyList')`],
  ['last year question', `click('Finalist A', '.choice')`],
  ['last year results', `const s = App.state.sessions.legacy; s.r1.forEach(e => e.right = true); s.r2.forEach(e => e.right = false); s.phase = 'results'; App.rerender()`],
  ['my progress', `App.go('progress')`],
  ['A to Z', `App.go('az')`],
  ['A to Z extreme off', `App.state.az.filter.extreme = false; App.go('az')`],
  ['letter B', `App.state.az.filter.extreme = true; App.go('azLetter', { letter: 'B' })`],
  ['word list Q', `App.go('azList', { letter: 'Q' })`],
  ['A to Z question', `App.state.sessions.az = null; App.startAzPart('B', 3)`],
  ['A to Z wrong answer', `click('Check'); click('Not quite')`],
  ['A to Z letter complete', `const s = App.state.sessions.az; s.phase = 'done'; s.result = { letterDone: 'B', champion: true }; App.rerender()`, 300],
  ['extremely hard', `closeAll(); App.go('extreme')`],
  ['extremely hard list', `App.go('extremeList')`],
  ['extremely hard board', `App.state.sessions.board = null; App.startBoard({ type: 'extreme', range: 'N-S' })`],
  ['sticker book', `closeAll(); GF.stickers.drawMany(App.state.rewards, GF.util.rng(5), 30); App.state.rewards.owned.yarn = 2; App.syncStickers(); App.go('stickers')`],
  ['sticker big', `UI.rewards.showSticker('yarn')`, 200],
  ['badges', `closeAll(); App.state.rewards.badges.letters = { A: 1, B: 1, X: 1 }; App.state.rewards.badges.trophies = { firstMock: 1 }; App.go('stickers', { page: 'badges' })`],
  ['my board', `App.go('stickers', { page: 'board' })`],
  ['sticker shop', `delete App.state.rewards.owned.yarn; delete App.state.rewards.owned.kite; App.syncStickers(); App.state.rewards.stars = 30; App.go('shop')`],
  ['shop confirm', `document.querySelector('.slot.shop:not([disabled])').click()`, 200],
  ['parent menu', `closeAll(); App.parentUnlocked = true; App.go('parent')`],
  ['study plan', `App.go('plan')`],
  ['make it fit', `click('Make it fit')`, 200],
  ['settings', `closeAll(); App.go('settings')`],
  ['strategy', `App.go('strategy')`],
  ['word editor', `App.go('editor')`],
  ['edit a word', `App.go('wordForm', { id: 'horse' })`],
  ['add a word', `App.go('wordForm', { id: null })`],
  ['import', `App.go('import'); click('Paste words'); const t = document.querySelector('textarea'); t.value = 'abacus\\nhorse\\nnebulous'; t.dispatchEvent(new Event('input')); click('Preview')`],
  ['backup', `App.go('backup')`],
  ['backup as text', `UI.showText('spelling-backup.json', JSON.stringify(GF.storage.makeBackup(App.state, 1)).slice(0, 4000))`, 200],
  ['print lists', `closeAll(); App.go('print')`],
  ['mock history', `App.state.mockHistory.push({ id: 'mx', date: '2026-10-22', total: 135, r1Score: 50, r2Score: 85, round1: [{ choice: 'animals', id: 'horse', word: 'horse', right: true, points: 10 }], round2: [] }); App.go('history')`],
  ['mock history item', `App.go('historyItem', { id: 'mx' })`],
  ['reset', `App.go('reset')`],
  ['reset confirm', `document.querySelector('.danger-item').click()`, 200],
  ['nothing to fix', `closeAll(); App.go('noMistakes')`],
  ['golden word', `App.state.sessions.today = null; App.startToday(); const s = App.state.sessions.today; s.golden = s.card.id; s.goldenDone = false; App.rerender()`],
  ['golden word right', `click('Check'); click('Right')`, 200],
  ['pack with doll gift', `closeAll(); App.state.rewards.pending = []; App.givePack('the check'); App.rerender()`, 1600],
  ['dress-up studio', `closeAll(); App.state.rewards.pending = []; App.state.rewards.stars = 7; App.go('dress')`],
  ['studio hair', `App.go('dress', { slot: 'hair' })`],
  ['studio head', `App.go('dress', { slot: 'head' })`],
  ['studio eyes', `App.go('dress', { slot: 'eyes' })`],
  ['studio colours', `App.go('dress', { slot: 'outfitColor' })`],
  ['studio backdrops', `App.go('dress', { slot: 'backdrop' })`],
  ['try on, not enough stars', `document.querySelector('.item-tile.locked').click()`, 200],
  ['try on, can buy', `closeAll(); App.state.rewards.stars = 100; App.go('dress', { slot: 'back' }); document.querySelector('.item-tile.locked').click()`, 200],
  ['bought wings', `click('Get it for', '.modal button')`, 300],
  ['all dressed up', `closeAll(); const d = App.state.dress; GF.dress.ITEMS.forEach(i => { d.owned[i.id] = 1; });
    Object.assign(d.look, { outfit: 'out-lehenga', outfitColor: 'oc-red', pattern: 'pat-sparkle', hair: 'hair-wavy', hairColor: 'hc-rainbow', head: 'hd-crown', eyes: 'eye-sparkle',
      shadow: 'sha-rainbow', lips: 'lip-glitter', cheeks: 'chk-hearts', paint: 'fp-butterfly', glasses: 'gl-heart', neck: 'nk-pearls', hand: 'hn-wand', back: 'bk-fairy', pet: 'pet-unicorn', backdrop: 'bd-castle', shoes: 'sh-glass' });
    App.go('dress', { slot: 'outfit' })`],
  ['shalwar kameez and scarf', `Object.assign(App.state.dress.look, { outfit: 'out-shalwar', outfitColor: 'oc-teal', pattern: 'pat-flowers', head: 'hd-scarf', back: 'bk-none', pet: 'pet-kitten', backdrop: 'bd-mountains', glasses: 'gl-none', hand: 'hn-flowers', skin: 'skin4' }); App.go('dress', { slot: 'outfit' })`],
  ['my looks', `const d = App.state.dress; d.looks = []; for (let i = 0; i < 4; i++) { GF.dress.surprise(d, GF.util.rng(i + 1)); GF.dress.saveLook(d, i); } App.go('dressLooks')`],
  ['space background', `App.state.rewards.boardTheme = 'space'; App.go('home')`],
  ['candy background on a board', `App.state.rewards.boardTheme = 'candy'; App.state.sessions.board = null; App.startBoard({ type: 'theme', theme: 'animals', tier: 'medium' })`]
];

const DEVICES = [
  { name: 'Small Android', w: 360, h: 640, dpr: 3, mobile: true, ua: 'android' },
  { name: 'iPhone SE', w: 375, h: 667, dpr: 2, mobile: true, ua: 'iphone' },
  { name: 'iPhone 14', w: 390, h: 844, dpr: 3, mobile: true, ua: 'iphone', shots: true },
  { name: 'Pixel 7', w: 412, h: 915, dpr: 2.625, mobile: true, ua: 'android' },
  { name: 'Phone sideways', w: 844, h: 390, dpr: 3, mobile: true, ua: 'iphone' },
  { name: 'iPad', w: 768, h: 1024, dpr: 2, mobile: true, ua: 'ipad' },
  { name: 'iPad sideways', w: 1024, h: 768, dpr: 2, mobile: true, ua: 'ipad' }
];
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
};

console.log('Browser: ' + exe);
console.log('Serving ' + base);
for (const [i, d] of DEVICES.entries()) {
  console.log(`\n${d.name} (${d.w}x${d.h})`);
  await S('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: d.mobile, screenOrientation: d.w > d.h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
  await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await S('Emulation.setUserAgentOverride', { userAgent: UA[d.ua] });
  // one device in dark mode with reduced motion, to check those too
  await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: i % 2 ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: i === 3 ? 'reduce' : 'no-preference' }] });
  await load(base + 'index.html');
  await ev(`localStorage.clear(); true`);
  await load(base + 'index.html');
  await ev(`App.state.settings.brainBreak = false; App.state.settings.cheerVoice = false; App.state.settings.timer = 'off'; App.save(); true`);
  const before = errors.length;
  for (const [state, js, wait] of STATES) {
    try { await ev(`(() => { ${PRE} ${js}; return true; })()`); }
    catch (e) { fail(`${d.name} · ${state}: could not open (${e.message.split('\n')[0]})`); continue; }
    await sleep(wait || 120);
    await audit(d, state);
    if (d.shots) await shot(`${String(STATES.findIndex((s) => s[0] === state)).padStart(2, '0')}-${state.replace(/[^a-z0-9]+/gi, '-')}`);
  }
  ok(errors.length === before, `${d.name}: no errors` + (errors.length > before ? ': ' + errors.slice(before, before + 5).join(' | ') : ''));
  console.log(`  ${STATES.length} screens checked`);
}

// ---- a real tap-through on a phone: hold the parent button with a finger ----
console.log('\nTouch: press and hold the parent button');
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await load(base + 'index.html');
const pt = await ev(`(() => { App.go('home'); const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Parent area')); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
await sleep(3300);
await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
ok(await ev(`App.state.ui.screen`) === 'parent', 'Holding the parent button for 3 s with a finger opens the parent area');
const tap = async (text) => {
  const p = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.textContent.includes(${JSON.stringify(text)})); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!p) throw new Error('nothing to tap: ' + text);
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
};
await ev(`App.state.sessions = {}; App.state.rewards.pending = []; App.save(); true`);
await tap('Lock and go home');
await tap("Today's practice");
await tap('Check');
await tap('Right');
ok(await ev(`!!App.state.sessions.today.feedback && App.state.sessions.today.feedback.right === true`), 'Finger taps: Check then Right records a right answer');
await tap('Next word');
ok(await ev(`!App.state.sessions.today.feedback && !!document.querySelector('.btn.check')`), 'Finger tap: Next word shows the next question');

// ---- offline after the first visit ----
console.log('\nOffline');
await load(base + 'index.html');
const reg = await ev(`navigator.serviceWorker ? navigator.serviceWorker.ready.then(r => !!r.active) : false`);
ok(reg, 'The offline helper is installed after the first visit');
await sleep(800);
await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await load(base + 'index.html');
ok(await ev(`!!(window.App && App.words && App.words.length === 3666 && document.querySelector('.screen') && !/Oops/.test(document.body.innerText))`), 'With no internet the app still opens, with all 3,666 words');
await S('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
ok(await ev(`!!document.querySelector('link[rel=manifest]') && !!document.querySelector('link[rel=apple-touch-icon]')`), 'Home-screen icon and app manifest are linked');

// ---- inside another page (like a hosted link) ----
console.log('\nInside another page');
await load(base + '__embed.html');
const emb = await ev(`(async () => {
  const w = document.getElementById('f').contentWindow;
  for (let i = 0; i < 30 && !(w.App && w.App.state); i++) await new Promise(r => setTimeout(r, 100));
  const App = w.App;
  App.parentUnlocked = true; App.go('print');
  const printHidden = [...w.document.querySelectorAll('.print-btn')].every(b => w.getComputedStyle(b).display === 'none');
  App.doBackupDownload();
  await new Promise(r => setTimeout(r, 200));
  const copyBox = !!w.document.querySelector('.copybox');
  return { embedded: App.embedded, printHidden, copyBox, words: App.words.length };
})()`);
ok(emb.embedded && emb.printHidden && emb.copyBox && emb.words === 3666, `Inside another page: print buttons hidden, backup shown as text to copy (${JSON.stringify(emb)})`);

await browser.close();
server.close();
console.log(`\n${checks} checks. Screenshots of every screen at 390 px: ${outDir}`);
if (problems.length) { console.log(`\n${problems.length} problem(s).`); process.exit(1); }
console.log('\nAll phone and tablet checks passed.');
process.exit(0);
