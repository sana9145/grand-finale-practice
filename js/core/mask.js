/* Hides the answer word inside a meaning or sentence: "_____". No DOM.
   Masks the word, its common forms (plurals, -ed, -ing, -er, -est, -ly, y->ies/ied,
   dropped e, doubled consonant, f->ves), every part of a multi-word or hyphenated
   entry, longer words that contain it, and forms that share its start.
   Masking too much is fine; masking too little is not. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.mask = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.mask;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BLANK = '_____';
  var TOKEN = /[A-Za-zÀ-ɏ]+(?:['’][A-Za-zÀ-ɏ]+)*/g;

  function targetsFor(word) {
    var w = String(word || '').toLowerCase().trim();
    if (!w) return [];
    var parts = w.split(/[\s-]+/).map(function (p) { return p.replace(/['’]/g, ''); }).filter(Boolean);
    var joined = w.replace(/[\s'’-]/g, '');
    var out = parts.slice();
    if (out.indexOf(joined) < 0) out.push(joined);
    return out;
  }

  function stemsFor(t) {
    var s = [t];
    var n = t.length;
    if (n > 2 && /e$/.test(t)) s.push(t.slice(0, -1));                 // hope -> hop(ing), care -> car(ing)
    if (n > 2 && /ie$/.test(t)) s.push(t.slice(0, -2) + 'y');           // die -> dying
    if (n > 2 && /y$/.test(t)) s.push(t.slice(0, -1) + 'i');            // carry -> carri(ed/es)
    if (n > 2 && /fe$/.test(t)) s.push(t.slice(0, -2) + 'v');           // knife -> knives
    else if (n > 2 && /f$/.test(t)) s.push(t.slice(0, -1) + 'v');       // leaf -> leaves
    if (n > 2 && /ic$/.test(t)) s.push(t + 'k');                        // picnic -> picnicking
    return s;
  }

  function commonPrefix(a, b) {
    var i = 0;
    while (i < a.length && i < b.length && a.charAt(i) === b.charAt(i)) i++;
    return i;
  }

  function matcher(word) {
    var targets = targetsFor(word);
    var stems = [];
    targets.forEach(function (t) { stems = stems.concat(stemsFor(t)); });
    return function (token) {
      var tn = token.toLowerCase().replace(/['’]/g, '');
      if (!tn) return false;
      for (var i = 0; i < stems.length; i++) {
        if (stems[i] && tn.indexOf(stems[i]) === 0) return true;
      }
      for (var j = 0; j < targets.length; j++) {
        var t = targets[j];
        if (t.length >= 3 && tn.indexOf(t) >= 0) return true;              // toothbrush for brush
        if (t.length >= 4) {                                                // Africa for african
          var cp = commonPrefix(tn, t);
          if (cp >= 4 && cp >= Math.min(tn.length, t.length) - 2) return true;
        }
      }
      return false;
    };
  }

  function mask(text, word) {
    if (text == null) return '';
    text = String(text);
    if (!word) return text;
    var hit = matcher(word);
    var out = text.replace(TOKEN, function (tok) { return hit(tok) ? BLANK : tok; });
    // "Sri Lanka" -> one blank, so the masked text doesn't give away "two words".
    return out.replace(/_____(?:[\s-]+_____)+/g, BLANK);
  }

  // True if the text, once masked, still shows the word (used by tests and as a safety net).
  function leaks(text, word) {
    var targets = targetsFor(word);
    var toks = String(text || '').toLowerCase().match(/[a-z']+/g) || [];
    return toks.some(function (tk) {
      return targets.some(function (t) { return t && tk.replace(/'/g, '').indexOf(t) === 0; });
    });
  }

  return { mask: mask, leaks: leaks, BLANK: BLANK, targetsFor: targetsFor };
});
