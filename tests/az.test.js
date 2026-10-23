const test = require('node:test');
const assert = require('node:assert');
const { GF, bank, merged } = require('./_load.js');
const A = GF.az, St = GF.storage;

const words = merged().words;
const byId = Object.fromEntries(words.map((w) => [w.id, w]));
const FILTERS = [];
for (const list of ['68', '911', 'both']) for (const extreme of [true, false]) FILTERS.push({ list, extreme });

test('every A-Z word is in exactly one letter and exactly one part', () => {
  const f = { list: 'both', extreme: true };
  const seen = new Map();
  for (const L of A.LETTERS) {
    A.parts(words, L, f).forEach((part, pi) => part.forEach((id) => {
      assert.ok(!seen.has(id), `${id} is in ${seen.get(id)} and ${L}${pi}`);
      seen.set(id, L + pi);
      assert.strictEqual(byId[id].letter, L);
    }));
  }
  const azIds = bank.words.filter((w) => w.in_az).map((w) => w.id);
  assert.strictEqual(seen.size, 2990);
  for (const id of azIds) assert.ok(seen.has(id), id);
});

test('letter totals match the data under each filter', () => {
  for (const f of FILTERS) {
    const want = {};
    for (const w of bank.words) {
      if (!w.in_az) continue;
      const on68 = w.sources.includes('official_2026'), on911 = w.sources.includes('official_2026_9_11');
      if (f.list === '68' && !on68) continue;
      if (f.list === '911' && !on911) continue;
      if (!f.extreme && w.extreme) continue;
      want[w.letter] = (want[w.letter] || 0) + 1;
    }
    const ov = A.overview(words, f, {});
    for (const t of ov.letters) assert.strictEqual(t.total, want[t.letter] || 0, `${JSON.stringify(f)} ${t.letter}`);
    assert.strictEqual(ov.wordsTotal, Object.values(want).reduce((a, b) => a + b, 0), JSON.stringify(f));
    assert.strictEqual(ov.lettersTotal, Object.keys(want).length);
  }
  const both = A.overview(words, { list: 'both', extreme: true }, {});
  assert.strictEqual(both.wordsTotal, 2990);
  assert.strictEqual(both.lettersTotal, 26);
});

test('the extremely-hard switch changes the totals and says how many are hidden', () => {
  const on = A.overview(words, { list: 'both', extreme: true }, {});
  const off = A.overview(words, { list: 'both', extreme: false }, {});
  assert.strictEqual(on.wordsTotal - off.wordsTotal, 214);
  const hidden = off.letters.reduce((s, t) => s + t.hiddenExtreme, 0);
  assert.strictEqual(hidden, 214);
  const b = (ov) => ov.letters.find((t) => t.letter === 'B');
  assert.strictEqual(b(on).total, b(off).total + b(off).hiddenExtreme);
  assert.strictEqual(b(on).hiddenExtreme, 0);
});

test('parts are 20 words, in alphabetical order (ignoring case, spaces and hyphens)', () => {
  for (const L of A.LETTERS) {
    const ps = A.parts(words, L, { list: 'both', extreme: true });
    ps.forEach((p, i) => {
      assert.ok(p.length <= 20 && p.length > 0);
      if (i < ps.length - 1) assert.strictEqual(p.length, 20);
    });
    const flat = ps.flat();
    const keys = flat.map((id) => byId[id].word.toLowerCase().replace(/[\s-]/g, ''));
    assert.deepStrictEqual(keys, keys.slice().sort(), L);
  }
  const b = A.parts(words, 'B', { list: 'both', extreme: true });
  assert.ok(A.partRange(b[0], byId).includes(' – '));
});

function playPart(ids, answers) {
  // answers: id -> list of right/wrong for each time it is asked
  const status = {};
  let s = A.next(A.startPart(ids));
  const order = [];
  let guard = 0;
  while (!s.finished && s.current && guard++ < 200) {
    const id = s.current;
    order.push(id);
    const list = answers[id] || [true];
    const right = list.length ? list.shift() : true;
    const r = A.answer(s, status[id], right);
    status[id] = r.mark;
    s = A.next(r.sess);
  }
  return { status, order, sess: s };
}

test('a wrong word comes back once at the end, then becomes "needs practice"; a part always finishes', () => {
  const ids = A.parts(words, 'Q', { list: 'both', extreme: true })[0];
  const a = ids[2], b = ids[5];
  const r = playPart(ids, { [a]: [false, true], [b]: [false, false] });
  assert.strictEqual(r.order.length, ids.length + 2);
  assert.deepStrictEqual(r.order.slice(-2), [a, b], 'the wrong words come back after the rest');
  assert.strictEqual(r.status[a], 'd', 'right on the second try = done');
  assert.strictEqual(r.status[b], 'n', 'wrong twice = needs practice');
  assert.ok(r.sess.finished);
  assert.strictEqual(A.partStatus(ids, r.status), 'done', 'every word asked');
  const sum = A.summary(ids, r.status);
  assert.deepStrictEqual([sum.done, sum.needs, sum.complete], [ids.length - 1, 1, false]);
});

test('done is for keeps: a done word answered wrong later stays done', () => {
  const ids = ['x1', 'x2'];
  let s = A.next(A.startPart(ids));
  const r = A.answer(s, 'd', false);
  assert.strictEqual(r.mark, 'd');
});

test('a letter is complete only when all its words are done', () => {
  const f = { list: 'both', extreme: true };
  const ids = A.letterIds(words, 'X', f);
  assert.ok(ids.length >= 1);
  const status = {};
  ids.slice(0, -1).forEach((id) => { status[id] = 'd'; });
  status[ids[ids.length - 1]] = 'n';
  assert.strictEqual(A.overview(words, f, status).letters.find((t) => t.letter === 'X').complete, false);
  status[ids[ids.length - 1]] = 'd';
  const ov = A.overview(words, f, status);
  assert.strictEqual(ov.letters.find((t) => t.letter === 'X').complete, true);
  assert.strictEqual(ov.lettersDone, 1);
  assert.strictEqual(ov.wordsDone, ids.length);
});

test('resume after a reload: the saved session carries on with the same word', () => {
  const ids = A.parts(words, 'Z', { list: 'both', extreme: true })[0];
  let s = A.next(A.startPart(ids, { shuffle: true, seed: 7 }));
  const status = {};
  for (let i = 0; i < 5; i++) { const r = A.answer(s, status[s.current], i !== 2); status[s.current] = r.mark; s = A.next(r.sess); }
  const st = St.defaultState(1);
  st.sessions.az = { kind: 'az', letter: 'Z', part: 0, part0: s };
  st.az.w = status;
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  St.save(storage, st);
  const back = St.load(storage, 2).state;
  const s2 = back.sessions.az.part0;
  assert.strictEqual(s2.current, s.current);
  assert.deepStrictEqual(A.position(s2), A.position(s));
  assert.deepStrictEqual(back.az.w, status);
  assert.strictEqual(A.position(s2).n, 6);
  // shuffled order uses the same words
  assert.deepStrictEqual(s2.ids.slice().sort(), ids.slice().sort());
});

test('next part: the first unfinished one, else one with words not done', () => {
  const ps = A.parts(words, 'B', { list: 'both', extreme: true });
  const status = {};
  assert.strictEqual(A.nextPart(ps, status), 0);
  ps[0].forEach((id) => { status[id] = 'd'; });
  ps[1].forEach((id) => { status[id] = 'n'; });
  assert.strictEqual(A.nextPart(ps, status), 2);
  ps.slice(2).flat().forEach((id) => { status[id] = 'd'; });
  assert.strictEqual(A.nextPart(ps, status), 1, 'all asked: go back to the part with missed words');
});

test('words added later go into their letter, and hidden words leave it', () => {
  const O = GF.overlay, I = GF.importMerge;
  const pv = I.preview('word,meaning\naardwolf,A small hyena-like animal.\nabacus,A frame with beads for counting.', 'csv',
    { bank, defaultTheme: null, defaultTier: 'easy', defaultList: '911', defaultBand: '' }, merged().byId);
  assert.strictEqual(pv.fresh.length, 2);
  const r = I.apply(O.empty(), pv, bank.finale_format.round2.levels);
  const m = merged(r.overlay);
  assert.strictEqual(m.byId.abacus.letter, 'A');
  assert.strictEqual(m.byId.abacus.in_az, true);
  assert.ok(m.byId.abacus.band_9_11);
  assert.ok(m.byId.abacus.sources.includes('official_2026_9_11'));
  const f = { list: 'both', extreme: true };
  assert.strictEqual(A.letterIds(m.words, 'A', f).length, A.letterIds(words, 'A', f).length + 2);
  assert.strictEqual(A.overview(m.words, f, {}).wordsTotal, 2992);
  assert.ok(A.letterIds(m.words, 'A', { list: '911', extreme: true }).includes('aardwolf'));
  assert.ok(!A.letterIds(m.words, 'A', { list: '68', extreme: true }).includes('aardwolf'));
  // added without a list: not an A-Z word
  const pv2 = I.preview('zorbing', 'text', { bank, defaultTier: 'easy', defaultList: '' }, merged().byId);
  const m2 = merged(I.apply(O.empty(), pv2, bank.finale_format.round2.levels).overlay);
  assert.strictEqual(m2.byId.zorbing.in_az, false);
  // a band column puts a word on the 9-11 list
  const pv3 = I.preview('word,band_9_11\nnebulous,extreme', 'csv', { bank, defaultTier: 'easy' }, merged().byId);
  const m3 = merged(I.apply(O.empty(), pv3, bank.finale_format.round2.levels).overlay);
  assert.strictEqual(m3.byId.nebulous.extreme, true);
  assert.strictEqual(m3.byId.nebulous.level, 'hard');
  // hiding a word takes it out of the A-Z tab
  const hid = merged(O.setHidden(O.empty(), A.letterIds(words, 'Q', f)[0], true));
  assert.strictEqual(A.letterIds(hid.words, 'Q', f).length, A.letterIds(words, 'Q', f).length - 1);
});

test('a word added earlier can be put on the 9-11 list by importing it again', () => {
  const O = GF.overlay, I = GF.importMerge;
  const lv = bank.finale_format.round2.levels;
  const first = I.apply(O.empty(), I.preview('abacus', 'text', { bank, defaultTier: 'easy' }, merged().byId), lv).overlay;
  const pv = I.preview('abacus', 'text', { bank, defaultTier: 'easy', defaultList: '911', defaultBand: 'medium' }, merged(first).byId);
  assert.strictEqual(pv.different.length, 1);
  assert.deepStrictEqual(pv.different[0].fields, ['sources']);
  pv.different[0].choice = 'imported';
  const m = merged(I.apply(first, pv, lv).overlay);
  assert.strictEqual(m.byId.abacus.in_az, true);
  assert.strictEqual(m.byId.abacus.band_9_11, 'medium');
});
