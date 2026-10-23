const test = require('node:test');
const assert = require('node:assert');
const { GF, bank, merged } = require('./_load.js');
const F = GF.finale, P = GF.plan, U = GF.util;

function ctx(extra) {
  return Object.assign({ words: merged().words, bank, plan: P.defaultPlan(bank), mockUses: 'plan', progress: {}, today: '2026-10-21', rand: U.rng(42), used: [], recent: [] }, extra || {});
}

test('no repeats within a mock', () => {
  const c = ctx();
  for (let i = 0; i < 40; i++) {
    const d = F.drawRound1('animals', c);
    assert.ok(!c.used.includes(d.id), d.id);
    c.used.push(d.id);
  }
  for (let i = 0; i < 40; i++) {
    const d = F.drawRound2('hard', c);
    assert.ok(!c.used.includes(d.id), d.id);
    c.used.push(d.id);
  }
});

test('avoids words from the last 2 mocks unless the pool is too small', () => {
  const pool = P.themePool(merged().words, bank, 'geography', 'easy');
  const history = [
    { round1: pool.slice(0, 5).map((id) => ({ id })), round2: [] },
    { round1: pool.slice(5, 10).map((id) => ({ id })), round2: [] },
    { round1: pool.slice(10, 15).map((id) => ({ id })), round2: [] },
  ];
  const recent = F.recentIds(history, 2);
  assert.deepStrictEqual(recent, pool.slice(5, 15));
  const c = ctx({ recent, rand: U.rng(5) });
  for (let i = 0; i < 20; i++) {
    const id = F.drawFrom(pool, c);
    assert.ok(!recent.includes(id), id);
    c.used.push(id);
  }
  const small = pool.slice(5, 8);
  assert.ok(small.includes(F.drawFrom(small, ctx({ recent, rand: U.rng(1) }))));
});

test('tier weighting is 40/40/20 (seeded)', () => {
  const rand = U.rng(2026);
  const n = { easy: 0, medium: 0, hard: 0 };
  for (let i = 0; i < 10000; i++) n[F.pickTier(rand, ['easy', 'medium', 'hard'])]++;
  assert.ok(Math.abs(n.easy / 10000 - 0.4) < 0.02, JSON.stringify(n));
  assert.ok(Math.abs(n.medium / 10000 - 0.4) < 0.02, JSON.stringify(n));
  assert.ok(Math.abs(n.hard / 10000 - 0.2) < 0.02, JSON.stringify(n));
  const a = U.rng(9), b = U.rng(9);
  for (let i = 0; i < 50; i++) assert.strictEqual(F.pickTier(a, ['easy', 'medium', 'hard']), F.pickTier(b, ['easy', 'medium', 'hard']));
  for (let i = 0; i < 100; i++) assert.notStrictEqual(F.pickTier(rand, ['easy', 'medium']), 'hard');
});

test('round 1 draws only from the plan tiers; "Everything" uses all tiers', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const plan = P.defaultPlan(bank);
  plan.animals = ['easy'];
  const c = ctx({ plan });
  for (let i = 0; i < 30; i++) {
    const d = F.drawRound1('animals', c);
    assert.strictEqual(byId[d.id].theme_tier.animals, 'easy');
    c.used.push(d.id);
  }
  const all = ctx({ plan, mockUses: 'all', rand: U.rng(3) });
  const seen = new Set();
  for (let i = 0; i < 60; i++) { const d = F.drawRound1('animals', all); seen.add(byId[d.id].theme_tier.animals); all.used.push(d.id); }
  assert.ok(seen.has('hard') && seen.has('medium'));
});

test('round 2 respects pool_sources (no theme-extra words) and focus', () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const c = ctx({ mockR2: 'focus' });
  for (let i = 0; i < 100; i++) {
    const d = F.drawRound2('medium', c);
    const w = byId[d.id];
    assert.ok(w.sources.some((s) => bank.finale_format.round2.pool_sources.includes(s)), w.id);
    assert.ok(w.round2_focus, w.id);
    assert.strictEqual(w.level, 'medium');
    c.used.push(d.id);
  }
});

test('unmastered words come first', () => {
  const m = { box: 5, seen: 6, right: 6, wrong: 0, days: ['2026-10-18', '2026-10-19'], lastSeen: 1, lastResult: 'right', lastDay: '2026-10-19' };
  const progress = { a: m, b: m, c: { box: 2, seen: 2, right: 2, wrong: 0, days: ['2026-10-20'], lastSeen: 2, lastResult: 'right', lastDay: '2026-10-20' } };
  assert.strictEqual(F.drawFrom(['a', 'b', 'c'], ctx({ progress })), 'c');
});

test('pool exhaustion reuses the least recently seen word', () => {
  const progress = { a: { box: 1, lastSeen: 300 }, b: { box: 1, lastSeen: 100 }, c: { box: 1, lastSeen: 200 } };
  assert.strictEqual(F.drawFrom(['a', 'b', 'c'], ctx({ progress, used: ['a', 'b', 'c'] })), 'b');
});

test("mock round 2: focus + the plan's 9-11 words (default); extreme only when the plan has them", () => {
  const words = merged().words;
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const plan = P.defaultPlan(bank);
  const pool = (mockR2, p) => F.round2MockPool('hard', ctx({ mockR2, plan: p || plan }));
  const focus = pool('focus');
  assert.ok(focus.every((id) => byId[id].round2_focus));
  const def = pool(undefined);
  assert.ok(def.length > focus.length + 500);
  assert.ok(def.some((id) => byId[id].band_9_11 === 'hard'));
  assert.ok(!def.some((id) => byId[id].extreme), 'no extreme words by default');
  assert.ok(!pool('all').some((id) => byId[id].extreme), 'Everything still leaves extreme words out');
  const p2 = Object.assign({}, plan, { list_9_11: ['easy'] });
  assert.ok(!pool('focus911', p2).some((id) => byId[id].band_9_11 === 'hard' && P.only911(byId[id])), 'an unticked band leaves the pool');
  const p3 = Object.assign({}, plan, { list_9_11: ['hard', 'extreme'] });
  assert.ok(pool('focus911', p3).some((id) => byId[id].extreme));
  assert.ok(pool('all', p3).some((id) => byId[id].extreme));
  for (let i = 0; i < 20; i++) assert.ok(def.includes(F.drawRound2('hard', ctx({ rand: U.rng(i) })).id));
});
