/* Reads CSV, pasted text or JSON into word records, compares them with the bank,
   and applies the parent's choices to the overlay. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.importMerge = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.importMerge;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function dep(name, file) { return GF[name] || require(file); }
  var util = function () { return dep('util', './util.js'); };
  var csv = function () { return dep('csv', './csv.js'); };
  var overlayMod = function () { return dep('overlay', './overlay.js'); };
  var silent = function () { return dep('silentRules', './silent-rules.js'); };
  var diff = function () { return dep('difficulty', './difficulty.js'); };

  var TIERS = ['easy', 'medium', 'hard'];
  var BANDS = ['easy', 'medium', 'hard', 'extreme'];
  var LISTS = { '68': 'official_2026', '911': 'official_2026_9_11' };
  // A 9-11 band with no difficulty given: a difficulty that gives the matching round-2 level.
  var BAND_DIFFICULTY = { easy: 1, medium: 2, hard: 4, extreme: 5 };
  var COMPARE = ['display', 'pos', 'meaning', 'sentence', 'say_as', 'difficulty', 'round2_focus', 'themes',
    'theme_tier', 'silent_letters', 'silent_pattern', 'spelling_note', 'notes'];
  var WORD_RE = /^[a-z' -]{1,40}$/;

  function truthy(v) {
    if (typeof v === 'boolean') return v;
    return /^(true|yes|y|1|x|✓|on)$/i.test(String(v == null ? '' : v).trim());
  }

  function list(v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(v == null ? '' : v).split(/[;,|]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // ---------- reading the three input kinds -> raw rows ----------

  function fromCSV(text) {
    var t = csv().toObjects(text);
    if (!t.headers.length) return { rows: [], problems: [{ row: 1, word: '', reason: 'The file is empty.' }] };
    if (t.headers.indexOf('word') < 0) return { rows: [], problems: [{ row: 1, word: '', reason: 'There is no "word" column in the first row.' }] };
    return { rows: t.rows.map(function (o) { var r = Object.assign({}, o); r._kind = 'csv'; return r; }), problems: [] };
  }

  function fromText(text) {
    var rows = [];
    String(text || '').split(/\r?\n/).forEach(function (line, li) {
      line.split(',').forEach(function (w) {
        w = w.trim();
        if (w) rows.push({ word: w, _row: li + 1, _kind: 'text' });
      });
    });
    return { rows: rows, problems: [] };
  }

  function fromJSON(text) {
    var data;
    try { data = JSON.parse(String(text || '').replace(/^﻿/, '')); }
    catch (e) { return { rows: [], problems: [{ row: 1, word: '', reason: 'This is not valid JSON: ' + e.message }] }; }
    var arr = Array.isArray(data) ? data : data && Array.isArray(data.words) ? data.words : null;
    if (!arr) return { rows: [], problems: [{ row: 1, word: '', reason: 'Expected a words.json file or a list of word records.' }] };
    return {
      rows: arr.map(function (r, i) { var o = Object.assign({}, r || {}); o._row = i + 1; o._kind = 'json'; return o; }),
      problems: []
    };
  }

  function detect(text, fileName) {
    var n = String(fileName || '').toLowerCase();
    if (/\.json$/.test(n)) return 'json';
    if (/\.csv$/.test(n)) return 'csv';
    var t = String(text || '').replace(/^﻿/, '').trim();
    if (t.charAt(0) === '{' || t.charAt(0) === '[') return 'json';
    var first = t.split(/\r?\n/)[0].toLowerCase();
    if (/(^|,)\s*"?word"?\s*(,|$)/.test(first)) return 'csv';
    return 'text';
  }

  function read(text, kind) {
    kind = kind || detect(text);
    if (kind === 'csv') return fromCSV(text);
    if (kind === 'json') return fromJSON(text);
    return fromText(text);
  }

  // ---------- one raw row -> a clean record ----------

  // ctx: {bank (WORD_BANK meta), defaultTheme, defaultTier, defaultList ('' | '68' | '911'), defaultBand ('' = guess | band)}
  function normalize(raw, ctx) {
    var bank = ctx.bank;
    var themeIds = (bank.themes || []).map(function (t) { return t.id; });
    var themeByName = {};
    (bank.themes || []).forEach(function (t) {
      themeByName[t.id.toLowerCase()] = t.id;
      themeByName[t.label.toLowerCase()] = t.id;
      themeByName[t.id.replace(/_/g, ' ')] = t.id;
    });
    themeByName['silent letter'] = 'silent_letter';
    themeByName['silent'] = 'silent_letter';
    var patternIds = (bank.silent_patterns || []).map(function (p) { return p.id; });
    var levels = bank.finale_format && bank.finale_format.round2 && bank.finale_format.round2.levels;

    var typed = String(raw.word == null ? '' : raw.word).replace(/’/g, "'").replace(/\s+/g, ' ').trim();
    var word = typed.toLowerCase();
    var problem = function (reason) { return { problem: { row: raw._row, word: typed, reason: reason } }; };
    if (!word) return problem('The word is empty.');
    if (word.length > 40) return problem('The word is longer than 40 letters.');
    if (!WORD_RE.test(word)) return problem('Use only letters a-z, spaces, hyphens or apostrophes.');

    var given = [];
    var has = function (k) {
      var v = raw[k];
      if (v === undefined || v === null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return String(v).trim() !== '';
    };
    var rec = { word: word, id: util().idOf(word) };

    var display = has('display') ? String(raw.display).trim() : typed;
    if (display.toLowerCase() !== word) display = typed.toLowerCase() === word ? typed : word;
    rec.display = display;
    if (has('display') || typed !== word) given.push('display');

    ['pos', 'meaning', 'sentence', 'say_as', 'notes', 'spelling_note'].forEach(function (k) {
      rec[k] = has(k) ? String(raw[k]).trim() : '';
      if (has(k)) given.push(k);
    });
    if (rec.pos) rec.pos = rec.pos.toLowerCase();

    // themes + tiers
    var themes = [];
    var bad = null;
    list(raw.themes).forEach(function (t) {
      var id = themeByName[t.toLowerCase()];
      if (!id) bad = 'Unknown theme "' + t + '".';
      else if (themes.indexOf(id) < 0) themes.push(id);
    });
    if (bad) return problem(bad);
    var tiers = {};
    if (raw.theme_tier && typeof raw.theme_tier === 'object' && !Array.isArray(raw.theme_tier)) {
      Object.keys(raw.theme_tier).forEach(function (k) { tiers[k] = raw.theme_tier[k]; });
    } else {
      list(raw.theme_tier).forEach(function (pair) {
        var m = pair.split(':');
        if (m.length !== 2) { bad = 'theme_tier "' + pair + '" should look like geography:hard.'; return; }
        tiers[m[0].trim()] = m[1].trim();
      });
    }
    if (bad) return problem(bad);
    var tiers2 = {};
    Object.keys(tiers).forEach(function (k) {
      var id = themeByName[k.toLowerCase()];
      var tier = String(tiers[k]).toLowerCase();
      if (!id) bad = 'Unknown theme "' + k + '" in theme_tier.';
      else if (TIERS.indexOf(tier) < 0) bad = 'Tier for ' + k + ' must be easy, medium or hard.';
      else { tiers2[id] = tier; if (themes.indexOf(id) < 0) themes.push(id); }
    });
    if (bad) return problem(bad);
    rec._themeFromDefault = false;
    if (!themes.length && ctx.defaultTheme && themeIds.indexOf(ctx.defaultTheme) >= 0) {
      themes = [ctx.defaultTheme];
      rec._themeFromDefault = true;
    }
    rec._tierFilled = [];
    themes.forEach(function (t) {
      if (!tiers2[t]) {
        if (ctx.defaultTier && TIERS.indexOf(ctx.defaultTier) >= 0) { tiers2[t] = ctx.defaultTier; rec._tierFilled.push(t); }
        else bad = 'Pick a tier (easy, medium or hard) for ' + t + '.';
      }
    });
    if (bad) return problem(bad);
    rec.themes = themes;
    rec.theme_tier = tiers2;
    if (themes.length) given.push('themes', 'theme_tier');

    // which official list (for the A-Z tab) and the 9-11 band
    var lists = [];
    list(raw.sources).forEach(function (src) { if ((src === LISTS['68'] || src === LISTS['911']) && lists.indexOf(src) < 0) lists.push(src); });
    var band = has('band_9_11') ? String(raw.band_9_11).trim().toLowerCase() : '';
    if (band && BANDS.indexOf(band) < 0) return problem('band_9_11 must be easy, medium, hard or extreme.');
    if (band && lists.indexOf(LISTS['911']) < 0) lists.push(LISTS['911']);
    if (!lists.length && LISTS[ctx.defaultList]) lists.push(LISTS[ctx.defaultList]);
    if (!band && lists.indexOf(LISTS['911']) >= 0 && BANDS.indexOf(ctx.defaultBand) >= 0) band = ctx.defaultBand;
    rec._lists = lists;

    // difficulty
    if (has('difficulty')) {
      var d = Number(String(raw.difficulty).trim());
      if (!(d >= 1 && d <= 5 && Math.round(d) === d)) return problem('Difficulty must be a whole number from 1 to 5.');
      rec.difficulty = d; given.push('difficulty');
    } else if (band) {
      rec.difficulty = BAND_DIFFICULTY[band];
    } else {
      rec.difficulty = diff().estimate(word, bank.silent_letter_rules, bank.silent_letter_exceptions);
    }
    rec.level = diff().levelFor(rec.difficulty, levels);
    // A 9-11 word with no band: guessed from the difficulty (never "extreme" by guess).
    rec.band_9_11 = lists.indexOf(LISTS['911']) >= 0 ? (band || overlayMod().bandFor(rec.difficulty)) : null;

    if ('round2_focus' in raw && raw._kind !== 'text') { rec.round2_focus = truthy(raw.round2_focus); given.push('round2_focus'); }
    else rec.round2_focus = false;

    if (has('silent_letters')) { rec.silent_letters = list(raw.silent_letters).map(function (s) { return s.toLowerCase(); }); given.push('silent_letters'); }
    else rec.silent_letters = silent().suggest(word, bank.silent_letter_rules, bank.silent_letter_exceptions);

    if (has('silent_pattern')) {
      rec.silent_pattern = String(raw.silent_pattern).trim();
      if (patternIds.length && patternIds.indexOf(rec.silent_pattern) < 0) return problem('Unknown silent pattern "' + rec.silent_pattern + '".');
      given.push('silent_pattern');
    } else {
      rec.silent_pattern = themes.indexOf('silent_letter') >= 0 ? silent().suggestPattern(rec.silent_letters, bank.silent_patterns) : null;
    }
    if (themes.indexOf('silent_letter') >= 0 && !rec.silent_pattern) {
      return problem('Silent-letter words need a silent pattern (for example k, w, b, gh).');
    }

    rec.needs_review = !rec.meaning;
    rec._row = raw._row;
    rec._given = util().uniq(given);
    return { rec: rec };
  }

  // ---------- compare with the bank ----------

  function same(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) return (a || []).slice().sort().join('|') === (b || []).slice().sort().join('|');
    if ((a && typeof a === 'object') || (b && typeof b === 'object')) {
      var ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
      return ka.join('|') === kb.join('|') && ka.every(function (k) { return a[k] === b[k]; });
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
    return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  }

  // byId: merged bank (incl. hidden). -> {fresh:[], same:[], different:[], problems:[]}
  function preview(text, kind, ctx, byId) {
    var input = read(text, kind);
    var out = { kind: kind || detect(text), fresh: [], same: [], different: [], problems: input.problems.slice() };
    var seen = {};
    input.rows.forEach(function (raw) {
      var n = normalize(raw, ctx);
      if (n.problem) { out.problems.push(n.problem); return; }
      var rec = n.rec;
      if (seen[rec.id]) { out.problems.push({ row: rec._row, word: rec.word, reason: 'Same word as row ' + seen[rec.id] + '.' }); return; }
      seen[rec.id] = rec._row;
      var ex = byId[rec.id];
      if (!ex) { out.fresh.push(rec); return; }
      // Defaults add a theme; they don't take away themes the word already has.
      if (rec._themeFromDefault || rec._tierFilled.length) {
        var th = util().uniq((ex.themes || []).concat(rec.themes));
        var tt = Object.assign({}, rec.theme_tier, ex.theme_tier);
        Object.keys(rec.theme_tier).forEach(function (t) { if (rec._tierFilled.indexOf(t) < 0) tt[t] = rec.theme_tier[t]; });
        rec.themes = th; rec.theme_tier = tt;
        if (th.indexOf('silent_letter') >= 0 && !rec.silent_pattern) rec.silent_pattern = ex.silent_pattern || silent().suggestPattern(rec.silent_letters, ctx.bank.silent_patterns);
        if (rec._given.indexOf('silent_pattern') < 0 && rec.silent_pattern !== ex.silent_pattern && th.indexOf('silent_letter') >= 0) rec._given.push('silent_pattern');
      }
      var fields = rec._given.filter(function (f) { return COMPARE.indexOf(f) >= 0 && !same(rec[f], ex[f]); });
      // A word you added earlier can be put on an official list (and so into the A-Z tab).
      if (ex.origin === 'added' && rec._lists.some(function (l) { return (ex.sources || []).indexOf(l) < 0; })) fields.push('sources');
      if (!fields.length) out.same.push({ rec: rec, existing: ex });
      else out.different.push({ rec: rec, existing: ex, fields: fields, choice: 'mine' });
    });
    return out;
  }

  function setAll(pv, choice) { pv.different.forEach(function (d) { d.choice = choice; }); return pv; }

  // -> {overlay, summary:{added, updated, kept, skipped, problems}}
  function apply(overlay, pv, levels) {
    var O = overlayMod();
    var o = O.normalize(util().clone(overlay));
    var added = 0, updated = 0, kept = 0;
    pv.fresh.forEach(function (rec) {
      var r = O.strip(rec);
      r.sources = rec._lists.concat(['added']);
      r.text_source = 'added_by_parent';
      r.final_2025 = null;
      r.page = null;
      r.sound_alike_with = [];
      o.added = o.added.filter(function (a) { return a.id !== r.id; });
      o.added.push(O.complete(r, levels));
      added++;
    });
    pv.different.forEach(function (d) {
      if (d.choice !== 'imported') { kept++; return; }
      var ex = d.existing;
      var merged = O.strip(ex);
      d.rec._given.forEach(function (f) { if (COMPARE.indexOf(f) >= 0) merged[f] = util().clone(d.rec[f]); });
      if (d.rec._given.indexOf('themes') >= 0) { merged.themes = d.rec.themes.slice(); merged.theme_tier = Object.assign({}, d.rec.theme_tier); }
      if ((merged.themes || []).indexOf('silent_letter') >= 0 && !merged.silent_pattern) merged.silent_pattern = d.rec.silent_pattern;
      if (d.fields.indexOf('sources') >= 0) {
        merged.sources = util().uniq(d.rec._lists.concat(ex.sources || []));
        merged.band_9_11 = d.rec.band_9_11 || ex.band_9_11;
      }
      merged.needs_review = !merged.meaning;
      merged = O.complete(merged, levels);
      if (ex.origin === 'added') {
        o.added = o.added.map(function (a) { return a.id === merged.id ? merged : a; });
      } else {
        o.edited[merged.id] = merged;
      }
      o.hidden = o.hidden.filter(function (x) { return x !== merged.id; });
      updated++;
    });
    return {
      overlay: o,
      summary: { added: added, updated: updated, kept: kept, skipped: pv.same.length, problems: pv.problems.length }
    };
  }

  function countToImport(pv) {
    return pv.fresh.length + pv.different.filter(function (d) { return d.choice === 'imported'; }).length;
  }

  return {
    read: read, detect: detect, normalize: normalize, preview: preview, apply: apply, setAll: setAll,
    countToImport: countToImport, truthy: truthy, COMPARE: COMPARE
  };
});
