/* Today's practice: try-again words, then words due for review, then new plan words
   (round-robin across the three themes, round 2 and the 9-11 list), then everything else. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.today = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.today;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function dep(name, file) { return GF[name] || require(file); }

  // opts: {words, bank, plan, progress, today, seed}
  function buildQueue(opts) {
    var util = dep('util', './util.js'), P = dep('plan', './plan.js'), S = dep('scheduler', './scheduler.js');
    var rand = util.rng(opts.seed || 1);
    var progress = opts.progress || {};
    var ids = P.planIds(opts.words, opts.bank, opts.plan);
    var used = {};
    var take = function (list) { return list.filter(function (id) { if (used[id]) return false; used[id] = 1; return true; }); };

    var tryAgain = take(util.shuffle(ids.filter(function (id) { return S.isTryAgain(progress[id]); }), rand));
    var due = take(util.shuffle(ids.filter(function (id) { return S.isDue(progress[id], opts.today); }), rand));

    // New words: each stream lists its tiers in plan order (easy -> medium -> hard), shuffled within a tier.
    var streams = P.streams(opts.words, opts.bank, opts.plan);
    var keys = P.streamKeys(opts.bank);
    var lists = keys.map(function (k) {
      var flat = [];
      (streams[k] || []).forEach(function (pool) {
        flat = flat.concat(util.shuffle(pool.filter(function (id) { return S.isNew(progress[id]); }), rand));
      });
      return flat;
    });
    var fresh = [];
    var pos = lists.map(function () { return 0; });
    var more = true;
    while (more) {
      more = false;
      for (var k = 0; k < lists.length; k++) {
        while (pos[k] < lists[k].length) {
          var id = lists[k][pos[k]++];
          if (!used[id]) { used[id] = 1; fresh.push(id); more = true; break; }
        }
        if (pos[k] < lists[k].length) more = true;
      }
    }

    var rest = S.order(ids.filter(function (id) { return !used[id]; }), progress, opts.today, rand);
    return { queue: tryAgain.concat(due, fresh, rest), counts: { tryAgain: tryAgain.length, due: due.length, fresh: fresh.length, rest: rest.length } };
  }

  function isDone(count, goal) { return count >= goal; }

  return { buildQueue: buildQueue, isDone: isDone };
});
