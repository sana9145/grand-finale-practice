#!/usr/bin/env node
// Builds js/data/words.js from data/words.json, after checking the data.
// Usage: node tools/build-words-js.mjs [input.json] [output.js]
// No dependencies. Exits with code 1 and names the bad record if anything is wrong.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const input = resolve(process.argv[2] || resolve(root, 'data/words.json'));
const output = resolve(process.argv[3] || resolve(root, 'js/data/words.js'));

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

let data;
try {
  let text = readFileSync(input, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  data = JSON.parse(text);
} catch (e) {
  console.error(`ERROR: cannot read ${input}: ${e.message}`);
  process.exit(1);
}

const TIERS = ['easy', 'medium', 'hard'];
const THEMES = ['geography', 'animals', 'silent_letter'];
const BANDS = ['easy', 'medium', 'hard', 'extreme'];
const LIST_68 = 'official_2026', LIST_911 = 'official_2026_9_11';

if (data.schema_version !== 2) fail(`schema_version must be 2 (found ${JSON.stringify(data.schema_version)})`);
if (data.study_plan_default && data.study_plan_default.list_9_11 !== undefined) {
  const l = data.study_plan_default.list_9_11;
  if (!Array.isArray(l) || l.some((b) => !BANDS.includes(b))) fail('study_plan_default.list_9_11 must be a list of easy, medium, hard, extreme');
}

// ---- finale_format ----
const ff = data.finale_format;
function need(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || !(p in cur)) { fail(`finale_format is incomplete: missing ${path}`); return undefined; }
    cur = cur[p];
  }
  return cur;
}
if (!ff || typeof ff !== 'object') {
  fail('finale_format is missing');
} else {
  const date = need(ff, 'final_date');
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) fail(`finale_format.final_date must look like 2026-10-28 (found ${date})`);
  for (const p of ['round1.words', 'round1.points_right', 'round1.points_wrong', 'round2.words', 'round2.points_wrong', 'max_total']) {
    const v = need(ff, p);
    if (v !== undefined && typeof v !== 'number') fail(`finale_format.${p} must be a number`);
  }
  const th = need(ff, 'round1.themes');
  if (th !== undefined && (!Array.isArray(th) || th.length === 0 || th.some((t) => !t.id || !t.label))) fail('finale_format.round1.themes must be a list of {id,label,emoji}');
  for (const p of ['round1.pool_sources', 'round2.pool_sources']) {
    const v = need(ff, p);
    if (v !== undefined && (!Array.isArray(v) || v.length === 0)) fail(`finale_format.${p} must be a non-empty list`);
  }
  need(ff, 'after_round1.eliminated');
  const lv = need(ff, 'round2.levels');
  if (lv !== undefined) {
    if (!Array.isArray(lv) || lv.length === 0) fail('finale_format.round2.levels must be a list');
    else for (const l of lv) {
      if (!TIERS.includes(l.id) || typeof l.points_right !== 'number' || !Array.isArray(l.difficulty)) fail(`finale_format.round2.levels entry ${JSON.stringify(l.id)} needs id, points_right and difficulty[]`);
    }
  }
  const rs = need(ff, 'results_2025');
  if (rs !== undefined && !Array.isArray(rs)) fail('finale_format.results_2025 must be a list');
}

function levelFor(difficulty) {
  const levels = (ff && ff.round2 && ff.round2.levels) || [];
  const l = levels.find((x) => Array.isArray(x.difficulty) && x.difficulty.includes(difficulty));
  return l ? l.id : null;
}

// ---- words ----
const words = Array.isArray(data.words) ? data.words : [];
if (!Array.isArray(data.words)) fail('words[] is missing');
const patternIds = new Set((data.silent_patterns || []).map((p) => p.id));
const ids = new Map();
words.forEach((w, i) => {
  const name = `word #${i + 1} ${JSON.stringify(w && w.word)} (id ${JSON.stringify(w && w.id)})`;
  if (!w || typeof w !== 'object') { fail(`${name}: not an object`); return; }
  if (typeof w.word !== 'string' || !/^[a-z' -]+$/.test(w.word)) fail(`${name}: word may only use a-z, space, hyphen or apostrophe`);
  const expectId = String(w.word || '').replace(/[ -]/g, '');
  if (w.id !== expectId) fail(`${name}: id must be the word with spaces and hyphens removed ("${expectId}")`);
  if (ids.has(w.id)) fail(`${name}: duplicate id, already used by word #${ids.get(w.id) + 1}`);
  else ids.set(w.id, i);
  if (!Number.isInteger(w.difficulty) || w.difficulty < 1 || w.difficulty > 5) fail(`${name}: difficulty must be 1-5 (found ${JSON.stringify(w.difficulty)})`);
  else if (w.level !== levelFor(w.difficulty)) fail(`${name}: level "${w.level}" does not match difficulty ${w.difficulty} (should be "${levelFor(w.difficulty)}")`);
  const themes = Array.isArray(w.themes) ? w.themes : [];
  const tt = w.theme_tier && typeof w.theme_tier === 'object' ? w.theme_tier : {};
  if (!Array.isArray(w.themes)) fail(`${name}: themes must be a list`);
  for (const t of themes) if (!THEMES.includes(t)) fail(`${name}: unknown theme "${t}"`);
  const a = [...themes].sort().join(','), b = Object.keys(tt).sort().join(',');
  if (a !== b) fail(`${name}: themes [${a}] and theme_tier keys [${b}] differ`);
  for (const [t, tier] of Object.entries(tt)) if (!TIERS.includes(tier)) fail(`${name}: tier for ${t} must be easy, medium or hard (found ${JSON.stringify(tier)})`);
  if (themes.includes('silent_letter')) {
    if (!w.silent_pattern) fail(`${name}: silent-letter theme word has no silent_pattern`);
    else if (patternIds.size && !patternIds.has(w.silent_pattern)) fail(`${name}: unknown silent_pattern "${w.silent_pattern}"`);
  }
  if (!Array.isArray(w.sources) || w.sources.length === 0) fail(`${name}: sources must be a non-empty list`);
  // ---- schema 2: the 9-11 list, extreme words and the A-Z tab ----
  const sources = Array.isArray(w.sources) ? w.sources : [];
  const on911 = sources.includes(LIST_911);
  if (w.band_9_11 != null && !BANDS.includes(w.band_9_11)) fail(`${name}: band_9_11 must be easy, medium, hard or extreme (found ${JSON.stringify(w.band_9_11)})`);
  if (on911 && w.band_9_11 == null) fail(`${name}: on the 9-11 list (${LIST_911}) but band_9_11 is not set`);
  if (!on911 && w.band_9_11 != null) fail(`${name}: band_9_11 is set but the word is not on the 9-11 list (${LIST_911})`);
  if (w.extreme !== (w.band_9_11 === 'extreme')) fail(`${name}: extreme must be ${w.band_9_11 === 'extreme'} because band_9_11 is ${JSON.stringify(w.band_9_11)} (found ${JSON.stringify(w.extreme)})`);
  if (w.extreme && themes.length) fail(`${name}: extreme words must not be in a round-1 theme`);
  const expectLetter = String(w.word || '').charAt(0).toUpperCase();
  if (w.letter !== expectLetter) fail(`${name}: letter must be "${expectLetter}" (the first letter of the word, upper-cased; found ${JSON.stringify(w.letter)})`);
  const expectAz = sources.includes(LIST_68) || on911;
  if (w.in_az !== expectAz) fail(`${name}: in_az must be ${expectAz} (true exactly when the word is on the 6-8 or 9-11 official list; found ${JSON.stringify(w.in_az)})`);
  if (w.spelling_note != null && typeof w.spelling_note !== 'string') fail(`${name}: spelling_note must be text`);
});

// Every A-Z word sits in exactly one letter.
const letterOf = new Map();
for (const w of words) {
  if (!w || !w.in_az) continue;
  if (typeof w.letter !== 'string' || !/^[A-Z]$/.test(w.letter)) fail(`word ${JSON.stringify(w.word)}: A-Z word needs one letter A-Z (found ${JSON.stringify(w.letter)})`);
  else if (letterOf.has(w.id) && letterOf.get(w.id) !== w.letter) fail(`word ${JSON.stringify(w.word)}: A-Z word is in two letters`);
  else letterOf.set(w.id, w.letter);
}

for (const w of words) {
  for (const p of (w && w.sound_alike_with) || []) {
    if (!ids.has(p)) warnings.push(`${w.word}: sound-alike partner "${p}" is not in the bank`);
  }
}

// every final_2025 word must be in the bank
const finalists = (data.final_2025 && data.final_2025.finalists) || [];
for (const f of finalists) {
  for (const r of [...(f.round1 || []), ...(f.round2 || [])]) {
    const id = String(r.word).toLowerCase().replace(/[ -]/g, '');
    if (!ids.has(id)) fail(`final_2025 ${f.label}: word "${r.word}" is missing from the bank`);
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\n${errors.length} problem(s) found. js/data/words.js was NOT written.`);
  process.exit(1);
}

// ---- write ----
const header = '// GENERATED by tools/build-words-js.mjs from data/words.json. Do not edit by hand.\n';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, header + 'window.WORD_BANK = ' + JSON.stringify(data) + ';\n', 'utf8');

// ---- report ----
const count = (fn) => { const m = {}; for (const w of words) for (const k of fn(w)) m[k] = (m[k] || 0) + 1; return m; };
console.log(`OK: ${words.length} words written to ${output}`);
console.log('\nBy source:');
for (const [k, v] of Object.entries(count((w) => w.sources))) console.log(`  ${k.padEnd(20)} ${v}`);
console.log('\nTheme x tier:');
const tt = count((w) => w.themes.map((t) => `${t}:${w.theme_tier[t]}`));
for (const t of THEMES) console.log(`  ${t.padEnd(14)} ` + TIERS.map((x) => `${x} ${tt[`${t}:${x}`] || 0}`).join('  '));
console.log('\nLevel (all words / round-2 focus):');
const lv = count((w) => [w.level]);
const fo = count((w) => (w.round2_focus ? [w.level] : []));
for (const x of TIERS) console.log(`  ${x.padEnd(8)} ${String(lv[x] || 0).padStart(5)} / focus ${fo[x] || 0}`);

const has = (w, src) => (w.sources || []).includes(src);
const n = (fn) => words.filter(fn).length;
const az = words.filter((w) => w.in_az);
const letters = [...new Set(az.map((w) => w.letter))].sort();
const bands = count((w) => (w.band_9_11 ? [w.band_9_11] : []));
const tierLine = (t) => TIERS.map((x) => `${x} ${tt[`${t}:${x}`] || 0}`).join(' · ');
console.log('\nCounts:');
console.log(`  All words                ${words.length}`);
console.log(`  On the 6-8 list          ${n((w) => has(w, LIST_68))} (${n((w) => has(w, LIST_68) && has(w, LIST_911))} of them also on the 9-11 list)`);
console.log(`  On the 9-11 list         ${n((w) => has(w, LIST_911))}`);
console.log(`  A-Z words (either list)  ${az.length}, across ${letters.length} letters`);
console.log(`  9-11 bands               ${BANDS.map((b) => `${b} ${bands[b] || 0}`).join(' · ')}`);
for (const [t, label] of [['animals', 'Animals theme'], ['silent_letter', 'Silent-letters theme'], ['geography', 'Geography theme']]) {
  console.log(`  ${label.padEnd(24)} ${n((w) => w.themes.includes(t))} (${tierLine(t)})`);
}
console.log(`  Needs review             ${n((w) => w.needs_review)}`);
const perLetter = count((w) => (w.in_az ? [w.letter] : []));
console.log('\nA-Z words per letter:');
console.log('  ' + letters.map((l) => `${l} ${perLetter[l]}`).join('  '));
console.log(`\nTotal words: ${words.length}`);
