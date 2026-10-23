const test = require('node:test');
const assert = require('node:assert');
const { GF } = require('./_load.js');
const S = GF.scheduler, B = GF.board, U = GF.util;

const at = (day, h) => Date.parse(`${day}T${String(h || 10).padStart(2, '0')}:00:00`);

test('right moves the box up, wrong sends it back to box 1', () => {
  let p = S.answer(null, true, at('2026-10-20'), '2026-10-20');
  assert.strictEqual(p.box, 1);
  p = S.answer(p, true, at('2026-10-20', 11), '2026-10-20');
  assert.strictEqual(p.box, 2);
  p = S.answer(p, false, at('2026-10-20', 12), '2026-10-20');
  assert.deepStrictEqual([p.box, p.streak, p.wrong, p.lastResult], [1, 0, 1, 'wrong']);
  assert.ok(S.isTryAgain(p));
  assert.ok(S.isMissed(p));
});

test('mastery needs box 5 and right answers on 2 different days', () => {
  let p = null;
  for (let i = 0; i < 6; i++) p = S.answer(p, true, at('2026-10-20', 9 + i), '2026-10-20');
  assert.strictEqual(p.box, 5);
  assert.strictEqual(S.isMastered(p), false);
  p = S.answer(p, true, at('2026-10-21'), '2026-10-21');
  assert.strictEqual(S.isMastered(p), true);
  assert.strictEqual(S.isMissed(p), false);
});

test('due: box n after n days', () => {
  let p = S.answer(null, true, at('2026-10-20'), '2026-10-20'); // box 1
  assert.strictEqual(S.isDue(p, '2026-10-20'), false);
  assert.strictEqual(S.isDue(p, '2026-10-21'), true);
  p = S.answer(p, true, at('2026-10-21'), '2026-10-21'); // box 2
  assert.strictEqual(S.isDue(p, '2026-10-22'), false);
  assert.strictEqual(S.isDue(p, '2026-10-23'), true);
});

test('pool order: try-again, due, new, then least recently seen', () => {
  const progress = {
    wrong1: S.answer(null, false, at('2026-10-20'), '2026-10-20'),
    due1: S.answer(null, true, at('2026-10-19'), '2026-10-19'),
    old: Object.assign(S.answer(null, true, at('2026-10-21', 8), '2026-10-21'), { lastSeen: 5 }),
    recent: Object.assign(S.answer(null, true, at('2026-10-21', 9), '2026-10-21'), { lastSeen: 9 }),
  };
  const o = S.order(['recent', 'new1', 'old', 'due1', 'wrong1'], progress, '2026-10-21', U.rng(1));
  assert.deepStrictEqual(o, ['wrong1', 'due1', 'new1', 'old', 'recent']);
});

test('board: forward, back, never below Start, stickers, finish', () => {
  let b = B.next(B.create({ ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], length: 10, wrongMode: 'back' }));
  b = B.answer(b, false, U.rng(1));
  assert.strictEqual(b.pos, 0);
  for (let i = 0; i < 5; i++) b = B.next(B.answer(b, true, U.rng(1)));
  assert.strictEqual(b.pos, 5);
  assert.strictEqual(b.stickers, 1);
  b = B.answer(b, false, U.rng(1));
  assert.strictEqual(b.pos, 4);
  b = B.answer(b, true, U.rng(1));
  assert.strictEqual(b.stickers, 1, 'no second sticker for the same square');
  for (let i = 0; i < 5; i++) b = B.answer(b, true, U.rng(1));
  assert.strictEqual(b.pos, 10);
  assert.strictEqual(b.finished, true);
  assert.strictEqual(b.stickers, 2);
  b = B.answer(b, true, U.rng(1));
  assert.strictEqual(b.pos, 10, 'never past the trophy');
  const lap = B.newLap(b);
  assert.deepStrictEqual([lap.pos, lap.finished, lap.laps], [0, false, 1]);
});

test('board: "stay" mode keeps the token still on a wrong answer', () => {
  let b = B.next(B.create({ ids: ['a', 'b', 'c'], length: 10, wrongMode: 'stay' }));
  b = B.answer(b, true, U.rng(1));
  b = B.answer(b, false, U.rng(1));
  assert.strictEqual(b.pos, 1);
});

test('try-again spacing: a wrong word comes back after 3-5 other words, at most twice', () => {
  const ids = 'abcdefghijklmnopqrstuvwxyz'.split('');
  let b = B.next(B.create({ ids, length: 30 }));
  assert.strictEqual(b.current, 'a');
  b = B.answer(b, false, U.rng(7));
  const gap = b.queue.indexOf('a');
  assert.ok(gap >= 3 && gap <= 5, `gap ${gap}`);
  // play until 'a' comes back, get it wrong again, and again
  let comes = 1;
  for (let i = 0; i < 40 && b.queue.length; i++) {
    b = B.next(b);
    if (b.current === 'a') { comes++; b = B.answer(b, false, U.rng(i)); }
    else b = B.answer(b, true, U.rng(i));
  }
  assert.strictEqual(comes, 3, 'first time + 2 retries');
  assert.strictEqual(b.retries.a, 2);
});

test('undo restores the board exactly (snapshot before answering)', () => {
  let b = B.next(B.create({ ids: ['a', 'b', 'c', 'd', 'e', 'f'], length: 10 }));
  b = B.next(B.answer(b, true, U.rng(1)));
  const snap = JSON.stringify(b);
  const after = B.answer(b, false, U.rng(2));
  assert.notStrictEqual(JSON.stringify(after), snap);
  assert.deepStrictEqual(JSON.parse(snap), b, 'answer() does not change its input');
});

test('refill adds the pool again when the queue runs out', () => {
  let b = B.next(B.create({ ids: ['a'], length: 10 }));
  b = B.answer(b, true, U.rng(1));
  b = B.refill(b, ['a', 'b']);
  assert.deepStrictEqual(b.queue, ['b']);
  b = B.refill(B.next(b), ['b']);
  assert.deepStrictEqual(b.queue, ['b'], 'a pool of one word still works');
});
