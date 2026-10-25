const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GF, bank } = require('./_load.js');
const St = GF.storage;

function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()], m };
}

test('fresh start when nothing is saved', () => {
  const r = St.load(fakeStorage(), 1000);
  assert.strictEqual(r.fresh, true);
  assert.strictEqual(r.notice, null);
  assert.strictEqual(r.state.settings.dailyGoal, 40);
});

test('save and load round trip', () => {
  const s = fakeStorage();
  const st = St.defaultState(5);
  st.profile.name = 'Zara';
  st.progress.horse = { box: 2, seen: 2, right: 2, wrong: 0, streak: 2, lastSeen: 1, lastDay: '2026-10-20', lastResult: 'right', days: ['2026-10-20'] };
  assert.ok(St.save(s, st));
  const r = St.load(s, 10);
  assert.strictEqual(r.state.profile.name, 'Zara');
  assert.strictEqual(r.state.progress.horse.box, 2);
});

test('corrupt JSON is copied aside and the app starts clean with a notice', () => {
  const s = fakeStorage({ [St.KEY]: '{"schemaVersion":1, "progress": {broken' });
  const r = St.load(s, 1234);
  assert.strictEqual(r.fresh, true);
  assert.ok(r.notice && /started fresh/.test(r.notice));
  assert.strictEqual(s.getItem('spellingWhizz.corrupt.1234'), '{"schemaVersion":1, "progress": {broken');
  assert.strictEqual(JSON.parse(s.getItem(St.KEY)).schemaVersion, GF.migrations.CURRENT);
});

test('structurally bad data is treated as corrupt too', () => {
  const s = fakeStorage({ [St.KEY]: JSON.stringify({ schemaVersion: 2, progress: { horse: { box: 9 } } }) });
  const r = St.load(s, 77);
  assert.ok(r.corruptKey);
  assert.deepStrictEqual(r.state.progress, {});
});

test('a storage that throws does not crash', () => {
  const r = St.load({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, 1);
  assert.strictEqual(r.storageOk, false);
  assert.ok(r.notice);
  assert.strictEqual(St.save({ setItem() { throw new Error('full'); } }, r.state), false);
});

test('migration from a fake v0', () => {
  const v0 = { version: 0, name: 'Amna', avatar: '🐱', progress: { horse: { box: 3, right: 3, wrong: 1 } }, mocks: [{ total: 90 }] };
  const s = fakeStorage({ [St.KEY]: JSON.stringify(v0) });
  const r = St.load(s, 1);
  assert.strictEqual(r.notice, null);
  assert.strictEqual(r.state.schemaVersion, 2);
  assert.strictEqual(r.state.profile.name, 'Amna');
  assert.strictEqual(r.state.progress.horse.box, 3);
  assert.strictEqual(r.state.progress.horse.seen, 4);
  assert.strictEqual(r.state.mockHistory[0].total, 90);
  assert.ok(GF.migrations.table[0]);
});

test('backup round trip and validation', () => {
  const st = St.defaultState(5);
  st.profile.name = 'Hira';
  st.mockHistory.push({ id: 'm1', total: 120 });
  const b = St.makeBackup(st, Date.parse('2026-10-22T10:00:00Z'));
  assert.strictEqual(b.app, 'grandFinalePractice');
  assert.strictEqual(b.backupVersion, 1);
  for (const k of ['savedAt', 'settings', 'plan', 'profile', 'progress', 'mockHistory', 'overlay']) assert.ok(k in b, k);
  const r = St.readBackup(JSON.stringify(b));
  assert.ok(r.ok);
  assert.strictEqual(r.summary.name, 'Hira');
  assert.strictEqual(r.summary.mocks, 1);
  assert.strictEqual(St.readBackup('nope').ok, false);
  assert.strictEqual(St.readBackup('{"app":"other"}').ok, false);
});

test('backup reminder after 100 answers or 3 days', () => {
  const st = St.defaultState(0);
  st.backup = { lastAt: null, answersSince: 99, remindAfter: 0 };
  assert.strictEqual(St.needsBackupReminder(st, 1000), false);
  st.backup.answersSince = 100;
  assert.strictEqual(St.needsBackupReminder(st, 1000), true);
  st.backup.answersSince = 5;
  assert.strictEqual(St.needsBackupReminder(st, 3 * 86400000), true);
  st.backup.answersSince = 0;
  assert.strictEqual(St.needsBackupReminder(st, 10 * 86400000), false);
});

// ---- tools/build-words-js.mjs ----
const tool = path.join(__dirname, '..', 'tools', 'build-words-js.mjs');
function runTool(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfp-'));
  const inp = path.join(dir, 'words.json');
  const out = path.join(dir, 'words.js');
  fs.writeFileSync(inp, JSON.stringify(data));
  try {
    const stdout = execFileSync(process.execPath, [tool, inp, out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, out: fs.readFileSync(out, 'utf8') };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || ''), wrote: fs.existsSync(out) };
  }
}

test('build tool accepts the real data and reports 3,666 words', () => {
  const r = runTool(bank);
  assert.strictEqual(r.code, 0);
  assert.match(r.stdout, /Total words: 3666/);
  assert.match(r.out, /^\/\/ GENERATED/);
  assert.match(r.out, /window\.WORD_BANK = \{/);
});

test('build tool rejects a duplicate id', () => {
  const d = JSON.parse(JSON.stringify(bank));
  d.words.push(JSON.parse(JSON.stringify(d.words.find((w) => w.id === 'horse'))));
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /duplicate id/);
  assert.match(r.stderr, /"horse"/);
  assert.strictEqual(r.wrote, false);
});

test('build tool rejects a bad character', () => {
  const d = JSON.parse(JSON.stringify(bank));
  const w = d.words.find((x) => x.id === 'tiger');
  w.word = 'tiger1'; w.id = 'tiger1';
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /tiger1.*a-z/);
});

test('build tool rejects a level that does not match difficulty, and a bad schema_version', () => {
  const d = JSON.parse(JSON.stringify(bank));
  const tiger = d.words.find((x) => x.id === 'tiger');
  tiger.level = tiger.level === 'hard' ? 'easy' : 'hard';
  d.schema_version = 3;
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /level/);
  assert.match(r.stderr, /schema_version/);
});

test('build tool rejects a missing final_2025 word and a silent-letter word without a pattern', () => {
  const d = JSON.parse(JSON.stringify(bank));
  d.words = d.words.filter((x) => x.id !== 'horse');
  d.words.find((x) => x.id === 'knife').silent_pattern = null;
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"horse" is missing/);
  assert.match(r.stderr, /knife.*silent_pattern/);
});
