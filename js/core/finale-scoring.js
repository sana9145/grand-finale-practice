/* Grand-final scoring and word drawing for the Mock Final, all from finale_format. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.finale = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.finale;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function dep(name, file) { return GF[name] || require(file); }

  // round: 1 | 2; choice: theme id (round 1) or level id (round 2)
  function points(format, round, choice, right) {
    if (round === 1) return right ? format.round1.points_right : format.round1.points_wrong;
    var lvl = format.round2.levels.filter(function (l) { return l.id === choice; })[0];
    if (!lvl) throw new Error('Unknown level ' + choice);
    return right ? lvl.points_right : format.round2.points_wrong;
  }

  // entries: [{choice, right}] (right null = not answered yet)
  function roundScore(format, round, entries) {
    return (entries || []).reduce(function (sum, e) {
      return e.right === true || e.right === false ? sum + points(format, round, e.choice, e.right) : sum;
    }, 0);
  }

  function score(format, r1, r2) {
    var a = roundScore(format, 1, r1), b = roundScore(format, 2, r2);
    return { r1: a, r2: b, total: a + b };
  }

  // Replay one 2025 finalist with their recorded right/wrong.
  function replay(format, f) {
    var r1 = roundScore(format, 1, (f.round1 || []).map(function (x) { return { choice: x.theme, right: x.right }; }));
    // A word that wasn't heard in the recording: trust the stored round-1 score.
    if ((f.round1 || []).length < format.round1.words && typeof f.round1_score === 'number') r1 = f.round1_score;
    var r2 = f.round2 ? roundScore(format, 2, f.round2.map(function (x) { return { choice: x.level, right: x.right }; })) : 0;
    return { r1: r1, r2: f.round2 ? r2 : null, total: r1 + r2 };
  }

  // Weighted tier pick: easy 40%, medium 40%, hard 20%, skipping tiers with no words.
  var WEIGHTS = { easy: 40, medium: 40, hard: 20 };
  function pickTier(rand, tiers) {
    var list = tiers.filter(function (t) { return WEIGHTS[t]; });
    if (!list.length) return null;
    var total = list.reduce(function (s, t) { return s + WEIGHTS[t]; }, 0);
    var x = rand() * total;
    for (var i = 0; i < list.length; i++) { x -= WEIGHTS[list[i]]; if (x < 0) return list[i]; }
    return list[list.length - 1];
  }

  // Choose one word from a pool: no repeats in this mock, avoid recent mocks unless the pool is
  // too small, unmastered first, then spaced-repetition order; when exhausted, least recently seen.
  function drawFrom(pool, ctx) {
    var util = dep('util', './util.js'), S = dep('scheduler', './scheduler.js');
    var used = ctx.used || [], recent = ctx.recent || [], progress = ctx.progress || {};
    var notUsed = pool.filter(function (id) { return used.indexOf(id) < 0; });
    var fresh = notUsed.filter(function (id) { return recent.indexOf(id) < 0; });
    var cands = fresh.length ? fresh : notUsed;
    if (cands.length) {
      var ordered = S.order(cands, progress, ctx.today, ctx.rand);
      var un = ordered.filter(function (id) { return !S.isMastered(progress[id]); });
      var ma = ordered.filter(function (id) { return S.isMastered(progress[id]); });
      return un.concat(ma)[0];
    }
    if (!pool.length) return null;
    var byOld = util.shuffle(pool, ctx.rand).sort(function (a, b) { return ((progress[a] || {}).lastSeen || 0) - ((progress[b] || {}).lastSeen || 0); });
    return byOld[0];
  }

  // ctx: {words, bank, plan, mockUses:'plan'|'all', mockR2, progress, today, rand, used, recent}
  function drawRound1(theme, ctx) {
    var P = dep('plan', './plan.js');
    var plan = P.normalize(ctx.plan, ctx.bank);
    var tiers = ctx.mockUses === 'all' || !plan[theme] || !plan[theme].length ? P.TIERS.slice() : plan[theme].slice();
    var pools = {};
    tiers.forEach(function (t) { pools[t] = P.themePool(ctx.words, ctx.bank, theme, t); });
    var avail = tiers.filter(function (t) { return pools[t].length; });
    // Prefer tiers that still have words not used in this mock.
    var withFresh = avail.filter(function (t) { return pools[t].some(function (id) { return (ctx.used || []).indexOf(id) < 0; }); });
    var tier = pickTier(ctx.rand, withFresh.length ? withFresh : avail);
    if (!tier) return null;
    return { id: drawFrom(pools[tier], ctx), tier: tier };
  }

  // Round-2 pool for one level. ctx.mockR2:
  //   'focus'    the plan's round-2 words (focus words unless the plan says otherwise)
  //   'focus911' those plus the plan's 9-11 words of this level (default)
  //   'all'      every 6-8 word of the level plus every 9-11 word of the level
  // Extreme words stay out unless the plan's 9-11 row includes them.
  function round2MockPool(level, ctx) {
    var P = dep('plan', './plan.js'), util = dep('util', './util.js');
    var plan = P.normalize(ctx.plan, ctx.bank);
    var uses = ctx.mockR2 || 'focus911';
    var focus = ctx.mockUses === 'all' || uses === 'all' ? false : plan.round2.focus_only;
    var pool = P.round2Pool(ctx.words, ctx.bank, level, focus);
    if (uses !== 'focus') {
      var extremeOk = !ctx.bank.finale_format.round2.exclude_extreme_unless_planned || plan.list_9_11.indexOf('extreme') >= 0;
      var bands = uses === 'all' ? P.BANDS.filter(function (b) { return b !== 'extreme' || extremeOk; }) : plan.list_9_11;
      pool = util.uniq(pool.concat(P.band911Level(ctx.words, ctx.bank, level, bands)));
    }
    if (!pool.length) pool = P.round2Pool(ctx.words, ctx.bank, level, false);
    return pool;
  }

  function drawRound2(level, ctx) {
    return { id: drawFrom(round2MockPool(level, ctx), ctx), tier: level };
  }

  // Ids used in the last n mocks.
  function recentIds(history, n) {
    var out = [];
    (history || []).slice(-n).forEach(function (m) {
      (m.round1 || []).concat(m.round2 || []).forEach(function (e) { if (e.id) out.push(e.id); });
    });
    return out;
  }

  // Which 2025 places a total reaches.
  function placesBeaten(format, total) {
    return (format.results_2025 || []).filter(function (r) { return total >= r.total; });
  }

  return {
    points: points, roundScore: roundScore, score: score, replay: replay, pickTier: pickTier, WEIGHTS: WEIGHTS,
    drawFrom: drawFrom, drawRound1: drawRound1, drawRound2: drawRound2, round2MockPool: round2MockPool, recentIds: recentIds, placesBeaten: placesBeaten
  };
});
