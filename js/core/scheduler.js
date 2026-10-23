/* Spaced repetition: per-word progress, mastery, and the order words come up in. No DOM.
   progress[id] = {box 0-5, seen, right, wrong, streak, lastSeen (ms), lastDay, lastResult, days:[right-answer days]} */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.scheduler = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.scheduler;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function util() { return GF.util || require('./util.js'); }

  var GROUP = { TRY_AGAIN: 0, DUE: 1, NEW: 2, OTHER: 3 };

  function blank() { return { box: 0, seen: 0, right: 0, wrong: 0, streak: 0, lastSeen: 0, lastDay: null, lastResult: null, days: [] }; }

  // Returns a new record. now: ms timestamp; day: "YYYY-MM-DD" (defaults to now's local day).
  function answer(p, right, now, day) {
    var r = Object.assign(blank(), p || {});
    r.days = (r.days || []).slice();
    day = day || util().dayKey(now);
    r.seen += 1;
    r.lastSeen = now;
    r.lastDay = day;
    if (right) {
      r.right += 1;
      r.streak += 1;
      r.box = Math.min(5, r.box + 1);
      r.lastResult = 'right';
      if (r.days.indexOf(day) < 0) { r.days.push(day); if (r.days.length > 5) r.days = r.days.slice(-5); }
    } else {
      r.wrong += 1;
      r.streak = 0;
      r.box = 1;
      r.lastResult = 'wrong';
    }
    return r;
  }

  function isMastered(p) { return !!p && p.box >= 5 && (p.days || []).length >= 2; }
  function isMissed(p) { return !!p && p.wrong > 0 && !isMastered(p); }
  function isNew(p) { return !p || !p.seen; }
  function isTryAgain(p) { return !!p && p.lastResult === 'wrong'; }
  // Box 1 after 1 day, box 2 after 2, box 3 after 3, box 4 after 4.
  function isDue(p, today) {
    if (!p || !p.seen || p.box < 1 || p.box > 4 || !p.lastDay) return false;
    return util().daysBetween(p.lastDay, today) >= p.box;
  }

  function group(p, today) {
    if (isTryAgain(p)) return GROUP.TRY_AGAIN;
    if (isDue(p, today)) return GROUP.DUE;
    if (isNew(p)) return GROUP.NEW;
    return GROUP.OTHER;
  }

  // Order ids: try-again, due, new, then everything else (least recently seen first).
  // Random within each group (seeded).
  function order(ids, progress, today, rand) {
    var groups = [[], [], [], []];
    ids.forEach(function (id) { groups[group(progress[id], today)].push(id); });
    var u = util();
    var out = u.shuffle(groups[0], rand).concat(u.shuffle(groups[1], rand), u.shuffle(groups[2], rand));
    var rest = u.shuffle(groups[3], rand);
    rest.sort(function (a, b) { return ((progress[a] || {}).lastSeen || 0) - ((progress[b] || {}).lastSeen || 0); });
    return out.concat(rest);
  }

  function accuracy(ids, progress) {
    var r = 0, w = 0;
    ids.forEach(function (id) { var p = progress[id]; if (p) { r += p.right; w += p.wrong; } });
    return r + w ? r / (r + w) : null;
  }

  function countMastered(ids, progress) {
    var n = 0;
    ids.forEach(function (id) { if (isMastered(progress[id])) n++; });
    return n;
  }

  return {
    GROUP: GROUP, blank: blank, answer: answer, isMastered: isMastered, isMissed: isMissed, isNew: isNew,
    isTryAgain: isTryAgain, isDue: isDue, group: group, order: order, accuracy: accuracy, countMastered: countMastered
  };
});
