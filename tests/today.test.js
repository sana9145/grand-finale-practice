const test = require('node:test');
const assert = require('node:assert');
const { GF, bank, merged } = require('./_load.js');
const S = GF.scheduler, P = GF.plan;

const TODAY = '2026-10-21';
function setup() {
  const words = merged().words;
  const plan = P.defaultPlan(bank);
  const progress = {};
  const ids = P.planIds(words, bank, plan);
  // a try-again word, a due word (box 2, seen 2 days ago), a word seen today (not due)
  progress[ids[0]] = S.answer(null, false, Date.parse('2026-10-20T10:00:00'), '2026-10-20');
  let p = S.answer(null, true, Date.parse('2026-10-18T10:00:00'), '2026-10-18');
  p = S.answer(p, true, Date.parse('2026-10-19T10:00:00'), '2026-10-19');
  progress[ids[1]] = p;
  progress[ids[2]] = S.answer(null, true, Date.parse('2026-10-21T08:00:00'), '2026-10-21');
  return { words, plan, progress, ids };
}

test('order: try-again, then due, then new', () => {
  const { words, plan, progress, ids } = setup();
  const r = GF.today.buildQueue({ words, bank, plan, progress, today: TODAY, seed: 7 });
  assert.strictEqual(r.queue[0], ids[0]);
  assert.strictEqual(r.queue[1], ids[1]);
  assert.deepStrictEqual([r.counts.tryAgain, r.counts.due], [1, 1]);
  for (const id of r.queue.slice(2, 2 + r.counts.fresh)) assert.ok(S.isNew(progress[id]), id);
  assert.strictEqual(r.queue[r.queue.length - 1], ids[2]);
  assert.strictEqual(new Set(r.queue).size, r.queue.length);
  assert.strictEqual(r.queue.length, ids.length);
});

test('new words rotate round-robin: geography, animals, silent letters, round 2, 9-11 list (easy first)', () => {
  const { words, plan } = setup();
  const r = GF.today.buildQueue({ words, bank, plan, progress: {}, today: TODAY, seed: 3 });
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const kinds = ['geography', 'animals', 'silent_letter', 'round2', 'list_9_11'];
  r.queue.slice(0, 15).map((id) => byId[id]).forEach((w, i) => {
    const k = kinds[i % 5];
    if (k === 'round2') { assert.ok(w.round2_focus, w.id); assert.strictEqual(w.level, 'easy', w.id); }
    else if (k === 'list_9_11') assert.strictEqual(w.band_9_11, 'easy', w.id);
    else { assert.ok(w.themes.includes(k), `${w.id} should be ${k}`); assert.strictEqual(w.theme_tier[k], 'easy', w.id); }
  });
});

test("unticked tiers never appear in Today's practice", () => {
  const { words } = setup();
  const plan = P.defaultPlan(bank);
  plan.animals = ['easy'];
  plan.round2 = { levels: ['easy'], focus_only: true };
  plan.list_9_11 = ['easy'];
  const r = GF.today.buildQueue({ words, bank, plan, progress: {}, today: TODAY, seed: 1 });
  const allowed = new Set(P.planIds(words, bank, plan));
  for (const id of r.queue) assert.ok(allowed.has(id));
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const animalsMed = new Set(P.themePool(words, bank, 'animals', 'medium'));
  for (const id of r.queue) {
    if (animalsMed.has(id)) assert.ok(byId[id].themes.length > 1 || (byId[id].round2_focus && byId[id].level === 'easy') || byId[id].band_9_11 === 'easy', id);
  }
});

test("the 9-11 row feeds Today's practice; extreme words only when switched on", () => {
  const { words } = setup();
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const plan = P.defaultPlan(bank);
  const q = (p) => GF.today.buildQueue({ words, bank, plan: p, progress: {}, today: TODAY, seed: 2 }).queue;
  const on = q(plan);
  assert.ok(on.some((id) => byId[id].band_9_11 === 'hard'));
  assert.ok(!on.some((id) => byId[id].extreme));
  plan.list_9_11 = [];
  const off = q(plan);
  assert.ok(off.length < on.length);
  assert.ok(!off.some((id) => P.only911(byId[id]) && !byId[id].themes.length));
  plan.list_9_11 = ['extreme'];
  assert.ok(q(plan).some((id) => byId[id].extreme));
});

test('goal count', () => {
  assert.strictEqual(GF.today.isDone(39, 40), false);
  assert.strictEqual(GF.today.isDone(40, 40), true);
  assert.strictEqual(GF.today.isDone(41, 40), true);
});
