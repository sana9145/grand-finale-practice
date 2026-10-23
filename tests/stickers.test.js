const test = require('node:test');
const assert = require('node:assert');
const { GF } = require('./_load.js');
const K = GF.stickers, U = GF.util, M = GF.mascot;

test('96 unique stickers in 8 packs of 12, including the yarn, all with names', () => {
  assert.strictEqual(K.PACKS.length, 8);
  for (const p of K.PACKS) assert.strictEqual(p.stickers.length, 12, p.id);
  assert.ok(K.ALL.length >= 96);
  assert.strictEqual(new Set(K.ALL.map((s) => s.id)).size, K.ALL.length);
  assert.strictEqual(new Set(K.ALL.map((s) => s.emoji)).size, K.ALL.length);
  const yarn = K.ALL.find((s) => s.emoji === '🧶');
  assert.ok(yarn, 'the yarn is in the book');
  assert.strictEqual(yarn.name, 'Yarn ball');
  for (const s of K.ALL) assert.ok(s.name && s.name.length > 2 && ['common', 'rare', 'legendary'].includes(s.rarity), s.id);
});

test('never the same sticker twice in a row', () => {
  const r = K.blank();
  const rand = U.rng(11);
  let prev = null;
  for (let i = 0; i < 2000; i++) {
    const id = K.give(r, K.draw(r, rand));
    assert.notStrictEqual(id, prev, 'same sticker twice at draw ' + i);
    prev = id;
  }
  const ids = K.drawMany(K.blank(), U.rng(3), 300);
  for (let i = 1; i < ids.length; i++) assert.notStrictEqual(ids[i], ids[i - 1]);
});

test('stickers she does not have yet come first', () => {
  const r = K.blank();
  const commons = K.ALL.filter((s) => s.rarity === 'common');
  commons.slice(3).forEach((s) => { r.owned[s.id] = 1; });
  const missing = commons.slice(0, 3).map((s) => s.id);
  const rand = U.rng(5);
  for (let i = 0; i < 200; i++) {
    const id = K.draw(r, rand);
    if (K.BY_ID[id].rarity === 'common') assert.ok(missing.includes(id), id + ' is already owned');
  }
  // a fresh book fills up without repeats until a rarity runs out
  const fresh = K.blank();
  const got = K.drawMany(fresh, U.rng(9), 20);
  assert.strictEqual(new Set(got).size, 20);
});

test('rarity split is about 70 / 25 / 5 over 10,000 seeded draws', () => {
  const rand = U.rng(2026);
  const n = { common: 0, rare: 0, legendary: 0 };
  const r = K.blank();
  for (let i = 0; i < 10000; i++) n[K.BY_ID[K.give(r, K.draw(r, rand))].rarity]++;
  assert.ok(Math.abs(n.common / 10000 - 0.70) < 0.02, JSON.stringify(n));
  assert.ok(Math.abs(n.rare / 10000 - 0.25) < 0.02, JSON.stringify(n));
  assert.ok(Math.abs(n.legendary / 10000 - 0.05) < 0.01, JSON.stringify(n));
  const a = U.rng(4), b = U.rng(4);
  const ra = K.blank(), rb = K.blank();
  for (let i = 0; i < 50; i++) assert.strictEqual(K.give(ra, K.draw(ra, a)), K.give(rb, K.draw(rb, b)), 'seeded = repeatable');
});

test('the shop spends exactly 15 stars and gives the chosen sticker', () => {
  const r = K.blank();
  r.stars = 14;
  assert.strictEqual(K.buy(r, 'yarn').ok, false);
  assert.strictEqual(r.stars, 14);
  r.stars = 20;
  assert.deepStrictEqual(K.buy(r, 'yarn'), { ok: true });
  assert.strictEqual(r.stars, 5);
  assert.strictEqual(r.owned.yarn, 1);
  assert.strictEqual(K.buy(r, 'yarn').ok, false, 'not one she already has');
  r.stars = 15;
  assert.strictEqual(K.buy(r, 'nope').ok, false);
  assert.strictEqual(r.stars, 15);
});

test('pack openings give 3 stickers, marking the new ones', () => {
  const r = K.blank();
  r.owned.yarn = 1;
  const item = K.award(r, U.rng(1), K.PACK_SIZE, 'pack', 'board');
  assert.strictEqual(item.stickers.length, 3);
  assert.strictEqual(item.fresh.length, 3);
  assert.strictEqual(K.total(r), 4);
  item.stickers.forEach((id, i) => assert.strictEqual(item.fresh[i], id !== 'yarn'));
  assert.strictEqual(r.pending.length, 1);
  K.open(r, item.id);
  assert.strictEqual(r.pending.length, 0);
  assert.strictEqual(K.total(r), 4, 'opening only shows them');
});

test('stars, 3 in a row and the surprise box every 20 answers', () => {
  const r = K.blank();
  const rand = U.rng(8);
  let stickers = 0, boxes = 0;
  for (let i = 1; i <= 40; i++) {
    const ev = K.onAnswer(r, i % 7 !== 0, rand, i);
    if (ev.sticker) stickers++;
    if (ev.box) boxes++;
  }
  assert.strictEqual(r.stars, 40 - 5);
  assert.strictEqual(r.starsEarned, 35);
  assert.strictEqual(boxes, 2);
  assert.strictEqual(r.pending.filter((p) => p.type === 'box').length, 2);
  for (const p of r.pending) assert.ok(p.stickers.length >= 1 && p.stickers.length <= 2);
  // runs: 6 right then a wrong, so two stickers per run of 6, and 5 right at the end (one sticker)
  assert.strictEqual(stickers, 5 * 2 + 1);
  const r2 = K.blank();
  [true, true, true].forEach((x, i) => K.onAnswer(r2, x, rand, i + 1));
  assert.strictEqual(r2.run, 3);
  assert.strictEqual(K.onAnswer(r2, false, rand, 4).run, 0);
});

test('old stickers move into the book', () => {
  const r = K.fromLegacy(45);
  assert.strictEqual(K.total(r), 45);
  assert.strictEqual(r.owned.butterfly, 3);
  assert.strictEqual(r.owned.lollipop, 3);
  assert.strictEqual(r.owned.microphone, 2);
  assert.strictEqual(K.fromLegacy(0).owned && K.total(K.fromLegacy(0)), 0);
});

test('completed packs unlock board themes; every 10 stickers unlock a token', () => {
  const r = K.blank();
  assert.deepStrictEqual(K.unlockedThemes(r).map((t) => t.id), ['classic']);
  assert.strictEqual(K.unlockedTokens(r).length, 0);
  K.PACKS.find((p) => p.id === 'ocean').stickers.forEach((s) => { r.owned[s[0]] = 1; });
  assert.deepStrictEqual(K.unlockedThemes(r).map((t) => t.id), ['classic', 'ocean']);
  assert.strictEqual(K.unlockedTokens(r).length, 1);
  r.boardTheme = 'space';
  assert.strictEqual(K.theme(r).id, 'classic', 'a locked theme falls back to classic');
  r.boardTheme = 'ocean';
  assert.strictEqual(K.theme(r).id, 'ocean');
  assert.strictEqual(K.awardLetter(r, 'B', '2026-10-22'), true);
  assert.strictEqual(K.awardLetter(r, 'B', '2026-10-23'), false);
  assert.strictEqual(K.awardTrophy(r, 'azChampion', '2026-10-22'), true);
  assert.strictEqual(K.TROPHIES.length, 7);
});

test('normalize keeps good data and drops junk', () => {
  const r = K.normalize({ owned: { yarn: 2, fake: 3, kite: -1 }, stars: 'x', pending: [null, { stickers: ['yarn'] }] });
  assert.deepStrictEqual(r.owned, { yarn: 2 });
  assert.strictEqual(r.stars, 0);
  assert.strictEqual(r.pending.length, 1);
});

test('the owl has at least 40 lines and never says the same one twice in a row', () => {
  assert.ok(M.CHEERS.length + M.KIND.length >= 40);
  assert.strictEqual(new Set(M.CHEERS.concat(M.KIND)).size, M.CHEERS.length + M.KIND.length);
  const rand = U.rng(1);
  let last = null;
  for (let i = 0; i < 500; i++) { const c = M.cheer(last, rand); assert.notStrictEqual(c, last); last = c; }
  for (let i = 0; i < 500; i++) { const c = M.kind(last, rand); assert.notStrictEqual(c, last); last = c; }
});
