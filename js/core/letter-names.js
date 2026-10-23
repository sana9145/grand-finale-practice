/* Letter names for "Spell it for me", and part-of-speech phrases. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.letterNames = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.letterNames;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var NAMES = {
    a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'jee', h: 'aitch', i: 'eye',
    j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar',
    s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zed'
  };

  // Returns the list of things to say, one per letter. zName: "zed" or "zee".
  function spellOut(word, zName) {
    var out = [];
    String(word || '').toLowerCase().split('').forEach(function (ch) {
      if (ch === ' ') out.push('space');
      else if (ch === '-') out.push('hyphen');
      else if (ch === "'" || ch === '’') out.push('apostrophe');
      else if (ch === 'z') out.push(zName === 'zee' ? 'zee' : 'zed');
      else if (NAMES[ch]) out.push(NAMES[ch]);
    });
    return out;
  }

  var POS_WORDS = {
    noun: 'a noun', verb: 'a verb', adjective: 'an adjective', adverb: 'an adverb',
    preposition: 'a preposition', pronoun: 'a pronoun', conjunction: 'a conjunction',
    determiner: 'a determiner', number: 'a number', interjection: 'an interjection'
  };

  function posPhrase(pos) {
    var parts = String(pos || '').split('/').map(function (p) { return p.trim().toLowerCase(); }).filter(Boolean);
    if (!parts.length) return 'Sorry, I do not know its part of speech.';
    var named = parts.map(function (p) { return POS_WORDS[p] || ('a ' + p); });
    if (named.length === 1) return 'It is ' + named[0] + '.';
    return 'It can be ' + named.slice(0, -1).join(', ') + ' or ' + named[named.length - 1] + '.';
  }

  return { NAMES: NAMES, spellOut: spellOut, posPhrase: posPhrase };
});
