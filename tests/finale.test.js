const test = require('node:test');
const assert = require('node:assert');
const { GF, bank } = require('./_load.js');
const F = GF.finale, fmt = bank.finale_format;

test('round 1 is +10 / 0 and round 2 is +5/+10/+20 / -5 (from finale_format)', () => {
  assert.strictEqual(F.points(fmt, 1, 'animals', true), 10);
  assert.strictEqual(F.points(fmt, 1, 'animals', false), 0);
  assert.strictEqual(F.points(fmt, 2, 'easy', true), 5);
  assert.strictEqual(F.points(fmt, 2, 'medium', true), 10);
  assert.strictEqual(F.points(fmt, 2, 'hard', true), 20);
  for (const l of ['easy', 'medium', 'hard']) assert.strictEqual(F.points(fmt, 2, l, false), -5);
});

test('totals can be negative', () => {
  const r1 = Array(5).fill({ choice: 'geography', right: false });
  const r2 = Array(5).fill({ choice: 'hard', right: false });
  assert.deepStrictEqual(F.score(fmt, r1, r2), { r1: 0, r2: -25, total: -25 });
});

test('maximum is max_total', () => {
  const r1 = Array(5).fill({ choice: 'animals', right: true });
  const r2 = Array(5).fill({ choice: 'hard', right: true });
  assert.strictEqual(F.score(fmt, r1, r2).total, fmt.max_total);
});

test('undo reverses points', () => {
  const r2 = [{ choice: 'hard', right: true }, { choice: 'medium', right: false }];
  assert.strictEqual(F.roundScore(fmt, 2, r2), 15);
  // undo = the last entry goes back to unanswered
  const undone = [r2[0], { choice: 'medium', right: null }];
  assert.strictEqual(F.roundScore(fmt, 2, undone), 20);
});

test('replaying the 8 finalists of 2025 reproduces their stored totals', () => {
  const totals = bank.final_2025.finalists.map((f) => F.replay(fmt, f).total);
  assert.deepStrictEqual(totals, [95, 130, 140, 150, 10, 20, 10, 115]);
  for (const f of bank.final_2025.finalists) {
    const r = F.replay(fmt, f);
    assert.strictEqual(r.total, f.total, f.label);
    assert.strictEqual(r.r1, f.round1_score, f.label + ' round 1');
    if (f.round2) assert.strictEqual(r.r2, f.round2_score, f.label + ' round 2');
  }
});

test('2025 places reached', () => {
  assert.deepStrictEqual(F.placesBeaten(fmt, 135).map((p) => p.total), [130]);
  assert.strictEqual(F.placesBeaten(fmt, 150).length, 3);
  assert.strictEqual(F.placesBeaten(fmt, 100).length, 0);
});
