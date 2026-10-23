/* Small shared helpers: seeded random numbers, dates, ids. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.util = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.util;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // mulberry32: small, fast, seedable.
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Local calendar day, e.g. "2026-10-20".
  function dayKey(d) {
    var x = d instanceof Date ? d : new Date(d == null ? Date.now() : d);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  function dayNumber(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }

  // Whole days from a to b (b - a).
  function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }

  function addDays(key, n) {
    var d = new Date(dayNumber(key) * 86400000 + n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  function idOf(word) { return String(word || '').toLowerCase().replace(/[ -]/g, ''); }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen['$' + arr[i]]) { seen['$' + arr[i]] = 1; out.push(arr[i]); }
    }
    return out;
  }

  return {
    rng: rng, hashSeed: hashSeed, shuffle: shuffle, dayKey: dayKey, daysBetween: daysBetween,
    addDays: addDays, clone: clone, idOf: idOf, isObj: isObj, uniq: uniq
  };
});
