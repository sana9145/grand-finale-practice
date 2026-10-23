/* Word pools and the study plan. No DOM.
   plan = {geography:[tiers], animals:[tiers], silent_letter:[tiers], round2:{levels:[...], focus_only:bool},
           list_9_11:[bands]}   (bands: easy, medium, hard, extreme) */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.plan = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.plan;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function util() { return GF.util || require('./util.js'); }
  function sched() { return GF.scheduler || require('./scheduler.js'); }

  var TIERS = ['easy', 'medium', 'hard'];
  var BANDS = ['easy', 'medium', 'hard', 'extreme'];
  var LIST_911 = 'official_2026_9_11';
  var DEFAULT_BANDS = ['easy', 'medium', 'hard'];

  function themeIds(bank) { return bank.finale_format.round1.themes.map(function (t) { return t.id; }); }
  function levelIds(bank) { return bank.finale_format.round2.levels.map(function (l) { return l.id; }); }
  // The streams Today's practice takes new words from, in round-robin order.
  function streamKeys(bank) { return themeIds(bank).concat(['round2', 'list_9_11']); }

  function defaultPlan(bank) {
    var d = bank.study_plan_default || {};
    var p = {};
    themeIds(bank).forEach(function (t) { p[t] = (d[t] || ['easy', 'medium']).slice(); });
    var r2 = d.round2 || {};
    p.round2 = { levels: (r2.levels || levelIds(bank)).slice(), focus_only: r2.focus_only !== false };
    p.list_9_11 = (Array.isArray(d.list_9_11) ? d.list_9_11 : DEFAULT_BANDS).slice();
    return p;
  }

  function normalize(plan, bank) {
    var def = defaultPlan(bank);
    if (!plan || typeof plan !== 'object') return def;
    var p = {};
    themeIds(bank).forEach(function (t) {
      p[t] = Array.isArray(plan[t]) ? TIERS.filter(function (x) { return plan[t].indexOf(x) >= 0; }) : def[t];
    });
    var r2 = plan.round2 && typeof plan.round2 === 'object' ? plan.round2 : def.round2;
    p.round2 = {
      levels: Array.isArray(r2.levels) ? levelIds(bank).filter(function (x) { return r2.levels.indexOf(x) >= 0; }) : def.round2.levels,
      focus_only: r2.focus_only !== false
    };
    p.list_9_11 = Array.isArray(plan.list_9_11) ? BANDS.filter(function (b) { return plan.list_9_11.indexOf(b) >= 0; }) : def.list_9_11;
    return p;
  }

  function hasSource(w, sources) {
    for (var i = 0; i < (w.sources || []).length; i++) if (sources.indexOf(w.sources[i]) >= 0) return true;
    return false;
  }

  function on911(w) { return (w.sources || []).indexOf(LIST_911) >= 0; }
  // On the 9-11 list and not a 6-8 word (not on the 6-8 list, not asked in 2025).
  function only911(w) { return on911(w) && !hasSource(w, ['official_2026', 'asked_2025']); }

  function live(words) { return words.filter(function (w) { return !w.hidden; }); }

  // tier: easy | medium | hard | all. Extreme words are never in a theme pool.
  function themePool(words, bank, theme, tier) {
    var src = bank.finale_format.round1.pool_sources;
    return live(words).filter(function (w) {
      return !w.extreme && (w.themes || []).indexOf(theme) >= 0 && (tier === 'all' || (w.theme_tier || {})[theme] === tier) && hasSource(w, src);
    }).map(function (w) { return w.id; });
  }

  function patternPool(words, bank, pattern) {
    var src = bank.finale_format.round1.pool_sources;
    return live(words).filter(function (w) {
      return !w.extreme && (w.themes || []).indexOf('silent_letter') >= 0 && w.silent_pattern === pattern && hasSource(w, src);
    }).map(function (w) { return w.id; });
  }

  // Round-2 words of the 6-8 competition (focus words, or every 6-8 word of the level).
  // Words only on the 9-11 list come in through band pools instead.
  function round2Pool(words, bank, level, focusOnly) {
    var src = bank.finale_format.round2.pool_sources;
    return live(words).filter(function (w) {
      return w.level === level && (!focusOnly || w.round2_focus) && hasSource(w, src) && !only911(w);
    }).map(function (w) { return w.id; });
  }

  // Every word on the 9-11 list in one band.
  function bandPool(words, bank, band) {
    return live(words).filter(function (w) { return on911(w) && w.band_9_11 === band; }).map(function (w) { return w.id; });
  }

  // 9-11 words of one round-2 level, from the given bands only.
  function band911Level(words, bank, level, bands) {
    return live(words).filter(function (w) {
      return on911(w) && w.level === level && (bands || []).indexOf(w.band_9_11) >= 0;
    }).map(function (w) { return w.id; });
  }

  // Each stream is a list of pools in plan order (easy -> medium -> hard [-> extreme]).
  function streams(words, bank, plan) {
    var p = normalize(plan, bank);
    var out = {};
    themeIds(bank).forEach(function (t) {
      out[t] = TIERS.filter(function (x) { return p[t].indexOf(x) >= 0; }).map(function (x) { return themePool(words, bank, t, x); });
    });
    out.round2 = levelIds(bank).filter(function (l) { return p.round2.levels.indexOf(l) >= 0; })
      .map(function (l) { return round2Pool(words, bank, l, p.round2.focus_only); });
    out.list_9_11 = BANDS.filter(function (b) { return p.list_9_11.indexOf(b) >= 0; }).map(function (b) { return bandPool(words, bank, b); });
    return out;
  }

  function planIds(words, bank, plan) {
    var s = streams(words, bank, plan);
    var all = [];
    Object.keys(s).forEach(function (k) { s[k].forEach(function (pool) { all = all.concat(pool); }); });
    return util().uniq(all);
  }

  function stats(words, bank, plan, progress) {
    var ids = planIds(words, bank, plan);
    return { total: ids.length, mastered: sched().countMastered(ids, progress || {}) };
  }

  // "Make it fit": a suggestion that unticks hard tiers, one at a time, until the plan has at most
  // `target` words. Never applied by itself. -> {plan, size, steps:[{row, tier}], fits}
  function fitPlan(words, bank, plan, target) {
    var p = util().clone(normalize(plan, bank));
    var size = planIds(words, bank, p).length;
    var steps = [];
    var order = [['list_9_11', 'extreme'], ['list_9_11', 'hard']].concat(themeIds(bank).map(function (t) { return [t, 'hard']; }));
    for (var i = 0; i < order.length && size > target; i++) {
      var row = order[i][0], tier = order[i][1];
      if (p[row].indexOf(tier) < 0) continue;
      p[row] = p[row].filter(function (x) { return x !== tier; });
      size = planIds(words, bank, p).length;
      steps.push({ row: row, tier: tier });
    }
    return { plan: p, size: size, steps: steps, fits: size <= target };
  }

  return {
    TIERS: TIERS, BANDS: BANDS, themeIds: themeIds, levelIds: levelIds, streamKeys: streamKeys, defaultPlan: defaultPlan,
    normalize: normalize, hasSource: hasSource, on911: on911, only911: only911, themePool: themePool, patternPool: patternPool,
    round2Pool: round2Pool, bandPool: bandPool, band911Level: band911Level, streams: streams, planIds: planIds, stats: stats, fitPlan: fitPlan
  };
});
