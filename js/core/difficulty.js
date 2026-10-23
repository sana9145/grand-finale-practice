/* Portable difficulty formula for new words, and difficulty -> level. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.difficulty = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.difficulty;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function silent() { return GF.silentRules || (typeof require === 'function' ? require('./silent-rules.js') : null); }

  var ENDINGS = ['tion', 'sion', 'cian', 'ous', 'ture', 'sure', 'able', 'ible', 'ary', 'ery', 'ory', 'ance', 'ence', 'le', 'el', 'al'];
  var VOWEL_TEAMS = /ai|ay|ea|ee|ei|ey|ie|oa|oe|oi|oo|ou|ow|oy|ue|ui|au|aw|ew/g;

  // Raw score (useful for tests), then the 1-5 mapping.
  function score(word, rules, exceptions) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    var s = 0;
    if (/([a-z])\1/.test(w)) s += 2;
    var sr = silent();
    if (sr && sr.suggest(w, rules, exceptions).length) s += 2;
    if (ENDINGS.some(function (e) { return w.length > e.length && w.slice(-e.length) === e; })) s += 1.5;
    if (/ph|qu|x/.test(w)) s += 1.2;
    if (/[cg][eiy]/.test(w)) s += 0.8;
    if (w.indexOf('y', 1) > 0) s += 1;
    var teams = (w.match(VOWEL_TEAMS) || []).length;
    s += Math.min(1.5, teams * 0.5);
    if (w.length > 6) s += Math.min(2, (w.length - 6) * 0.35);
    return s;
  }

  function fromScore(s) {
    if (s < 2) return 1;
    if (s < 3.5) return 2;
    if (s < 5) return 3;
    if (s < 6.5) return 4;
    return 5;
  }

  function estimate(word, rules, exceptions) { return fromScore(score(word, rules, exceptions)); }

  // levels = finale_format.round2.levels
  function levelFor(difficulty, levels) {
    var d = Number(difficulty);
    for (var i = 0; i < (levels || []).length; i++) {
      if ((levels[i].difficulty || []).indexOf(d) >= 0) return levels[i].id;
    }
    return d <= 1 ? 'easy' : d === 2 ? 'medium' : 'hard';
  }

  return { score: score, fromScore: fromScore, estimate: estimate, levelFor: levelFor };
});
