const test = require('node:test');
const assert = require('node:assert');
const { GF, bank, merged } = require('./_load.js');
const P = GF.plan;

test('default plan size matches the data (2,016 words, with the 9-11 row)', () => {
  const words = merged().words;
  const def = P.defaultPlan(bank);
  assert.deepStrictEqual(def.geography, bank.study_plan_default.geography);
  assert.strictEqual(def.round2.focus_only, true);
  assert.deepStrictEqual(def.list_9_11, ['easy', 'medium', 'hard']);
  // Recompute independently from the raw records.
  const r1 = bank.finale_format.round1.pool_sources, r2 = bank.finale_format.round2.pool_sources;
  const ids = new Set();
  for (const w of bank.words) {
    for (const t of w.themes) if (bank.study_plan_default[t].includes(w.theme_tier[t]) && w.sources.some((s) => r1.includes(s))) ids.add(w.id);
    if (w.round2_focus && bank.study_plan_default.round2.levels.includes(w.level) && w.sources.some((s) => r2.includes(s))) ids.add(w.id);
    if (w.band_9_11 && bank.study_plan_default.list_9_11.includes(w.band_9_11)) ids.add(w.id);
  }
  assert.strictEqual(P.planIds(words, bank, def).length, ids.size);
  assert.strictEqual(ids.size, 2016);
});

test('pool sizes match the README table', () => {
  const words = merged().words;
  const t = (th, tier) => P.themePool(words, bank, th, tier).length;
  assert.deepStrictEqual([t('geography', 'easy'), t('geography', 'medium'), t('geography', 'hard')], [48, 80, 61]);
  assert.deepStrictEqual([t('animals', 'easy'), t('animals', 'medium'), t('animals', 'hard')], [52, 68, 77]);
  assert.deepStrictEqual([t('silent_letter', 'easy'), t('silent_letter', 'medium'), t('silent_letter', 'hard')], [49, 92, 78]);
  const b = (band) => P.bandPool(words, bank, band).length;
  assert.deepStrictEqual([b('easy'), b('medium'), b('hard'), b('extreme')], [62, 533, 826, 214]);
  const r = (l, f) => P.round2Pool(words, bank, l, f).length;
  assert.deepStrictEqual([r('easy', true), r('medium', true), r('hard', true)], [63, 107, 124]);
  assert.deepStrictEqual([r('easy', false), r('medium', false), r('hard', false)], [285, 599, 672]);
});

test('round-2 pools never include theme-extra words', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  for (const l of ['easy', 'medium', 'hard']) {
    for (const id of P.round2Pool(words, bank, l, false)) {
      const w = byId[id];
      assert.ok(w.sources.some((s) => bank.finale_format.round2.pool_sources.includes(s)), id);
      assert.ok(!(w.sources.length === 1 && w.sources[0] === 'finale_theme_extra'), id);
    }
  }
});

test('unticking a tier removes its words from the plan', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const plan = P.defaultPlan(bank);
  const geoMed = P.themePool(words, bank, 'geography', 'medium');
  plan.geography = ['easy'];
  const ids = new Set(P.planIds(words, bank, plan));
  const stillThere = geoMed.filter((id) => ids.has(id));
  // only words that are in the plan for another reason (another theme or round-2 focus) remain
  for (const id of stillThere) assert.ok(byId[id].round2_focus || byId[id].themes.length > 1, id);
  assert.ok(stillThere.length < geoMed.length);
});

test('round-2 focus on/off', () => {
  const words = merged().words;
  const plan = P.defaultPlan(bank);
  const on = P.planIds(words, bank, plan).length;
  plan.round2.focus_only = false;
  const off = P.planIds(words, bank, plan).length;
  assert.ok(off > on + 1000, `${off} vs ${on}`);
});

test('hidden words leave every pool', () => {
  const O = GF.overlay;
  const id = P.themePool(merged().words, bank, 'animals', 'easy')[0];
  const m = O.merge(bank.words, O.setHidden(O.empty(), id, true), bank.finale_format.round2.levels);
  assert.ok(!P.themePool(m.words, bank, 'animals', 'easy').includes(id));
  assert.ok(!P.planIds(m.words, bank, P.defaultPlan(bank)).includes(id));
});

test('the 9-11 row adds and removes words; extreme words only when ticked', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const plan = P.defaultPlan(bank);
  const withRow = new Set(P.planIds(words, bank, plan));
  for (const id of P.bandPool(words, bank, 'hard')) assert.ok(withRow.has(id), id);
  for (const id of withRow) assert.ok(!byId[id].extreme, 'extreme word in the default plan: ' + id);
  plan.list_9_11 = [];
  const without = new Set(P.planIds(words, bank, plan));
  assert.strictEqual(without.size, 660);
  for (const id of P.bandPool(words, bank, 'medium')) {
    const w = byId[id];
    if (without.has(id)) assert.ok(w.themes.length || w.round2_focus, id); // in the plan for another reason
  }
  plan.list_9_11 = ['extreme'];
  const ext = new Set(P.planIds(words, bank, plan));
  assert.strictEqual(ext.size, 660 + 214);
  for (const id of P.bandPool(words, bank, 'extreme')) assert.ok(ext.has(id));
});

test('extreme words are never in a theme or pattern pool', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  for (const t of ['geography', 'animals', 'silent_letter']) for (const id of P.themePool(words, bank, t, 'all')) assert.ok(!byId[id].extreme, id);
  for (const p of bank.silent_patterns) for (const id of P.patternPool(words, bank, p.id)) assert.ok(!byId[id].extreme, id);
});

test('an old plan without the 9-11 row gets the default row; a saved row is kept', () => {
  const old = { geography: ['easy'], animals: ['easy', 'hard'], silent_letter: [], round2: { levels: ['hard'], focus_only: true } };
  const n = P.normalize(old, bank);
  assert.deepStrictEqual(n.animals, ['easy', 'hard']);
  assert.deepStrictEqual(n.list_9_11, ['easy', 'medium', 'hard']);
  assert.deepStrictEqual(P.normalize(Object.assign({}, old, { list_9_11: ['extreme', 'easy'] }), bank).list_9_11, ['easy', 'extreme']);
});

test('"Make it fit" unticks hard tiers until the plan fits, and only suggests', () => {
  const words = merged().words;
  const plan = P.defaultPlan(bank);
  plan.list_9_11 = ['easy', 'medium', 'hard', 'extreme'];
  const before = JSON.stringify(plan);
  const r = P.fitPlan(words, bank, plan, 1500);
  assert.strictEqual(JSON.stringify(plan), before, 'the plan passed in is not changed');
  assert.deepStrictEqual(r.steps.slice(0, 2), [{ row: 'list_9_11', tier: 'extreme' }, { row: 'list_9_11', tier: 'hard' }]);
  assert.ok(r.fits && r.size <= 1500 && r.size === P.planIds(words, bank, r.plan).length);
  const tiny = P.fitPlan(words, bank, P.defaultPlan(bank), 10);
  assert.strictEqual(tiny.fits, false);
  for (const s of tiny.steps) assert.strictEqual(s.tier, 'hard');
});
