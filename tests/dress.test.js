const test = require('node:test');
const assert = require('node:assert');
const { GF } = require('./_load.js');
const D = GF.dress, U = GF.util, St = GF.storage;

test('the wardrobe: unique items, every tab has a free choice, the default look is free', () => {
  assert.ok(D.ITEMS.length >= 130, D.ITEMS.length + ' items');
  assert.strictEqual(new Set(D.ITEMS.map((i) => i.id)).size, D.ITEMS.length);
  const slots = D.SLOTS.map((s) => s.id);
  for (const it of D.ITEMS) {
    assert.ok(slots.includes(it.slot), it.id);
    assert.ok(Number.isInteger(it.price) && it.price >= 0 && it.price <= 40, it.id);
    assert.ok(it.name && it.value !== undefined, it.id);
  }
  for (const s of slots) {
    assert.ok(D.itemsFor(s).some((i) => i.price === 0), s + ' has a free item');
    assert.strictEqual(D.BY_ID[D.DEFAULT_LOOK[s]].slot, s);
    assert.strictEqual(D.BY_ID[D.DEFAULT_LOOK[s]].price, 0);
  }
  assert.ok(D.BY_ID['out-shalwar'] && D.BY_ID['out-lehenga'] && D.BY_ID['hd-scarf'].price === 0);
});

test('buying spends exactly the price and puts it on; not enough stars changes nothing', () => {
  const d = D.blank(), r = { stars: 25 };
  assert.deepStrictEqual(D.buy(d, r, 'bk-fairy'), { ok: false, need: 5, error: 'You need 5 more stars.' });
  assert.strictEqual(r.stars, 25);
  assert.ok(!d.owned['bk-fairy']);
  assert.deepStrictEqual(D.buy(d, r, 'hd-tiara'), { ok: true });
  assert.strictEqual(r.stars, 0);
  assert.strictEqual(d.look.head, 'hd-tiara');
  assert.ok(D.buy(d, r, 'hd-tiara').ok, 'buying something she has just wears it, free');
  assert.strictEqual(r.stars, 0);
  assert.strictEqual(D.buy(d, r, 'nope').ok, false);
  assert.strictEqual(D.wear(d, 'pet-dragon'), false, "can't wear what she doesn't have");
  assert.ok(D.wear(d, 'hd-scarf'));
});

test('gifts: always something new, cheaper things more often, then nothing when all are won', () => {
  const d = D.blank(), rand = U.rng(7);
  const first = [];
  for (let i = 0; i < 20; i++) first.push(D.gift(d, rand));
  assert.strictEqual(new Set(first).size, 20);
  const avg = first.reduce((s, id) => s + D.BY_ID[id].price, 0) / 20;
  const all = D.ITEMS.filter((i) => i.price > 0);
  const avgAll = all.reduce((s, i) => s + i.price, 0) / all.length;
  assert.ok(avg < avgAll, `gifts average ${avg} < wardrobe average ${avgAll}`);
  let n = 0;
  while (D.gift(d, rand)) n++;
  assert.strictEqual(D.counts(d).owned, D.counts(d).total);
  assert.strictEqual(D.gift(d, rand), null);
});

test('surprise outfits only use things she has; saved looks', () => {
  const d = D.blank();
  d.owned['pet-kitten'] = 1; d.owned['hd-crown'] = 1;
  for (let i = 0; i < 50; i++) {
    D.surprise(d, U.rng(i));
    for (const [slot, id] of Object.entries(d.look)) assert.ok(D.isOwned(d, id), slot + ' ' + id);
  }
  for (let i = 0; i < D.MAX_LOOKS; i++) assert.ok(D.saveLook(d, i));
  assert.strictEqual(D.saveLook(d, 99), false, 'only 6 looks');
  d.look.head = 'hd-none';
  assert.ok(D.wearLook(d, 2));
  D.deleteLook(d, 0);
  assert.strictEqual(d.looks.length, 5);
  const tried = D.tryOn(d.look, 'bk-fairy');
  assert.strictEqual(tried.back, 'bk-fairy');
  assert.notStrictEqual(d.look.back, 'bk-fairy', 'trying on changes nothing');
});

test('normalize keeps good data and repairs junk', () => {
  const d = D.normalize({ owned: { 'hd-crown': 1, fake: 1, 'skin1': 1 }, look: { head: 'hd-crown', pet: 'pet-dragon', outfit: 'hair-bob', skin: 'zzz' },
    looks: Array(9).fill({ look: { head: 'hd-crown' } }).concat([null, 'x']), name: '   Princess Zara the Great and Wonderful   ' });
  assert.deepStrictEqual(d.owned, { 'hd-crown': 1 });
  assert.strictEqual(d.look.head, 'hd-crown');
  assert.strictEqual(d.look.pet, 'pet-none', 'not owned: back to the default');
  assert.strictEqual(d.look.outfit, 'out-dress', 'wrong slot: back to the default');
  assert.strictEqual(d.look.skin, 'skin2');
  assert.strictEqual(d.looks.length, 6);
  assert.strictEqual(d.name, 'Princess Zara the Gr');
  assert.deepStrictEqual(D.normalize('junk'), D.blank());
});

function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('saved data and backups from before the dress-up update still load (and gain a blank doll)', () => {
  const st = St.defaultState(1);
  delete st.dress;
  st.profile.name = 'Zara';
  st.rewards.stars = 42;
  st.progress.horse = { box: 3, seen: 3, right: 3, wrong: 0, streak: 3, lastSeen: 1, lastDay: '2026-10-20', lastResult: 'right', days: ['2026-10-20'] };
  const r = St.load(fakeStorage({ [St.KEY]: JSON.stringify(st) }), 2);
  assert.strictEqual(r.corruptKey, null);
  assert.strictEqual(r.state.rewards.stars, 42);
  assert.deepStrictEqual(r.state.dress, D.blank());
  const b = St.makeBackup(st, 3);
  delete b.dress;
  const rb = St.readBackup(JSON.stringify(b), 4);
  assert.ok(rb.ok, rb.error);
  assert.strictEqual(rb.state.progress.horse.box, 3);
  assert.deepStrictEqual(rb.state.dress, D.blank());
  assert.strictEqual(rb.summary.dressItems, 0);
});

test('a backup carries the doll and the wardrobe; the version number is unchanged so older copies can still read it', () => {
  const st = St.defaultState(1);
  st.dress.owned['bk-fairy'] = 1;
  D.wear(st.dress, 'bk-fairy');
  st.dress.name = 'Mimi';
  D.saveLook(st.dress, 5);
  const b = JSON.parse(JSON.stringify(St.makeBackup(st, 9)));
  assert.strictEqual(b.schemaVersion, 2, 'same version as before the dress-up update');
  assert.strictEqual(b.backupVersion, 1);
  const back = St.readBackup(JSON.stringify(b), 10);
  assert.ok(back.ok);
  assert.strictEqual(back.state.dress.look.back, 'bk-fairy');
  assert.strictEqual(back.state.dress.name, 'Mimi');
  assert.strictEqual(back.state.dress.looks.length, 1);
  assert.strictEqual(back.summary.dressItems, 1);
});
