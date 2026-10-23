const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { GF, bank, merged } = require('./_load.js');
const I = GF.importMerge, O = GF.overlay;
const levels = bank.finale_format.round2.levels;

const ctx = (extra) => Object.assign({ bank, defaultTheme: null, defaultTier: 'easy' }, extra || {});

test('preview groups: new, same, different, problems', () => {
  const m = merged();
  const horse = m.byId.horse;
  const csv = [
    'word,meaning,difficulty,unknown_column',
    `zibberish,A made-up word.,2,ignored`,
    `horse,"${horse.meaning.replace(/"/g, '""')}",${horse.difficulty},x`,
    'tiger,A big striped cat.,,',
    'bad word!,,,',
    'zibberish,again,,',
    'toolongtoolongtoolongtoolongtoolongtoolong1,,,',
  ].join('\n');
  const pv = I.preview(csv, 'csv', ctx(), m.byId);
  assert.deepStrictEqual(pv.fresh.map((r) => r.id), ['zibberish']);
  assert.deepStrictEqual(pv.same.map((r) => r.rec.id), ['horse']);
  assert.deepStrictEqual(pv.different.map((r) => r.rec.id), ['tiger']);
  assert.deepStrictEqual(pv.different[0].fields, ['meaning']);
  assert.strictEqual(pv.problems.length, 3);
  assert.deepStrictEqual(pv.problems.map((p) => p.row), [5, 6, 7]);
  assert.match(pv.problems[1].reason, /Same word as row 2/);
});

test('apply: new words are added with source "added"; different follows the choice', () => {
  const m = merged();
  const pv = I.preview('word,meaning\nzibberish,A made-up word.\ntiger,A big striped cat.\nlion,A big cat with a mane.', 'csv', ctx(), m.byId);
  assert.strictEqual(pv.different.length, 2);
  pv.different[0].choice = 'imported';
  let r = I.apply(O.empty(), pv, levels);
  assert.deepStrictEqual(r.summary, { added: 1, updated: 1, kept: 1, skipped: 0, problems: 0 });
  const after = merged(r.overlay);
  assert.deepStrictEqual(after.byId.zibberish.sources, ['added']);
  assert.strictEqual(after.byId.tiger.meaning, 'A big striped cat.');
  assert.strictEqual(after.byId.tiger.origin, 'edited');
  assert.notStrictEqual(after.byId.lion.meaning, 'A big cat with a mane.');
  // apply to all
  I.setAll(pv, 'imported');
  r = I.apply(O.empty(), pv, levels);
  assert.strictEqual(r.summary.updated, 2);
  assert.strictEqual(I.countToImport(pv), 3);
});

test('default theme and tier fill in anything missing', () => {
  const m = merged();
  const pv = I.preview('quokka\nwombat, numbat', 'text', ctx({ defaultTheme: 'animals', defaultTier: 'hard' }), m.byId);
  for (const rec of pv.fresh) {
    assert.deepStrictEqual(rec.themes, ['animals']);
    assert.deepStrictEqual(rec.theme_tier, { animals: 'hard' });
    assert.strictEqual(rec.needs_review, true); // no meaning
  }
  assert.ok(pv.fresh.length >= 2);
  // silent-letter default theme gets a pattern from the rules
  const pv2 = I.preview('knapweed', 'text', ctx({ defaultTheme: 'silent_letter', defaultTier: 'medium' }), m.byId);
  assert.strictEqual(pv2.fresh[0].silent_pattern, 'k');
  assert.deepStrictEqual(pv2.fresh[0].silent_letters, ['k']);
  // a silent-letter word with no rule match and no pattern is a problem
  const pv3 = I.preview('banana', 'text', ctx({ defaultTheme: 'silent_letter', defaultTier: 'medium' }), m.byId);
  assert.strictEqual(pv3.problems.length, 1);
});

test('the template CSV imports', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'add-words-template.csv'), 'utf8');
  const pv = I.preview(text, I.detect(text, 'add-words-template.csv'), ctx(), merged().byId);
  assert.strictEqual(pv.problems.length, 0, JSON.stringify(pv.problems));
  assert.strictEqual(pv.fresh.length + pv.same.length + pv.different.length, 3);
});

test('words.csv exported from the bank imports as "same" for every word', () => {
  const m = merged();
  const csv = GF.exporter.bankCSV(m.words);
  const pv = I.preview(csv, 'csv', ctx(), m.byId);
  assert.strictEqual(pv.problems.length, 0, JSON.stringify(pv.problems.slice(0, 3)));
  assert.strictEqual(pv.different.length, 0, JSON.stringify(pv.different.slice(0, 2).map((d) => [d.rec.id, d.fields])));
  assert.strictEqual(pv.same.length, bank.words.length);
});

test('JSON import: words.json format and a plain array', () => {
  const m = merged();
  const pv = I.preview(JSON.stringify({ words: [{ word: 'zorbing', meaning: 'Rolling downhill in a ball.' }] }), 'json', ctx(), m.byId);
  assert.strictEqual(pv.fresh.length, 1);
  const pv2 = I.preview(JSON.stringify([{ word: 'horse' }]), 'json', ctx(), m.byId);
  assert.strictEqual(pv2.same.length, 1);
  const pv3 = I.preview('{not json', 'json', ctx(), m.byId);
  assert.strictEqual(pv3.problems.length, 1);
});

test('overlay: hidden base word, edits, delete added, orphaned edit', () => {
  let o = O.empty();
  o = O.setHidden(o, 'horse', true);
  o = O.saveWord(o, Object.assign({}, merged().byId.tiger, { meaning: 'Stripy.' }), true);
  o = O.saveWord(o, O.complete({ word: 'zibber', meaning: 'x', difficulty: 4 }, levels), false);
  // an edit whose base word no longer exists
  o.edited.vanished = O.complete({ word: 'vanished', meaning: 'Gone from the base list.', sources: ['official_2026'] }, levels);
  const m = merged(o);
  assert.strictEqual(m.byId.horse.hidden, true);
  assert.strictEqual(m.byId.tiger.meaning, 'Stripy.');
  assert.strictEqual(m.byId.zibber.origin, 'added');
  assert.strictEqual(m.byId.zibber.level, 'hard');
  assert.strictEqual(m.byId.vanished.origin, 'added');
  assert.ok(m.byId.vanished.sources.includes('added'));
  assert.deepStrictEqual(m.orphans, ['vanished']);
  const adopted = O.adoptOrphans(bank.words, o);
  assert.ok(!adopted.edited.vanished);
  assert.ok(adopted.added.some((a) => a.id === 'vanished'));
  // base words are never changed
  assert.notStrictEqual(bank.words.find((w) => w.id === 'tiger').meaning, 'Stripy.');
  // revert + delete
  assert.notStrictEqual(merged(O.revert(o, 'tiger')).byId.tiger.meaning, 'Stripy.');
  assert.ok(!merged(O.deleteAdded(o, 'zibber')).byId.zibber);
  assert.strictEqual(m.words.length, bank.words.length + 2);
});
