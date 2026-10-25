const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { bank } = require('./_load.js');

const tool = path.join(__dirname, '..', 'tools', 'build-words-js.mjs');
function runTool(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfp2-'));
  const inp = path.join(dir, 'words.json');
  const out = path.join(dir, 'words.js');
  fs.writeFileSync(inp, JSON.stringify(data));
  try {
    const stdout = execFileSync(process.execPath, [tool, inp, out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || ''), wrote: fs.existsSync(out) };
  }
}
const copy = () => JSON.parse(JSON.stringify(bank));
const find = (d, fn) => d.words.find(fn);

test('the real schema-2 file is accepted and the counts are reported', () => {
  const r = runTool(bank);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /All words\s+3666/);
  assert.match(r.stdout, /On the 6-8 list\s+1457 \(102 of them also on the 9-11 list\)/);
  assert.match(r.stdout, /On the 9-11 list\s+1635/);
  assert.match(r.stdout, /A-Z words \(either list\)\s+2990, across 26 letters/);
  assert.match(r.stdout, /9-11 bands\s+easy 62 · medium 533 · hard 826 · extreme 214/);
  assert.match(r.stdout, /Animals theme\s+256 \(easy 70 · medium 68 · hard 118\)/);
  assert.match(r.stdout, /Silent-letters theme\s+341 \(easy 62 · medium 129 · hard 150\)/);
  assert.match(r.stdout, /Geography theme\s+296 /);
});

test('rejects a wrong letter, naming the record', () => {
  const d = copy();
  find(d, (w) => w.id === 'horse').letter = 'G';
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"horse".*letter must be "H"/);
  assert.strictEqual(r.wrote, false);
});

test('rejects a 9-11 word without band_9_11', () => {
  const d = copy();
  const w = find(d, (x) => x.sources.includes('official_2026_9_11') && x.band_9_11 === 'hard');
  w.band_9_11 = null;
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, new RegExp(`"${w.word}".*band_9_11 is not set`));
});

test('rejects a mismatched extreme flag (both ways)', () => {
  const d = copy();
  const a = find(d, (x) => x.band_9_11 === 'extreme');
  a.extreme = false;
  const b = find(d, (x) => x.band_9_11 === 'easy');
  b.extreme = true;
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, new RegExp(`"${a.word}".*extreme must be true`));
  assert.match(r.stderr, new RegExp(`"${b.word}".*extreme must be false`));
});

test('rejects a wrong in_az and a band on a word that is not on the 9-11 list', () => {
  const d = copy();
  const a = find(d, (x) => x.sources.length === 1 && x.sources[0] === 'official_2026');
  a.in_az = false;
  const b = find(d, (x) => !x.sources.includes('official_2026_9_11'));
  b.band_9_11 = 'easy';
  const r = runTool(d);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, new RegExp(`"${a.word}".*in_az must be true`));
  assert.match(r.stderr, new RegExp(`"${b.word}".*not on the 9-11 list`));
});

test('the data matches the update notes', () => {
  const needs = bank.words.filter((w) => w.needs_review).map((w) => w.id).sort();
  assert.strictEqual(needs.length, 9);
  for (const id of ['pagination', 'painstaking', 'palaeontology', 'palatial', 'paediatrician', 'pancreas']) assert.ok(needs.includes(id), id);
  for (const w of bank.words) {
    if (w.extreme) assert.strictEqual(w.themes.length, 0, w.id);
    if (w.sources.includes('official_2026_9_11') && !w.sources.includes('official_2026') && !w.sources.includes('asked_2025') && !w.sources.includes('finale_theme_extra')) {
      assert.strictEqual(w.level, w.band_9_11 === 'extreme' ? 'hard' : w.band_9_11, w.id);
    }
  }
  assert.ok(bank.finale_format.round1.pool_sources.includes('official_2026_9_11'));
  assert.ok(bank.finale_format.round2.pool_sources.includes('official_2026_9_11'));
  assert.strictEqual(bank.finale_format.round2.exclude_extreme_unless_planned, true);
});
