/* Saved-data migrations, keyed by schemaVersion. No DOM.
   To change the saved shape later: bump CURRENT and add table[old] = function (s) { ...; return s with schemaVersion old+1 }. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.migrations = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.migrations;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  var CURRENT = 2;

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function stickers() { return GF.stickers || require('./stickers.js'); }

  var table = {
    // v0: an early test build that kept the name and avatar at the top level.
    0: function (s) {
      var progress = {};
      Object.keys(s.progress || {}).forEach(function (id) {
        var p = s.progress[id] || {};
        progress[id] = {
          box: p.box || 0, seen: p.seen || (p.right || 0) + (p.wrong || 0), right: p.right || 0, wrong: p.wrong || 0,
          streak: p.streak || 0, lastSeen: p.lastSeen || 0, lastDay: p.lastDay || null,
          lastResult: p.lastResult || null, days: p.days || []
        };
      });
      return {
        schemaVersion: 1,
        profile: { name: s.name || s.playerName || 'Speller', avatar: s.avatar || '🦉', stickers: s.stickers || 0 },
        settings: s.settings || {},
        plan: s.plan || null,
        progress: progress,
        mockHistory: Array.isArray(s.mocks) ? s.mocks : [],
        overlay: s.overlay || { added: [], edited: {}, hidden: [] }
      };
    },

    // v1 -> v2 (the 9-11 list, A-Z, sticker book). Only ADDS fields: nothing that was saved changes.
    1: function (s) {
      var out = Object.assign({}, s, { schemaVersion: 2 });
      // A plan she already set up keeps every tick; it gains the 9-11 row with its default ticks.
      if (isObj(s.plan) && !Array.isArray(s.plan.list_9_11)) out.plan = Object.assign({}, s.plan, { list_9_11: ['easy', 'medium', 'hard'] });
      if (!isObj(s.az)) out.az = { filter: { list: 'both', extreme: true }, shuffle: false, w: {}, last: null };
      // Stickers she already earned move into the sticker book (profile.stickers keeps the same number).
      if (!isObj(s.rewards)) out.rewards = stickers().fromLegacy(isObj(s.profile) ? s.profile.stickers : 0);
      return out;
    }
  };

  function versionOf(s) {
    if (typeof s.schemaVersion === 'number') return s.schemaVersion;
    if (typeof s.version === 'number') return s.version;
    return 0;
  }

  function migrate(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Saved data is not an object.');
    var v = versionOf(s);
    if (v > CURRENT) throw new Error('Saved data is from a newer version (' + v + ').');
    var guard = 0;
    while (v < CURRENT) {
      if (!table[v]) throw new Error('No migration from version ' + v + '.');
      s = table[v](s);
      v = versionOf(s);
      if (++guard > 50) throw new Error('Migration loop.');
    }
    return s;
  }

  return { CURRENT: CURRENT, table: table, migrate: migrate, versionOf: versionOf };
});
