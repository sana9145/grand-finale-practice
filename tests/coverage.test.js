// Every word in the word list reaches the app, and every word can come up in practice somewhere.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GF, bank, merged } = require('./_load.js');
const P = GF.plan, A = GF.az;
const root = path.join(__dirname, '..');

test('the app loads exactly the words in data/words.json', () => {
  const text = fs.readFileSync(path.join(root, 'js', 'data', 'words.js'), 'utf8');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const built = JSON.parse(json);
  assert.strictEqual(built.words.length, 3326);
  assert.deepStrictEqual(built, bank, 'js/data/words.js is out of date: run node tools/build-words-js.mjs');
});

test('the update pack and words.csv have the same words', () => {
  const pack = path.join(root, 'app-update', 'words.json');
  if (fs.existsSync(pack)) assert.deepStrictEqual(JSON.parse(fs.readFileSync(pack, 'utf8')).words.map((w) => w.id), bank.words.map((w) => w.id));
  const csv = GF.csv.toObjects(fs.readFileSync(path.join(root, 'words.csv'), 'utf8'));
  const ids = new Set(csv.rows.map((r) => GF.util.idOf(r.word)));
  assert.strictEqual(csv.rows.length, bank.words.length);
  for (const w of bank.words) assert.ok(ids.has(w.id), w.id + ' missing from words.csv');
});

test('every word can come up in practice (a theme, round 2, a 9-11 band, or the A-Z tab)', () => {
  const words = merged().words;
  const reach = new Set();
  const add = (ids) => ids.forEach((id) => reach.add(id));
  for (const t of P.themeIds(bank)) add(P.themePool(words, bank, t, 'all'));
  for (const l of P.levelIds(bank)) add(P.round2Pool(words, bank, l, false));
  for (const b of P.BANDS) add(P.bandPool(words, bank, b));
  for (const L of A.LETTERS) add(A.letterIds(words, L, { list: 'both', extreme: true }));
  const missing = words.filter((w) => !reach.has(w.id)).map((w) => w.id);
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(reach.size, 3326);
});

test('every word on an official list is in the A-Z tab, in its own letter', () => {
  const words = merged().words;
  const az = new Map();
  for (const L of A.LETTERS) for (const id of A.letterIds(words, L, { list: 'both', extreme: true })) az.set(id, L);
  for (const w of bank.words) {
    const official = w.sources.includes('official_2026') || w.sources.includes('official_2026_9_11');
    assert.strictEqual(az.has(w.id), official, w.id);
    if (official) assert.strictEqual(az.get(w.id), w.word.charAt(0).toUpperCase(), w.id);
  }
  assert.strictEqual(az.size, 2990);
});

test('every word has something to say and show', () => {
  const noMeaning = [], noSentence = [], noPos = [];
  for (const w of bank.words) {
    if (!w.meaning) noMeaning.push(w.id);
    if (!w.sentence) noSentence.push(w.id);
    if (!w.pos) noPos.push(w.id);
    assert.ok(w.display && w.display.toLowerCase() === w.word, w.id + ': display must match the word');
  }
  assert.deepStrictEqual(noMeaning, [], 'every word has a meaning');
  assert.deepStrictEqual(noPos, [], 'every word has a part of speech');
  // Known gap in the word list: 48 words (mostly 9-11 animal words) have no example sentence.
  // The card then says "Sorry, there is no sentence for this word yet." Add sentences in the word editor.
  assert.ok(noSentence.length <= 48, noSentence.length + ' words have no sentence: ' + noSentence.slice(0, 10).join(', '));
});

test('the offline copy (sw.js) lists every app file and is up to date', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'tools', 'build-sw.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(sw.includes(JSON.stringify(m[1])), m[1]);
});
