/* The board game: a path of N squares from Start to a trophy. Pure functions. No DOM.
   Right = forward 1. Wrong = back 1 (or stay), never below Start.
   Every 5th square reached for the first time gives a sticker.
   A wrong word comes back after 3-5 other words, at most twice per game. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.board = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.board;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function util() { return GF.util || require('./util.js'); }

  // opts: {ids, length (10/20/30), wrongMode: 'back' | 'stay'}
  function create(opts) {
    return {
      length: opts.length || 20, wrongMode: opts.wrongMode === 'stay' ? 'stay' : 'back',
      pos: 0, maxPos: 0, stickers: 0, finished: false, laps: 0,
      queue: (opts.ids || []).slice(), retries: {}, answered: 0, right: 0, wrong: 0,
      current: null, lastMove: 0, lastSticker: false
    };
  }

  // Move the next word into `current`.
  function next(state) {
    var s = util().clone(state);
    s.current = s.queue.length ? s.queue.shift() : null;
    return s;
  }

  function refill(state, ids) {
    var s = util().clone(state);
    var cur = s.current;
    var add = ids.filter(function (id) { return id !== cur && s.queue.indexOf(id) < 0; });
    // If the only word left is the one just played, allow it anyway (tiny pools).
    if (!add.length && ids.length) add = ids.slice();
    s.queue = s.queue.concat(add);
    return s;
  }

  // rand: seeded random function. Returns a new state.
  function answer(state, right, rand) {
    var s = util().clone(state);
    var id = s.current;
    s.answered += 1;
    s.lastSticker = false;
    var before = s.pos;
    if (right) { s.right += 1; s.pos = Math.min(s.length, s.pos + 1); }
    else {
      s.wrong += 1;
      if (s.wrongMode === 'back') s.pos = Math.max(0, s.pos - 1);
      var n = s.retries[id] || 0;
      if (id && n < 2) {
        s.retries[id] = n + 1;
        var gap = 3 + Math.floor((rand ? rand() : Math.random()) * 3); // 3, 4 or 5 other words
        s.queue = s.queue.filter(function (x) { return x !== id; });
        s.queue.splice(Math.min(gap, s.queue.length), 0, id);
      }
    }
    s.lastMove = s.pos - before;
    if (s.pos > s.maxPos) {
      s.maxPos = s.pos;
      if (s.pos % 5 === 0 && s.pos > 0) { s.stickers += 1; s.lastSticker = true; }
    }
    if (s.pos >= s.length) s.finished = true;
    return s;
  }

  // Start a new lap on the same board (Today's practice keeps going after the trophy).
  function newLap(state) {
    var s = util().clone(state);
    s.pos = 0; s.maxPos = 0; s.finished = false; s.laps += 1; s.lastMove = 0;
    return s;
  }

  return { create: create, next: next, refill: refill, answer: answer, newLap: newLap };
});
