/* Word bank export in the words.json and words.csv formats. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.exporter = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.exporter;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function dep(name, file) { return GF[name] || require(file); }

  var CSV_COLUMNS = ['word', 'display', 'letter', 'pos', 'meaning', 'sentence', 'sources', 'text_source', 'difficulty', 'level',
    'round2_focus', 'band_9_11', 'extreme', 'in_az', 'themes', 'theme_tier', 'silent_letters', 'silent_pattern', 'sound_alike_with',
    'spelling_note', 'final_2025', 'needs_review', 'say_as', 'notes'];

  // Words to export: everything except hidden words (2025-final words are always kept).
  function exportable(words) {
    return words.filter(function (w) { return !w.hidden || w.final_2025; });
  }

  function bankJSON(bank, words, today) {
    var O = dep('overlay', './overlay.js'), D = dep('difficulty', './difficulty.js');
    var out = {};
    Object.keys(bank).forEach(function (k) { if (k !== 'words') out[k] = bank[k]; });
    out.generated = today || out.generated;
    out.words = exportable(words).map(function (w) {
      var r = O.strip(w);
      r.level = D.levelFor(r.difficulty, bank.finale_format.round2.levels);
      return r;
    }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return out;
  }

  function f2025(x) {
    if (!x) return '';
    return 'round ' + x.round + ' ' + (x.round === 1 ? x.theme : x.level) + (x.finalist_right === false ? ' (missed)' : '');
  }

  function bankCSV(words) {
    var rows = [CSV_COLUMNS];
    exportable(words).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (w) {
      rows.push([
        w.word, w.display, w.letter || '', w.pos, w.meaning, w.sentence, (w.sources || []).join(';'), w.text_source, w.difficulty, w.level,
        w.round2_focus ? 'yes' : '', w.band_9_11 || '', w.extreme ? 'yes' : '', w.in_az ? 'yes' : '', (w.themes || []).join(';'),
        (w.themes || []).map(function (t) { return t + ':' + (w.theme_tier || {})[t]; }).join(';'),
        (w.silent_letters || []).join(';'), w.silent_pattern || '', (w.sound_alike_with || []).join(';'),
        w.spelling_note || '', f2025(w.final_2025), w.needs_review ? 'yes' : '', w.say_as || '', w.notes || ''
      ]);
    });
    return '﻿' + dep('csv', './csv.js').stringify(rows);
  }

  return { CSV_COLUMNS: CSV_COLUMNS, bankJSON: bankJSON, bankCSV: bankCSV, exportable: exportable };
});
