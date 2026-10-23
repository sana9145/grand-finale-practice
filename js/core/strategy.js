/* Strategy tips for the parent. No DOM.
   log = [{id, right, t}] (oldest first); byId = merged words. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.strategy = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.strategy;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var WINDOW = 30, MIN = 10;

  function lastN(log, test) {
    var out = [];
    for (var i = (log || []).length - 1; i >= 0 && out.length < WINDOW; i--) if (test(log[i])) out.push(log[i]);
    return out;
  }

  function acc(list) {
    if (!list.length) return null;
    return list.filter(function (e) { return e.right; }).length / list.length;
  }

  // -> {rows:[{theme, label, answers, accuracy, enough}], best: theme id | null}
  function themeTip(log, byId, themes) {
    var rows = themes.map(function (t) {
      var list = lastN(log, function (e) { var w = byId[e.id]; return !!w && (w.themes || []).indexOf(t.id) >= 0; });
      return { theme: t.id, label: t.label, emoji: t.emoji, answers: list.length, accuracy: acc(list), enough: list.length >= MIN };
    });
    var best = null;
    rows.forEach(function (r) { if (r.enough && (!best || r.accuracy > best.accuracy)) best = r; });
    return { rows: rows, best: best ? best.theme : null };
  }

  // Expected points per level = right% x points - wrong% x |points_wrong|.
  function expected(accuracy, pointsRight, pointsWrong) {
    return accuracy * pointsRight - (1 - accuracy) * Math.abs(pointsWrong);
  }

  function levelTip(log, byId, format) {
    var rows = format.round2.levels.map(function (l) {
      var list = lastN(log, function (e) { var w = byId[e.id]; return !!w && w.level === l.id; });
      var a = acc(list);
      return {
        level: l.id, label: l.label, points: l.points_right, answers: list.length, accuracy: a,
        enough: list.length >= MIN, expected: a == null ? null : expected(a, l.points_right, format.round2.points_wrong)
      };
    });
    var best = null;
    rows.forEach(function (r) { if (r.enough && (!best || r.expected > best.expected)) best = r; });
    return { rows: rows, best: best ? best.level : null };
  }

  function mostMissed(progress, byId, n) {
    return Object.keys(progress || {}).filter(function (id) { return byId[id] && progress[id].wrong > 0; })
      .sort(function (a, b) { return progress[b].wrong - progress[a].wrong || progress[b].lastSeen - progress[a].lastSeen; })
      .slice(0, n || 10)
      .map(function (id) { return { id: id, wrong: progress[id].wrong, right: progress[id].right }; });
  }

  return { themeTip: themeTip, levelTip: levelTip, expected: expected, mostMissed: mostMissed, WINDOW: WINDOW, MIN: MIN };
});
