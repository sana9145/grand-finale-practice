/* The A-Z tab: every word on either official list, letter by letter, in alphabetical parts of 20. No DOM.
   status = {id: 'd' | 'n'}   d = done (answered right in A-Z at least once), n = needs practice,
                              no entry = not asked yet.
   filter = {list: '68' | '911' | 'both', extreme: bool} */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.az = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.az;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function util() { return GF.util || require('./util.js'); }

  var PART = 20;
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var LIST_68 = 'official_2026', LIST_911 = 'official_2026_9_11';

  function normFilter(f) {
    f = f && typeof f === 'object' ? f : {};
    return { list: f.list === '68' || f.list === '911' ? f.list : 'both', extreme: f.extreme !== false };
  }

  function sortKey(w) { return String(w.word || '').toLowerCase().replace(/[\s-]/g, ''); }
  function compare(a, b) {
    var ka = sortKey(a), kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  function onList(w, list) {
    var s = w.sources || [];
    if (list === '68') return s.indexOf(LIST_68) >= 0;
    if (list === '911') return s.indexOf(LIST_911) >= 0;
    return s.indexOf(LIST_68) >= 0 || s.indexOf(LIST_911) >= 0;
  }

  // In the A-Z tab under this list choice, ignoring the extreme switch.
  function inList(w, f) { return !!w.in_az && !w.hidden && !!w.letter && onList(w, f.list); }

  function inFilter(w, filter) {
    var f = normFilter(filter);
    return inList(w, f) && (f.extreme || !w.extreme);
  }

  // Words of one letter under the filter, in alphabetical order.
  function letterWords(words, letter, filter) {
    return words.filter(function (w) { return w.letter === letter && inFilter(w, filter); }).sort(compare);
  }

  function letterIds(words, letter, filter) { return letterWords(words, letter, filter).map(function (w) { return w.id; }); }

  function chunks(ids) {
    var out = [];
    for (var i = 0; i < ids.length; i += PART) out.push(ids.slice(i, i + PART));
    return out;
  }

  // -> [[ids of part 1], [ids of part 2], ...]
  function parts(words, letter, filter) { return chunks(letterIds(words, letter, filter)); }

  function isAsked(status, id) { return !!(status && status[id]); }
  function isDone(status, id) { return !!(status && status[id] === 'd'); }

  // 'done' (every word asked) | 'progress' | 'new'
  function partStatus(ids, status) {
    var asked = ids.filter(function (id) { return isAsked(status, id); }).length;
    return asked === ids.length && ids.length ? 'done' : asked ? 'progress' : 'new';
  }

  function summary(ids, status) {
    var done = 0, needs = 0, asked = 0;
    ids.forEach(function (id) {
      var s = status && status[id];
      if (s) asked++;
      if (s === 'd') done++;
      if (s === 'n') needs++;
    });
    return { total: ids.length, done: done, needs: needs, asked: asked, complete: ids.length > 0 && done === ids.length };
  }

  // Tiles for the A-Z home. Letters with no words under the list choice are left out.
  // -> {letters:[{letter, ids, total, done, needs, complete, hiddenExtreme}], lettersDone, lettersTotal, wordsDone, wordsTotal}
  function overview(words, filter, status) {
    var f = normFilter(filter);
    var by = {};
    words.forEach(function (w) {
      if (!inList(w, f)) return;
      var b = by[w.letter] || (by[w.letter] = { shown: [], hiddenExtreme: 0 });
      if (f.extreme || !w.extreme) b.shown.push(w); else b.hiddenExtreme++;
    });
    var out = { letters: [], lettersDone: 0, lettersTotal: 0, wordsDone: 0, wordsTotal: 0 };
    LETTERS.forEach(function (L) {
      var b = by[L];
      if (!b) return;
      var ids = b.shown.sort(compare).map(function (w) { return w.id; });
      var s = summary(ids, status);
      out.letters.push({ letter: L, ids: ids, total: s.total, done: s.done, needs: s.needs, complete: s.complete, hiddenExtreme: b.hiddenExtreme });
      if (s.total) { out.lettersTotal++; if (s.complete) out.lettersDone++; }
      out.wordsDone += s.done;
      out.wordsTotal += s.total;
    });
    return out;
  }

  // The part Start / Continue should play: the first part with a word not asked yet,
  // else the first part with a word not done yet, else part 1.
  function nextPart(partList, status) {
    for (var i = 0; i < partList.length; i++) if (partStatus(partList[i], status) !== 'done') return i;
    for (var j = 0; j < partList.length; j++) if (summary(partList[j], status).done < partList[j].length) return j;
    return 0;
  }

  // "bewilder – blizzard"
  function partRange(ids, byId) {
    if (!ids.length) return '';
    var a = byId[ids[0]], b = byId[ids[ids.length - 1]];
    var name = function (w, id) { return w ? (w.display || w.word) : id; };
    return ids.length === 1 ? name(a, ids[0]) : name(a, ids[0]) + ' – ' + name(b, ids[ids.length - 1]);
  }

  // ---------- playing one part ----------
  // A wrong word goes to the end of the part and comes back once. Wrong again: it stays
  // "needs practice" and the part moves on, so a part always finishes.
  function startPart(ids, opts) {
    opts = opts || {};
    var order = opts.shuffle ? util().shuffle(ids, util().rng(opts.seed || 1)) : ids.slice();
    return { ids: ids.slice(), queue: order, current: null, retried: {}, seen: {}, answered: 0, right: 0, wrong: 0, finished: false };
  }

  function next(sess) {
    var s = util().clone(sess);
    s.current = s.queue.length ? s.queue.shift() : null;
    if (!s.current) s.finished = true;
    return s;
  }

  // prev: the word's status before ('d' | 'n' | undefined). -> {sess, mark: the word's new status}
  function answer(sess, prev, right) {
    var s = util().clone(sess);
    var id = s.current;
    s.answered += 1;
    s.seen[id] = 1;
    var mark;
    if (right) { s.right += 1; mark = 'd'; }
    else {
      s.wrong += 1;
      mark = prev === 'd' ? 'd' : 'n'; // done is for keeps
      if (!s.retried[id]) { s.retried[id] = 1; s.queue.push(id); }
    }
    s.finished = s.queue.length === 0;
    return { sess: s, mark: mark };
  }

  // "word 12 of 20"; retry = the current word is its second try.
  function position(sess) {
    var seen = Object.keys(sess.seen || {}).length;
    var retry = !!(sess.current && sess.seen[sess.current]);
    return { n: Math.min(sess.ids.length, seen + (sess.current && !retry ? 1 : 0)), total: sess.ids.length, retry: retry, asked: seen };
  }

  return {
    PART: PART, LETTERS: LETTERS, normFilter: normFilter, sortKey: sortKey, compare: compare, inFilter: inFilter,
    letterWords: letterWords, letterIds: letterIds, chunks: chunks, parts: parts, partStatus: partStatus, summary: summary,
    overview: overview, nextPart: nextPart, partRange: partRange, startPart: startPart, next: next, answer: answer, position: position
  };
});
