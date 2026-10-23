const test = require('node:test');
const assert = require('node:assert');
const { GF, bank, merged } = require('./_load.js');
const St = GF.strategy, fmt = bank.finale_format;

const byId = merged().byId;
const pick = (fn, n) => bank.words.filter(fn).slice(0, n).map((w) => w.id);

test('expected points per level (worked example)', () => {
  assert.strictEqual(St.expected(0.7, 20, -5), 12.5);
  assert.strictEqual(St.expected(1, 10, -5), 10);
  assert.strictEqual(St.expected(0.5, 5, -5), 0);
});

test('level tip recommends the highest expected points', () => {
  const hard = pick((w) => w.level === 'hard' && !w.themes.length, 30);
  const med = pick((w) => w.level === 'medium' && !w.themes.length, 30);
  const log = [];
  hard.forEach((id, i) => log.push({ id, right: i % 10 < 7 })); // 70%
  med.forEach((id) => log.push({ id, right: true })); // 100%
  const tip = St.levelTip(log, byId, fmt);
  const row = (l) => tip.rows.find((r) => r.level === l);
  assert.strictEqual(row('hard').expected, 12.5);
  assert.strictEqual(row('medium').expected, 10);
  assert.strictEqual(row('easy').enough, false);
  assert.strictEqual(tip.best, 'hard');
});

test('level tip only counts the last 30 answers per level', () => {
  const hard = pick((w) => w.level === 'hard', 60);
  const log = hard.map((id, i) => ({ id, right: i >= 30 })); // first 30 wrong, last 30 right
  const r = St.levelTip(log, byId, fmt).rows.find((x) => x.level === 'hard');
  assert.strictEqual(r.answers, 30);
  assert.strictEqual(r.accuracy, 1);
});

test('theme tip picks the best accuracy, or says not enough practice yet', () => {
  const geo = pick((w) => w.themes.length === 1 && w.themes[0] === 'geography', 12);
  const ani = pick((w) => w.themes.length === 1 && w.themes[0] === 'animals', 12);
  const sil = pick((w) => w.themes.length === 1 && w.themes[0] === 'silent_letter', 5);
  const log = [];
  geo.forEach((id, i) => log.push({ id, right: i < 6 }));
  ani.forEach((id, i) => log.push({ id, right: i < 11 }));
  sil.forEach((id) => log.push({ id, right: true }));
  const tip = St.themeTip(log, byId, bank.themes);
  assert.strictEqual(tip.best, 'animals');
  const s = tip.rows.find((r) => r.theme === 'silent_letter');
  assert.strictEqual(s.enough, false);
  assert.strictEqual(s.answers, 5);
  assert.strictEqual(St.themeTip([], byId, bank.themes).best, null);
});

test('most missed words', () => {
  const progress = { a: { wrong: 1, right: 0, lastSeen: 1 }, horse: { wrong: 3, right: 1, lastSeen: 2 }, camel: { wrong: 2, right: 0, lastSeen: 3 }, tiger: { wrong: 0, right: 2, lastSeen: 1 } };
  assert.deepStrictEqual(St.mostMissed(progress, byId, 5).map((x) => x.id), ['horse', 'camel']);
});
