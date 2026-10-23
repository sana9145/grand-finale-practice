/* The parent's word changes, kept apart from the read-only base bank.
   overlay = {added:[records], edited:{id:record}, hidden:[ids]}. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.overlay = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.overlay;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function util() { return GF.util || require('./util.js'); }
  function difficulty() { return GF.difficulty || require('./difficulty.js'); }

  var FIELDS = ['id', 'word', 'display', 'letter', 'pos', 'meaning', 'sentence', 'say_as', 'sources', 'text_source', 'page',
    'difficulty', 'level', 'round2_focus', 'band_9_11', 'extreme', 'in_az', 'themes', 'theme_tier', 'silent_letters', 'silent_pattern',
    'sound_alike_with', 'spelling_note', 'final_2025', 'needs_review', 'notes'];

  var LIST_68 = 'official_2026', LIST_911 = 'official_2026_9_11';
  var BANDS = ['easy', 'medium', 'hard', 'extreme'];
  // A 9-11 word added without a band gets one from its difficulty (never "extreme" by guess).
  function bandFor(difficulty) { return difficulty <= 1 ? 'easy' : difficulty === 2 ? 'medium' : 'hard'; }

  function empty() { return { added: [], edited: {}, hidden: [] }; }

  function normalizeOverlay(o) {
    o = o && typeof o === 'object' ? o : {};
    return {
      added: Array.isArray(o.added) ? o.added.filter(function (r) { return r && r.id; }) : [],
      edited: o.edited && typeof o.edited === 'object' && !Array.isArray(o.edited) ? o.edited : {},
      hidden: Array.isArray(o.hidden) ? o.hidden.filter(function (x) { return typeof x === 'string'; }) : []
    };
  }

  // Fill in every field so the rest of the app can rely on them.
  function complete(rec, levels) {
    var u = util();
    var r = {};
    FIELDS.forEach(function (f) { if (rec[f] !== undefined) r[f] = rec[f]; });
    r.word = String(r.word || '').toLowerCase();
    r.id = r.id || u.idOf(r.word);
    r.display = r.display || r.word;
    r.pos = r.pos || '';
    r.meaning = r.meaning || '';
    r.sentence = r.sentence || '';
    r.say_as = r.say_as || '';
    r.sources = Array.isArray(r.sources) && r.sources.length ? r.sources.slice() : ['added'];
    r.text_source = r.text_source || 'added_by_parent';
    if (r.page === undefined) r.page = null;
    var d = parseInt(r.difficulty, 10);
    r.difficulty = d >= 1 && d <= 5 ? d : 2;
    r.level = difficulty().levelFor(r.difficulty, levels);
    r.round2_focus = !!r.round2_focus;
    r.themes = Array.isArray(r.themes) ? r.themes.slice() : [];
    r.theme_tier = r.theme_tier && typeof r.theme_tier === 'object' ? Object.assign({}, r.theme_tier) : {};
    r.silent_letters = Array.isArray(r.silent_letters) ? r.silent_letters.slice() : [];
    r.silent_pattern = r.silent_pattern || null;
    r.sound_alike_with = Array.isArray(r.sound_alike_with) ? r.sound_alike_with.slice() : [];
    if (r.final_2025 === undefined) r.final_2025 = null;
    r.needs_review = !!r.needs_review;
    r.notes = r.notes || '';
    r.spelling_note = r.spelling_note || '';
    // The 9-11 list and the A-Z tab follow from the sources.
    r.band_9_11 = r.sources.indexOf(LIST_911) >= 0 ? (BANDS.indexOf(r.band_9_11) >= 0 ? r.band_9_11 : bandFor(r.difficulty)) : null;
    r.extreme = r.band_9_11 === 'extreme';
    r.in_az = r.sources.indexOf(LIST_68) >= 0 || r.sources.indexOf(LIST_911) >= 0;
    r.letter = /^[a-z]/.test(r.word) ? r.word.charAt(0).toUpperCase() : null;
    return r;
  }

  // Which official list a word is on comes from the base list, never from an edit.
  function listFields(base) { return { sources: base.sources, band_9_11: base.band_9_11 }; }

  // -> {words:[...], byId:{}, orphans:[ids]}. Each word gets origin: base | edited | added, and hidden: bool.
  function merge(baseWords, overlay, levels) {
    var o = normalizeOverlay(overlay);
    var hidden = {};
    o.hidden.forEach(function (id) { hidden[id] = true; });
    var byId = {}, list = [], orphans = [];
    (baseWords || []).forEach(function (w) {
      var rec, origin = 'base';
      if (o.edited[w.id]) { rec = complete(Object.assign({}, w, o.edited[w.id], { id: w.id }, listFields(w)), levels); origin = 'edited'; }
      else rec = w;
      var m = Object.assign({}, rec, { origin: origin, hidden: !!hidden[w.id] });
      byId[w.id] = m; list.push(m);
    });
    var extra = o.added.slice();
    Object.keys(o.edited).forEach(function (id) {
      if (!byId[id]) { orphans.push(id); extra.push(Object.assign({}, o.edited[id], { id: id })); }
    });
    extra.forEach(function (a) {
      var rec = complete(a, levels);
      if (byId[rec.id]) {
        // An added word that now exists in the base acts as an edit of it.
        var m0 = Object.assign({}, complete(Object.assign({}, byId[rec.id], rec, listFields(byId[rec.id])), levels), { origin: 'edited', hidden: !!hidden[rec.id] });
        list[list.indexOf(byId[rec.id])] = m0; byId[rec.id] = m0;
        return;
      }
      if (rec.sources.indexOf('added') < 0) rec.sources.push('added');
      var m = Object.assign(rec, { origin: 'added', hidden: !!hidden[rec.id] });
      byId[rec.id] = m; list.push(m);
    });
    return { words: list, byId: byId, orphans: orphans };
  }

  function strip(w) {
    var r = {};
    FIELDS.forEach(function (f) { if (w[f] !== undefined) r[f] = w[f]; });
    return r;
  }

  // Orphaned edits become added words for good (called once after load).
  function adoptOrphans(baseWords, overlay) {
    var o = normalizeOverlay(overlay);
    var base = {};
    (baseWords || []).forEach(function (w) { base[w.id] = true; });
    Object.keys(o.edited).forEach(function (id) {
      if (!base[id]) {
        var rec = Object.assign({}, o.edited[id], { id: id });
        rec.sources = (rec.sources || []).filter(function (s) { return s !== 'added'; }).concat(['added']);
        if (!o.added.some(function (a) { return a.id === id; })) o.added.push(rec);
        delete o.edited[id];
      }
    });
    return o;
  }

  function saveWord(overlay, rec, isBase) {
    var o = normalizeOverlay(util().clone(overlay));
    var clean = strip(rec);
    if (isBase) o.edited[clean.id] = clean;
    else {
      var i = o.added.findIndex(function (a) { return a.id === clean.id; });
      if (i >= 0) o.added[i] = clean; else o.added.push(clean);
    }
    return o;
  }

  function revert(overlay, id) {
    var o = normalizeOverlay(util().clone(overlay));
    delete o.edited[id];
    return o;
  }

  function setHidden(overlay, id, on) {
    var o = normalizeOverlay(util().clone(overlay));
    o.hidden = o.hidden.filter(function (x) { return x !== id; });
    if (on) o.hidden.push(id);
    return o;
  }

  function deleteAdded(overlay, id) {
    var o = normalizeOverlay(util().clone(overlay));
    o.added = o.added.filter(function (a) { return a.id !== id; });
    o.hidden = o.hidden.filter(function (x) { return x !== id; });
    return o;
  }

  return {
    FIELDS: FIELDS, BANDS: BANDS, LIST_68: LIST_68, LIST_911: LIST_911, bandFor: bandFor, empty: empty, normalize: normalizeOverlay, complete: complete, merge: merge, strip: strip,
    adoptOrphans: adoptOrphans, saveWord: saveWord, revert: revert, setHidden: setHidden, deleteAdded: deleteAdded
  };
});
