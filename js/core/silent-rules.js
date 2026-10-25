/* Suggests silent letters for a word from the data's rules, and finds where they are
   so the reveal can highlight them. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.silentRules = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.silentRules;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function norm(word) { return String(word || '').toLowerCase().replace(/[ -]/g, ''); }

  function compile(rules) {
    return (rules || []).map(function (r) {
      try { return { re: new RegExp(r.pattern), src: r.pattern, letter: r.letter }; }
      catch (e) { return null; }
    }).filter(Boolean);
  }

  function isException(w, exceptions) {
    return (exceptions || []).some(function (x) {
      return typeof x === 'string' ? norm(x) === w : (x && x.pattern ? new RegExp(x.pattern).test(w) : false);
    });
  }

  // -> ["k"] etc. Empty for exception words.
  function suggest(word, rules, exceptions) {
    var w = norm(word);
    if (!w || isException(w, exceptions)) return [];
    var out = [];
    compile(rules).forEach(function (r) {
      if (r.re.test(w) && out.indexOf(r.letter) < 0) out.push(r.letter);
    });
    return out;
  }

  // Pattern id for the first suggested letter, from silent_patterns[].letters.
  function suggestPattern(letters, patterns) {
    for (var i = 0; i < (letters || []).length; i++) {
      for (var j = 0; j < (patterns || []).length; j++) {
        if ((patterns[j].letters || []).indexOf(letters[i]) >= 0) return patterns[j].id;
      }
    }
    return null;
  }

  // Where are the silent letters? Returns {indexes:[...] (into the word without spaces/hyphens), chunk:"kn"|null}
  // for each letter string in silentLetters.
  function locate(word, silentLetters, rules) {
    var w = norm(word);
    var res = [];
    var compiled = compile(rules);
    (silentLetters || []).forEach(function (L) {
      L = String(L).toLowerCase();
      var found = null;
      for (var i = 0; i < compiled.length && !found; i++) {
        var r = compiled[i];
        if (r.letter !== L) continue;
        var g = new RegExp(r.src, 'g'), m;
        while ((m = g.exec(w)) && !found) {
          var k = m[0].indexOf(L);
          if (k >= 0) found = { start: m.index + k, chunk: m[0] };
          if (m[0].length === 0) g.lastIndex++;
        }
      }
      if (!found) {
        // A silent e or a sits near the end ("breathe", "logically"); any other letter: the first one.
        var at = L === 'e' || L === 'a' ? w.lastIndexOf(L) : w.indexOf(L);
        if (at >= 0) found = { start: at, chunk: null };
      }
      if (found) {
        var idx = [];
        for (var q = 0; q < L.length; q++) idx.push(found.start + q);
        res.push({ letter: L, indexes: idx, chunk: found.chunk });
      }
    });
    return res;
  }

  // "The k is silent (kn)" / "The g and h are silent (igh)".
  function describe(located) {
    return located.map(function (x) {
      var letters = x.letter.split('');
      var subject = letters.length > 1 ? 'The ' + letters.join(' and ') + ' are silent' : 'The ' + x.letter + ' is silent';
      var chunk = x.chunk && x.chunk.length > 1 && x.chunk.length <= 6 ? ' (' + x.chunk + ')' : '';
      return subject + chunk;
    });
  }

  return { suggest: suggest, suggestPattern: suggestPattern, locate: locate, describe: describe, norm: norm };
});
