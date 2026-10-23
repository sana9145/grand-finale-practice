const test = require('node:test');
const assert = require('node:assert');
const { GF, bank } = require('./_load.js');
const SR = GF.silentRules;
const suggest = (w) => SR.suggest(w, bank.silent_letter_rules, bank.silent_letter_exceptions);

test('silent rules', () => {
  assert.deepStrictEqual(suggest('knife'), ['k']);
  assert.deepStrictEqual(suggest('castle'), ['t']);
  assert.deepStrictEqual(suggest('island'), ['s']);
  assert.deepStrictEqual(suggest('honest'), ['h']);
  assert.deepStrictEqual(suggest('honey'), []);
  assert.deepStrictEqual(suggest('dislike'), []);
  assert.deepStrictEqual(suggest('Islamabad'), []);
  assert.strictEqual(SR.suggestPattern(['k'], bank.silent_patterns), 'k');
  assert.strictEqual(SR.suggestPattern(['s'], bank.silent_patterns), 'dsnp');
});

test('silent letters are located for highlighting', () => {
  const loc = (w, l) => SR.locate(w, l, bank.silent_letter_rules);
  assert.deepStrictEqual(loc('knife', ['k'])[0].indexes, [0]);
  assert.strictEqual(loc('knife', ['k'])[0].chunk, 'kn');
  assert.deepStrictEqual(loc('castle', ['t'])[0].indexes, [3]);
  assert.deepStrictEqual(loc('night', ['gh'])[0].indexes, [2, 3]);
  assert.deepStrictEqual(loc('biscuit', ['u'])[0].indexes, [4]);
  assert.match(SR.describe(loc('knife', ['k']))[0], /The k is silent \(kn\)/);
  assert.match(SR.describe(loc('night', ['gh']))[0], /The g and h are silent/);
});

test('portable difficulty', () => {
  const D = GF.difficulty;
  assert.strictEqual(D.estimate('cat'), 1);
  assert.strictEqual(D.score('cat'), 0);
  // double letter (+2) + tricky ending le (+1.5)
  assert.strictEqual(D.score('bubble'), 3.5);
  // silent k (+2) + length 8 (+0.7) ... knuckles: kn (+2), le? no (ends in s), length 8
  assert.ok(Math.abs(D.score('knuckles', bank.silent_letter_rules, bank.silent_letter_exceptions) - 2.7) < 1e-9);
  assert.strictEqual(D.estimate('knuckles', bank.silent_letter_rules, bank.silent_letter_exceptions), 2);
  assert.strictEqual(D.fromScore(3.5), 3);
  assert.strictEqual(D.fromScore(1.99), 1);
  assert.strictEqual(D.fromScore(6.5), 5);
  assert.strictEqual(D.levelFor(1, bank.finale_format.round2.levels), 'easy');
  assert.strictEqual(D.levelFor(2, bank.finale_format.round2.levels), 'medium');
  assert.strictEqual(D.levelFor(4, bank.finale_format.round2.levels), 'hard');
});

test('CSV parser: quotes, commas and newlines in fields, BOM, CRLF, trailing empty line, extra columns', () => {
  const C = GF.csv;
  const text = '﻿word,meaning,extra\r\n"apple","A fruit, red or green.",x\r\n"quote","He said ""hi""\nthen left",\r\nplain,simple,y,z\r\n\r\n';
  const rows = C.parse(text);
  assert.deepStrictEqual(rows, [
    ['word', 'meaning', 'extra'],
    ['apple', 'A fruit, red or green.', 'x'],
    ['quote', 'He said "hi"\nthen left', ''],
    ['plain', 'simple', 'y', 'z'],
  ]);
  const t = C.toObjects(text);
  assert.deepStrictEqual(t.headers, ['word', 'meaning', 'extra']);
  assert.strictEqual(t.rows[1].meaning, 'He said "hi"\nthen left');
  assert.strictEqual(t.rows[0]._row, 2);
  // round trip
  assert.deepStrictEqual(C.parse(C.stringify(rows)), rows);
  // no trailing newline, LF only
  assert.deepStrictEqual(C.parse('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
});

test('theme_tier syntax in CSV import', () => {
  const r = GF.importMerge.normalize({ word: 'Fiji', theme_tier: 'geography:hard;animals:easy', _row: 2, _kind: 'csv' }, { bank });
  assert.deepStrictEqual(r.rec.theme_tier, { geography: 'hard', animals: 'easy' });
  assert.deepStrictEqual(r.rec.themes.sort(), ['animals', 'geography']);
  assert.strictEqual(r.rec.display, 'Fiji');
  assert.strictEqual(r.rec.word, 'fiji');
  const bad = GF.importMerge.normalize({ word: 'fiji', theme_tier: 'geography:tricky', _row: 3 }, { bank });
  assert.ok(bad.problem);
});

test('letter names and part of speech', () => {
  const L = GF.letterNames;
  assert.deepStrictEqual(L.spellOut('x-ray', 'zed'), ['ex', 'hyphen', 'ar', 'ay', 'why']);
  assert.deepStrictEqual(L.spellOut('Sri Lanka', 'zed').slice(0, 4), ['ess', 'ar', 'eye', 'space']);
  assert.deepStrictEqual(L.spellOut('zoo', 'zee'), ['zee', 'oh', 'oh']);
  assert.deepStrictEqual(L.spellOut('zoo', 'zed')[0], 'zed');
  assert.strictEqual(L.posPhrase('noun'), 'It is a noun.');
  assert.strictEqual(L.posPhrase('noun/verb'), 'It can be a noun or a verb.');
  assert.strictEqual(L.posPhrase('adjective'), 'It is an adjective.');
});
