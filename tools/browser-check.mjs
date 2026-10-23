#!/usr/bin/env node
// Headless browser check of index.html opened from file:// (no dependencies).
// Needs Node 18+ and Chrome or Edge installed.
// Usage: node tools/browser-check.mjs [--browser "C:/path/chrome.exe"] [--out folder-for-screenshots]
//
// Runs: 10 answers of Today's practice, a full Mock Final with right, wrong and undo, a check that the
// word never shows before Check, a reload mid-mock, importing the template CSV, a backup download,
// the print view of one tier, and layout checks at 360 / 768 / 1280 px. Also: an old saved state
// migrating, the A-Z tab (one part with a wrong answer, a reload mid-part, the pack opening), the
// sticker shop and book, the Extremely hard tab, undo of stars, and a brain break.
// Fails on console errors or any network request.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const outDir = resolve(arg('--out') || join(tmpdir(), 'gfp-browser-check'));
mkdirSync(outDir, { recursive: true });

const candidates = [arg('--browser'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].filter(Boolean);
const exe = candidates.find((p) => existsSync(p));
if (!exe) { console.log('No Chrome or Edge found. Use the manual checklist in README.md instead.'); process.exit(2); }

const profile = mkdtempSync(join(tmpdir(), 'gfp-profile-'));
const downloads = join(outDir, 'downloads');
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });
// Node 22+ has a built-in WebSocket; older Node talks to the browser over a pipe instead.
const usePipe = typeof WebSocket === 'undefined';
const flags = ['--headless=new', usePipe ? '--remote-debugging-pipe' : '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900', 'about:blank'];
const proc = spawn(exe, flags, { stdio: usePipe ? ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'] });

// ---- tiny CDP client ----
let nextId = 1;
const pending = new Map();
const handlers = [];
function onMessage(text) {
  const msg = JSON.parse(text);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
  else if (msg.method) handlers.forEach((h) => h(msg));
}
let write, closeTransport;
if (usePipe) {
  const toBrowser = proc.stdio[3], fromBrowser = proc.stdio[4];
  let buf = '';
  fromBrowser.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 1); if (m) onMessage(m); }
  });
  write = (s) => toBrowser.write(s + '\0');
  closeTransport = () => { try { toBrowser.end(); } catch (e) { /* ignore */ } };
} else {
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('Browser did not start')), 20000);
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (ev) => onMessage(ev.data));
  write = (s) => ws.send(s);
  closeTransport = () => closeTransport();
}
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  write(JSON.stringify({ id, method, params, sessionId }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

const problems = [];
const errors = [];
const requests = [];
handlers.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push('console.' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
});
await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable'); await S('Page.enable'); await S('DOM.enable');
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 200));
  return r.result.value;
}
const check = (ok, msg) => { if (!ok) { problems.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const fileUrl = pathToFileURL(join(root, 'index.html')).href;

async function load() {
  const loaded = new Promise((r) => { const h = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); });
  await S('Page.navigate', { url: fileUrl });
  await loaded;
  await sleep(1800); // voices wait (1.5 s fallback)
}
async function clickText(text, sel = 'button') {
  const ok = await ev(`(() => { const t = ${JSON.stringify(text)}; const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.disabled && x.offsetParent !== null && x.textContent.includes(t)); if (!b) return false; b.click(); return true; })()`);
  if (!ok) throw new Error('No button with text: ' + text + '\n--- page text ---\n' + (await ev('document.body.innerText')).slice(0, 1500));
  await sleep(120);
}
async function hold(text, ms) {
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(text)})); b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerId:1})); return true; })()`);
  await sleep(ms);
  await sleep(200);
}
async function screenshot(name) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function setSize(w, hgt, mobile) {
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: hgt, deviceScaleFactor: 1, mobile: !!mobile });
  await sleep(150);
}
const noHScroll = () => ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1');

// The current word must not be visible anywhere in the page text, the title, or attribute text.
async function wordHidden(label) {
  const r = await ev(`(() => {
    const st = App.state, s = st.sessions[st.ui.screen === 'azPlay' ? 'az' : st.ui.screen];
    if (!s || !s.card || s.card.revealed || s.feedback) return { skip: true };
    const w = App.word(s.card.id);
    const parts = [w.word, w.display].concat(w.word.split(/[ -]/)).filter(p => p.length > 1);
    const text = document.body.innerText + ' ' + document.title + ' ' +
      [...document.querySelectorAll('[aria-label],[title],[value]')].map(e => (e.getAttribute('aria-label')||'') + ' ' + (e.getAttribute('title')||'') + ' ' + (e.value||'')).join(' ');
    const hits = parts.filter(p => new RegExp('(^|[^a-z])' + p.toLowerCase().replace(/[^a-z]/g, m => '\\\\' + m) + '([^a-z]|$)', 'i').test(text));
    return { word: w.word, hits };
  })()`);
  if (r.skip) return;
  // A few words are also ordinary UI words (e.g. "start" on the board). Report them separately.
  const ui = await ev(`(() => { const t = ${JSON.stringify(r.hits)}; return t; })()`);
  check(r.hits.length === 0, `${label}: word "${r.word}" is hidden before Check` + (ui.length ? ` (found: ${ui.join(', ')})` : ''));
}

console.log('Browser: ' + exe);
console.log('Opening ' + fileUrl);
await load();
// ---- an old (version 1) saved state migrates with nothing lost ----
console.log('Migration of an old saved state');
await ev(`localStorage.clear(); localStorage.setItem('spellingWhizz.v1', JSON.stringify({
  schemaVersion: 1, createdAt: Date.now() - 20 * 86400000, profile: { name: 'Zara', avatar: '🦄', stickers: 23 },
  settings: { dailyGoal: 60, boardLength: 10 }, plan: { geography: ['easy'], animals: ['easy', 'hard'], silent_letter: ['medium'], round2: { levels: ['hard'], focus_only: true } },
  progress: { horse: { box: 3, seen: 4, right: 3, wrong: 1, streak: 2, lastSeen: 1, lastDay: '2026-10-19', lastResult: 'right', days: ['2026-10-19'] } },
  log: [], activity: {}, mockHistory: [{ id: 'm1', date: '2026-10-19', total: 120, r1Score: 40, r2Score: 80, round1: [], round2: [] }],
  legacyHistory: [], overlay: { added: [], edited: {}, hidden: ['camel'] }, backup: { lastAt: null, answersSince: 3, remindAfter: Date.now() }, sessions: {}, ui: { screen: 'home', params: {} }
})); true`);
await load();
check(await ev(`(() => { const s = App.state; return s.schemaVersion === 2 && s.profile.name === 'Zara' && s.progress.horse.box === 3 && s.mockHistory.length === 1
  && s.settings.dailyGoal === 60 && s.plan.animals.join() === 'easy,hard' && s.plan.list_9_11.join() === 'easy,medium,hard' && s.overlay.hidden[0] === 'camel'
  && GF.stickers.total(s.rewards) === 23 && s.profile.stickers === 23; })()`), 'Old saved state migrated: progress, mocks, settings, plan, word changes and 23 stickers kept');
await ev('localStorage.clear(); true');
await load();
await ev('App.state.settings.brainBreak = false; App.save(); true');
check(errors.length === 0, 'Loads with no errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
check(await ev('["home","today","mock","board","legacy","parent","plan","settings","editor","wordForm","import","backup","print","history","reset","strategy","progress","az","azLetter","azList","azPlay","extreme","extremeList","stickers","shop"].every(s => typeof App.screens[s] === "function")'), 'All screens loaded');
check(await ev('!!document.querySelector(".mode.today")'), 'Home screen renders');
check(await ev('/days? to the final|final is today|final was/.test(document.body.innerText)'), 'Countdown shows');
check(await ev('/Plan: \\d+ of 1964 words mastered/.test(document.body.innerText)'), 'Plan progress shows 1,964 words');
check(await ev('document.title') === 'Grand Finale Practice', 'Page title is plain');
const mode = await ev('UI.speech.mode()');
console.log('  (speech mode in headless browser: ' + mode + ')');
await screenshot('01-home-1280');

// ---- Today's practice: 10 answers ----
console.log("Today's practice: 10 answers");
await clickText("Today's practice");
for (let i = 0; i < 10; i++) {
  await wordHidden('Today #' + (i + 1));
  if (i === 0) {
    await clickText('Meaning'); await clickText('Sentence'); await clickText('Part of speech');
    await wordHidden('Today #1 after Meaning/Sentence');
    // Parent reads mode (used automatically when there is no voice)
    await ev('App.state.settings.speech = "parent"; UI.speech.configure(App.state.settings); App.rerender(); true');
    check(await ev('!!document.querySelector(".parent-panel") && !document.querySelector(".parent-word")'), 'Parent reads: panel present, word not in the page');
    await wordHidden('Today #1 in Parent reads mode');
    await clickText('Parent: tap to see the word');
    check(await ev('!!document.querySelector(".parent-word .pw")'), 'Parent reads: word shown only after tapping the panel');
    await clickText('Hide the word');
    await wordHidden('Today #1 after hiding the parent panel');
    await ev('App.state.settings.speech = "auto"; UI.speech.configure(App.state.settings); App.rerender(); true');
    await screenshot('02-today-card-1280');
  }
  await clickText('Check');
  check(await ev('!!document.querySelector(".letters")'), `Today #${i + 1}: word revealed after Check`);
  await clickText(i % 3 === 2 ? 'Not quite' : 'Right');
  if (i === 1) {
    // double tap is ignored
    const before = await ev('App.state.sessions.today.count');
    await ev('[...document.querySelectorAll("button")].filter(b => /Right|Not quite/.test(b.textContent)).forEach(b => b.click()); true');
    check(await ev('App.state.sessions.today.count') === before, 'No double-scoring after a second tap');
  }
  await clickText('Next word');
}
// Words that are also UI words must still be hidden (e.g. "answer" in "Undo last answer").
{
  const saved = await ev('JSON.stringify(App.state.sessions.today.card)');
  const ids = await ev('["answer","meaning","sentence","check","today","practice","start","word","part","speech","again","parent","voice","grand","final","square","score","timer","new","hear","say"].filter(id => App.byId[id])');
  for (const id of ids) {
    await ev(`App.state.sessions.today.card = { id: ${JSON.stringify(id)}, revealed: false, spoken: true, asked: { meaning: true, sentence: true, pos: true } }; App.rerender(); true`);
    await wordHidden('UI-word collision');
  }
  await ev(`App.state.sessions.today.card = ${saved}; App.rerender(); true`);
}
check(await ev('App.state.sessions.today.count') === 10, 'Today count is 10');
check(await ev('/10 \\/ 40/.test(document.body.innerText)'), 'Shows "10 / 40 today"');
// undo on the board
const beforeUndo = await ev('JSON.stringify({pos: App.state.sessions.today.board.pos, count: App.state.sessions.today.count})');
await clickText('Check'); await clickText('Right');
await clickText('Undo last answer');
check(await ev('JSON.stringify({pos: App.state.sessions.today.board.pos, count: App.state.sessions.today.count})') === beforeUndo, 'Undo restores board position and count');
check(await ev('!!document.querySelector(".judge")'), 'After undo the word can be judged again');
await screenshot('03-today-after-undo-1280');

// ---- Mock Final ----
console.log('Mock Final');
await clickText('🏠', 'button');
await clickText('Mock Final');
await clickText("Let's start");
const plan1 = [['Animals', true], ['Geography', false], ['Silent letters', true], ['Animals', true], ['Geography', true]];
for (let i = 0; i < 5; i++) {
  await clickText(plan1[i][0], '.choice');
  await wordHidden('Mock R1 #' + (i + 1));
  if (i === 0) {
    // change the theme before the word is heard
    await clickText('Change my theme');
    check(await ev('App.state.sessions.mock.phase') === 'choose' && await ev('App.state.sessions.mock.r1.length') === 0, 'Theme choice can be undone before the word is spoken');
    await clickText(plan1[i][0], '.choice');
    await clickText('Hear the word');
    check(await ev('!document.body.innerText.includes("Change my theme")'), 'Theme choice locks once the word is spoken');
  }
  await clickText('Check');
  await clickText(plan1[i][1] ? 'Right' : 'Not quite');
  if (i === 2) {
    await clickText('Undo last answer');
    check(await ev('App.state.sessions.mock.r1[2].right') === null, 'Undo in the mock clears the answer');
    await clickText('Not quite');
    plan1[2][1] = false;
  }
  await clickText('Next');
}
const r1Expected = plan1.filter((x) => x[1]).length * 10;
check(await ev('App.state.sessions.mock.phase') === 'between', 'Between-rounds screen');
check(await ev(`document.body.innerText.includes("${r1Expected} points")`), `Round 1 score is ${r1Expected}`);
await clickText('Start Round 2');
const plan2 = [['Hard', true], ['Medium', false], ['Easy', true], ['Hard', false], ['Hard', true]];
for (let i = 0; i < 5; i++) {
  await clickText(plan2[i][0], '.choice');
  await wordHidden('Mock R2 #' + (i + 1));
  if (i === 2) {
    // reload mid-mock: must resume at the same word, still hidden
    const id = await ev('App.state.sessions.mock.card.id');
    await load();
    check(await ev('App.state.ui.screen') === 'mock' && await ev('App.state.sessions.mock.card.id') === id, 'Reload resumes the mock at the same word');
    check(await ev('!document.querySelector(".letters")'), 'Word still hidden after reload');
    await wordHidden('Mock after reload');
  }
  await clickText('Check');
  await clickText(plan2[i][1] ? 'Right' : 'Not quite');
  await clickText('Next');
}
const pts = { Easy: 5, Medium: 10, Hard: 20 };
const r2Expected = plan2.reduce((s, [l, ok]) => s + (ok ? pts[l] : -5), 0);
const total = await ev('App.state.mockHistory[App.state.mockHistory.length - 1].total');
check(total === r1Expected + r2Expected, `Mock total ${total} = ${r1Expected} + ${r2Expected}`);
check(await ev('App.state.mockHistory.length') === 1, 'Mock saved to history once');
await screenshot('04-mock-results-1280');
await load(); // results page survives reload without double-saving
check(await ev('App.state.mockHistory.length') === 1, 'No double save after reload');
await clickText('🏠', 'button');
await clickText('My progress');
check(await ev(`document.body.innerText.includes("${total}")`), 'My progress shows the mock score');

// ---- Training board by pattern ----
console.log('Training boards');
await clickText('🏠', 'button');
await clickText('Round 1 training');
await clickText('Silent letters', '.choice');
await clickText('By pattern', '.choice');
await clickText('Silent k', '.choice');
await wordHidden('Pattern board');
check(await ev('App.state.sessions.board.spec.pattern') === 'k', 'Pattern board started');
await clickText('Check'); await clickText('Right'); await clickText('Next word');
check(await ev('App.state.sessions.board.board.pos') === 1, 'Board token moved forward');
await clickText('🏠', 'button');
await clickText('Fix my mistakes');
check(await ev('App.state.ui.screen') === 'board' || await ev('App.state.ui.screen') === 'noMistakes', 'Fix my mistakes opens');
await clickText('🏠', 'button');
await clickText("Last year's final");
await clickText('Finalist E', '.choice');
for (let i = 0; i < 5; i++) { await wordHidden('Legacy #' + (i + 1)); await clickText('Check'); await clickText('Right'); await clickText('Next'); }
check(await ev('App.state.sessions.legacy.phase') === 'results', 'Last year\'s final (eliminated finalist) ends after round 1');
check(await ev('document.body.innerText.includes("tricky last year")'), 'Missed words tagged "tricky last year"');

// ---- A-Z ----
console.log('A to Z');
async function closePacks() {
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    const open = await ev('!!document.querySelector(".pack-back")');
    if (!open) return;
    await clickText('Put them in my book');
  }
}
await clickText('🏠', 'button');
await clickText('A to Z');
check(await ev('/Letters done: 0 of 26 · Words done: 0 of 2,990/.test(document.body.innerText)'), 'A-Z header: 0 of 26 letters, 0 of 2,990 words');
check(await ev('document.querySelectorAll(".az-tile").length') === 26, '26 letter tiles');
await clickText('Extremely hard words: on');
check(await ev('/Words done: 0 of 2,776/.test(document.body.innerText) && /extremely hard \\(hidden\\)/.test(document.body.innerText)'), 'Extreme switch off: 2,776 words and "+N extremely hard (hidden)" on tiles');
await clickText('Extremely hard words: off');
// the letter with the fewest words
const fewest = await ev('GF.az.overview(App.words, App.state.az.filter, {}).letters.slice().sort((a, b) => a.total - b.total)[0].letter');
await clickText(fewest, '.az-tile');
await clickText('Start part');
check(await ev('App.state.ui.screen') === 'azPlay', `A-Z part of ${fewest} started`);
await wordHidden('A-Z #1');
check(await ev(`/${fewest} · Part 1 of 1 · word 1 of \\d+/.test(document.body.innerText)`), 'Shows "letter · Part 1 of 1 · word 1 of N"');
const firstId = await ev('App.state.sessions.az.card.id');
await clickText('Check'); await clickText('Not quite');
check(await ev('document.body.innerText.includes("comes back once")'), 'A wrong word says it comes back once');
await clickText('Next word');
// reload mid-part
const resumeId = await ev('App.state.sessions.az.card.id');
await load();
check(await ev('App.state.ui.screen') === 'azPlay' && await ev('App.state.sessions.az.card.id') === resumeId, 'Reload mid-part resumes at the same word');
await wordHidden('A-Z after reload');
let guard = 0, sawRetry = false;
while (guard++ < 50 && await ev('App.state.sessions.az.phase') !== 'done') {
  if (await ev('!!App.state.sessions.az.feedback')) { await clickText(await ev('document.body.innerText.includes("Finish the part")') ? 'Finish the part' : 'Next word'); continue; }
  if (await ev(`App.state.sessions.az.card.id === ${JSON.stringify(firstId)}`)) sawRetry = true;
  await wordHidden('A-Z word');
  await clickText('Check'); await clickText('Right');
  await closePacks();
}
check(sawRetry, 'The wrong word came back at the end of the part');
check(await ev('App.state.az.w[' + JSON.stringify(firstId) + ']') === 'd', 'Right on the second try: done');
check(await ev('document.body.innerText.includes("Part 1 of 1 done")'), 'Part complete screen');
check(await ev(`App.state.rewards.badges.letters[${JSON.stringify(fewest)}]`) && await ev('document.body.innerText.includes("complete!")'), `Letter ${fewest} complete: golden letter`);
check(await ev('GF.stickers.total(App.state.rewards)') >= 3, 'Pack opening gave stickers');
await screenshot('11-az-part-done');
await clickText('A to Z');
check(await ev('/Letters done: 1 of 26/.test(document.body.innerText)'), 'A-Z header counts the finished letter');

// pack opening shows when a pack is waiting
await ev('App.givePack("the browser check"); App.save(); App.rerender(); true');
await sleep(2000);
check(await ev('document.querySelectorAll(".pack-back .flip").length') === 3, 'Pack opening shows 3 cards');
await screenshot('12-pack-opening');
await clickText('Put them in my book');

// sticker shop: buy the yarn
await ev('App.state.rewards.stars = 15; delete App.state.rewards.owned.yarn; App.syncStickers(); App.save(); App.rerender(); true');
await clickText('⭐ 15');
check(await ev('App.state.ui.screen') === 'stickers', 'Star button opens the sticker book');
await clickText('Sticker shop');
await ev('[...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Buy Yarn ball for 15 stars").click(); true');
await sleep(150);
await clickText('Yes, get it', '.modal button');
check(await ev('App.state.rewards.stars') === 0 && await ev('App.state.rewards.owned.yarn') === 1, 'Shop: 15 stars spent, yarn in the book');
await clickText('Sticker book');
check(await ev('document.querySelector(".book-total").textContent.startsWith(GF.stickers.unique(App.state.rewards) + " of 96 collected")'), 'Sticker book count is right');
await screenshot('13-sticker-book');

// undo takes back the star and sticker of an answer
await clickText('🏠', 'button');
await clickText("Today's practice");
const checkIfNeeded = async () => { if (await ev('!!document.querySelector(".btn.check")')) await clickText('Check'); };
const before = await ev('JSON.stringify([App.state.rewards.stars, GF.stickers.total(App.state.rewards)])');
await checkIfNeeded(); await clickText('Right');
check(await ev('App.state.rewards.stars') === JSON.parse(before)[0] + 1, 'A right answer earns a star');
await clickText('Undo last answer');
check(await ev('JSON.stringify([App.state.rewards.stars, GF.stickers.total(App.state.rewards)])') === before, 'Undo takes the star back');

// brain break after 20 minutes
await ev('App.state.settings.brainBreak = true; App.state.rewards.practiceMs = 20 * 60000 - 500; App.state.rewards.lastAnswerAt = Date.now() - 1000; App.save(); true');
await checkIfNeeded(); await clickText('Right');
await sleep(900);
check(await ev('document.body.innerText.includes("Brain break time")'), 'Brain break offered after 20 minutes');
await clickText('Parent: skip', '.modal button');
check(await ev('App.state.rewards.breakDue === false && App.state.rewards.practiceMs === 0'), 'Skipping the brain break resets the timer');
await ev('App.state.settings.brainBreak = false; App.save(); true');
await closePacks();

// Extremely hard tab
await clickText('🏠', 'button');
await clickText('Extremely hard');
check(await ev('document.body.innerText.includes("Off the study plan by default") || document.body.innerText.includes("off the study plan by default")'), 'Extremely hard tab shows the parent note');
await clickText('A–F', '.choice');
check(await ev('App.state.sessions.board.spec.type') === 'extreme', 'Extremely hard board started');
await wordHidden('Extremely hard board');
check(await ev('App.word(App.state.sessions.board.card.id).extreme && App.word(App.state.sessions.board.card.id).letter <= "F"'), 'Board word is an extremely hard A–F word');
await clickText('🏠', 'button');
await clickText('Extremely hard');
await clickText('See every word');
check(await ev('document.querySelectorAll(".wordlist li").length') === 214, 'Extremely hard list shows 214 words');

// ---- Parent area ----
console.log('Parent area');
await clickText('🏠', 'button');
await hold('Parent area', 1000);
check(await ev('App.state.ui.screen') === 'home', 'A short press does not open the parent area');
await ev('[...document.querySelectorAll("button")].find(x => x.textContent.includes("Parent area")).dispatchEvent(new PointerEvent("pointerup", {bubbles:true}))');
await hold('Parent area', 3200);
check(await ev('App.state.ui.screen') === 'parent', 'Holding 3 s opens the parent area');

// import the template CSV
await clickText('Import words');
const { root: docRoot } = await S('DOM.getDocument', { depth: -1 });
const { nodeId } = await S('DOM.querySelector', { nodeId: docRoot.nodeId, selector: 'input[type=file]' });
await S('DOM.setFileInputFiles', { nodeId, files: [join(root, 'data', 'add-words-template.csv')] });
await sleep(500);
await clickText('Preview');
const pv = await ev('(() => { const p = document.body.innerText; return { fresh: /New \\((\\d+)\\)/.exec(p)?.[1], same: /Same as the bank \\(skipped\\) \\((\\d+)\\)/.exec(p)?.[1], diff: /Different from the bank \\((\\d+)\\)/.exec(p)?.[1], prob: /Problems \\((\\d+)\\)/.exec(p)?.[1] }; })()');
check(+pv.fresh + +pv.same + +pv.diff === 3 && +pv.prob === 0, `Template preview: new ${pv.fresh}, same ${pv.same}, different ${pv.diff}, problems ${pv.prob}`);
await ev('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Use imported for all"))?.click(); true');
await sleep(150);
await clickText('Import ');
await sleep(200);
check(await ev('document.body.innerText.includes("Import done")'), 'Import summary shown');
await clickText('OK');
check(await ev('!!App.byId.fiji && !!App.byId.thistle && !!App.byId.telescope'), 'Template words are in the bank after import');
await screenshot('05-import-1280');

// backup download
await clickText('← Back');
await clickText('Export and backup');
await clickText('Download backup');
let file = null;
for (let i = 0; i < 40 && !file; i++) { await sleep(150); file = readdirSync(downloads).find((f) => /^spelling-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)); }
check(!!file, 'Backup file downloaded' + (file ? ': ' + file : ''));
if (file) {
  const b = JSON.parse(readFileSync(join(downloads, file), 'utf8'));
  check(b.app === 'grandFinalePractice' && b.backupVersion === 1 && b.mockHistory.length === 1, 'Backup content is valid');
}

// print view of one tier
await clickText('← Back');
await clickText('Print lists');
await S('Emulation.setEmulatedMedia', { media: 'print' });
await sleep(150);
const pr = await ev('(() => { const s = document.querySelector(".print-sheet"); const l = document.querySelector(".plist"); const top = document.querySelector(".topbar"); return { visible: s && getComputedStyle(s).display !== "none", cols: l && getComputedStyle(l).columnCount, top: top && getComputedStyle(top).display, items: document.querySelectorAll(".plist li").length }; })()');
check(pr.visible && pr.cols === '2' && pr.top === 'none' && pr.items === 42, `Print view: list visible, 2 columns, header hidden, ${pr.items} words (Geography easy)`);
const pdf = await S('Page.printToPDF', { printBackground: false });
writeFileSync(join(outDir, '06-print-geography-easy.pdf'), Buffer.from(pdf.data, 'base64'));
await S('Emulation.setEmulatedMedia', { media: '' });

// ---- layouts ----
console.log('Layouts');
for (const [w, hgt, name] of [[360, 740, 'phone'], [740, 360, 'phone-landscape'], [768, 1024, 'tablet'], [1024, 768, 'tablet-landscape'], [1280, 800, 'laptop']]) {
  await setSize(w, hgt, w < 900);
  await clickText('🏠', 'button');
  check(await noHScroll(), `${name} ${w}px: home has no horizontal scroll`);
  if (w === 360 || w === 768) await screenshot(`07-home-${w}`);
  await clickText("Today's practice");
  check(await noHScroll(), `${name} ${w}px: question card has no horizontal scroll`);
  const small = await ev('[...document.querySelectorAll("button")].filter(b => b.offsetParent && b.getBoundingClientRect().height < 55.5).map(b => b.textContent.trim().slice(0, 30))');
  check(small.length === 0, `${name} ${w}px: buttons are at least 56 px tall` + (small.length ? ' (' + small.join(' | ') + ')' : ''));
  if (w === 360 || w === 768) await screenshot(`08-card-${w}`);
  if (await ev('!!document.querySelector(".btn.check")')) await clickText('Check');
  check(await noHScroll(), `${name} ${w}px: reveal has no horizontal scroll`);
  if (w === 360) await screenshot('09-reveal-360');
  await clickText('🏠', 'button');
  await clickText('Mock Final');
  check(await noHScroll(), `${name} ${w}px: mock has no horizontal scroll`);
  await clickText('🏠', 'button');
  await clickText('My progress');
  check(await noHScroll(), `${name} ${w}px: progress has no horizontal scroll`);
  for (const [screen, params] of [['az', {}], ['azLetter', { letter: 'B' }], ['azList', { letter: 'Q' }], ['stickers', {}], ['stickers', { page: 'badges' }], ['stickers', { page: 'board' }], ['shop', {}], ['extreme', {}]]) {
    await ev(`App.go(${JSON.stringify(screen)}, ${JSON.stringify(params)}); true`);
    check(await noHScroll(), `${name} ${w}px: ${screen} ${params.page || params.letter || ''} has no horizontal scroll`);
    if (w === 360 && (screen === 'az' || screen === 'stickers')) await screenshot(`14-${screen}-${params.page || 'main'}-360`);
  }
}
await setSize(360, 740, true);
await clickText('🏠', 'button');
await hold('Parent area', 3200);
for (const item of ['Study plan', 'Strategy tips', 'Settings', 'Word editor', 'Import words', 'Print lists', 'Mock history', 'Reset']) {
  await clickText(item);
  check(await noHScroll(), `360px: ${item} has no horizontal scroll`);
  if (item === 'Study plan' || item === 'Word editor') await screenshot('10-' + item.replace(/ /g, '-').toLowerCase() + '-360');
  await clickText('← Back');
}

// ---- errors and network ----
const external = requests.filter((u) => !/^(file|data|blob|about|chrome|devtools):/.test(u));
check(external.length === 0, 'No network requests' + (external.length ? ': ' + external.slice(0, 5).join(', ') : ''));
check(errors.length === 0, 'No console errors' + (errors.length ? ':\n    ' + errors.slice(0, 10).join('\n    ') : ''));

closeTransport();
proc.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* the browser may still hold a file */ }
console.log('\nScreenshots and files: ' + outDir);
if (problems.length) { console.log(`\n${problems.length} problem(s).`); process.exit(1); }
console.log('\nAll browser checks passed.');
process.exit(0);
