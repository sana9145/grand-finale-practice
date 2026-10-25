#!/usr/bin/env node
// Adds the words in a CSV file (same columns as data/add-words-template.csv) to data/words.json,
// so they are part of the built-in word list on every device. Words already in the list are skipped.
// Usage: node tools/merge-words.mjs theme-extra-words.csv [--source finale_theme_extra]
// Then run: node tools/build-words-js.mjs && node tools/build-sw.mjs && node --test

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
for (const f of ['util', 'csv', 'mask', 'letter-names', 'silent-rules', 'difficulty', 'overlay', 'import-merge']) require(resolve(root, 'js/core', f + '.js'));
const GF = globalThis.GF;

const input = process.argv[2];
if (!input) { console.error('Usage: node tools/merge-words.mjs words.csv [--source finale_theme_extra]'); process.exit(1); }
const si = process.argv.indexOf('--source');
const source = si > 0 ? process.argv[si + 1] : 'finale_theme_extra';

const bankPath = resolve(root, 'data/words.json');
const bank = JSON.parse(readFileSync(bankPath, 'utf8').replace(/^﻿/, ''));
const levels = bank.finale_format.round2.levels;
const byId = Object.fromEntries(bank.words.map((w) => [w.id, w]));
const text = readFileSync(resolve(input), 'utf8');
const pv = GF.importMerge.preview(text, 'csv', { bank, defaultTheme: null, defaultTier: 'easy' }, byId);

if (pv.problems.length) {
  for (const p of pv.problems) console.error(`ERROR row ${p.row} (${p.word}): ${p.reason}`);
  console.error('Nothing was added.');
  process.exit(1);
}

const added = pv.fresh.map((rec) => {
  const r = GF.overlay.complete(Object.assign(GF.overlay.strip(rec), {
    sources: rec._lists.length ? rec._lists : [source], text_source: 'added_by_parent', page: null, final_2025: null, sound_alike_with: []
  }), levels);
  // the same field order as the rest of data/words.json
  const out = {};
  for (const k of Object.keys(bank.words[0])) out[k] = r[k] === undefined ? null : r[k];
  return out;
});
bank.words = bank.words.concat(added).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(bankPath, JSON.stringify(bank, null, 1) + '\n', 'utf8');

console.log(`Added ${added.length} word(s) as "${source}": ${added.map((w) => w.display).join(', ')}`);
if (pv.same.length || pv.different.length) console.log(`Skipped ${pv.same.length + pv.different.length} already in the list: ${pv.same.concat(pv.different).map((d) => d.rec.display).join(', ')}`);
console.log(`Total words now: ${bank.words.length}`);
