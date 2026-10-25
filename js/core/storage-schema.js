/* The saved-data shape, validation, safe load/save and backups. No DOM:
   pass in any object with getItem/setItem (localStorage in the app, a fake in tests). */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.storage = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.storage;
})(typeof window !== 'undefined' ? window : globalThis, function (GF) {
  'use strict';

  function dep(name, file) { return GF[name] || require(file); }

  var KEY = 'spellingWhizz.v1';
  var CORRUPT_PREFIX = 'spellingWhizz.corrupt.';

  function defaultSettings() {
    return {
      finalDate: null, dailyGoal: 40, judge: 'parent', timer: 'rules', timerCustom: 30, timeUp: 'show',
      mockUses: 'plan', mockR2: 'focus911', boardLength: 20, boardWrong: 'back', showText: true, soundAlike: true, zName: 'zed',
      voiceURI: null, rate: 0.85, pitch: 1, sfx: true, speech: 'auto', brainBreak: true, cheerVoice: true, themeBg: true
    };
  }

  function defaultAz() { return { filter: { list: 'both', extreme: true }, shuffle: false, w: {}, last: null }; }

  function normalizeAz(a) {
    var d = defaultAz();
    if (!isObj(a)) return d;
    var w = {};
    if (isObj(a.w)) Object.keys(a.w).forEach(function (id) { if (a.w[id] === 'd' || a.w[id] === 'n') w[id] = a.w[id]; });
    return {
      filter: dep('az', './az.js').normFilter(a.filter), shuffle: !!a.shuffle, w: w,
      last: isObj(a.last) && typeof a.last.letter === 'string' ? a.last : null
    };
  }

  function defaultState(now) {
    now = now || Date.now();
    return {
      schemaVersion: dep('migrations', './migrations.js').CURRENT,
      createdAt: now,
      profile: { name: 'Speller', avatar: '🦉', stickers: 0 },
      settings: defaultSettings(),
      plan: null,
      progress: {},
      log: [],
      activity: {},
      mockHistory: [],
      legacyHistory: [],
      overlay: { added: [], edited: {}, hidden: [] },
      az: defaultAz(),
      rewards: dep('stickers', './stickers.js').blank(),
      // The dress-up doll. Added without changing schemaVersion: older copies of the app ignore it.
      dress: dep('dress', './dress.js').blank(),
      backup: { lastAt: null, answersSince: 0, remindAfter: now },
      sessions: {},
      ui: { screen: 'home', params: {} }
    };
  }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  // -> list of problems (empty = fine)
  function validate(s) {
    var e = [];
    if (!isObj(s)) return ['not an object'];
    if (s.schemaVersion !== dep('migrations', './migrations.js').CURRENT) e.push('wrong schemaVersion');
    if (s.progress !== undefined && !isObj(s.progress)) e.push('progress is not an object');
    else if (s.progress) {
      Object.keys(s.progress).forEach(function (id) {
        var p = s.progress[id];
        if (!isObj(p) || typeof p.box !== 'number' || p.box < 0 || p.box > 5) e.push('bad progress for ' + id);
      });
    }
    if (s.mockHistory !== undefined && !Array.isArray(s.mockHistory)) e.push('mockHistory is not a list');
    if (s.overlay !== undefined && !isObj(s.overlay)) e.push('overlay is not an object');
    if (s.settings !== undefined && !isObj(s.settings)) e.push('settings is not an object');
    if (s.profile !== undefined && !isObj(s.profile)) e.push('profile is not an object');
    if (s.az !== undefined && s.az !== null && !isObj(s.az)) e.push('az is not an object');
    if (s.rewards !== undefined && s.rewards !== null && !isObj(s.rewards)) e.push('rewards is not an object');
    if (s.dress !== undefined && s.dress !== null && !isObj(s.dress)) e.push('dress is not an object');
    return e;
  }

  // Fill anything missing with defaults (after validate passed).
  function fill(s, now) {
    var d = defaultState(now);
    var out = Object.assign({}, d, s);
    out.profile = Object.assign({}, d.profile, isObj(s.profile) ? s.profile : {});
    out.settings = Object.assign({}, d.settings, isObj(s.settings) ? s.settings : {});
    out.backup = Object.assign({}, d.backup, isObj(s.backup) ? s.backup : {});
    out.overlay = dep('overlay', './overlay.js').normalize(s.overlay);
    out.progress = isObj(s.progress) ? s.progress : {};
    out.log = Array.isArray(s.log) ? s.log : [];
    out.activity = isObj(s.activity) ? s.activity : {};
    out.mockHistory = Array.isArray(s.mockHistory) ? s.mockHistory : [];
    out.legacyHistory = Array.isArray(s.legacyHistory) ? s.legacyHistory : [];
    out.az = normalizeAz(s.az);
    out.rewards = dep('stickers', './stickers.js').normalize(s.rewards);
    out.dress = dep('dress', './dress.js').normalize(s.dress);
    out.sessions = isObj(s.sessions) ? s.sessions : {};
    out.ui = isObj(s.ui) ? s.ui : d.ui;
    return out;
  }

  // -> {state, notice|null, fresh:bool, storageOk:bool, corruptKey|null}
  function load(storage, now) {
    now = now || Date.now();
    var raw;
    try { raw = storage.getItem(KEY); }
    catch (e) { return { state: defaultState(now), notice: 'This browser is not letting the app save. Progress will be lost when the page closes.', fresh: true, storageOk: false, corruptKey: null }; }
    if (raw == null) return { state: defaultState(now), notice: null, fresh: true, storageOk: true, corruptKey: null };
    var parsed, problem = null;
    try {
      parsed = dep('migrations', './migrations.js').migrate(JSON.parse(raw));
      var errs = validate(parsed);
      if (errs.length) problem = errs.join('; ');
    } catch (e) { problem = e.message; }
    if (!problem) return { state: fill(parsed, now), notice: null, fresh: false, storageOk: true, corruptKey: null };
    var corruptKey = CORRUPT_PREFIX + now;
    try { storage.setItem(corruptKey, raw); } catch (e) { corruptKey = null; }
    var fresh = defaultState(now);
    try { storage.setItem(KEY, JSON.stringify(fresh)); } catch (e) { /* ignore */ }
    return {
      state: fresh, fresh: true, storageOk: true, corruptKey: corruptKey,
      notice: 'The saved practice data could not be read, so the app has started fresh. ' +
        (corruptKey ? 'A copy of the old data was kept safely in this browser (' + corruptKey + '). ' : '') +
        'If you have a backup file, you can restore it in the Parent area.'
    };
  }

  function save(storage, state) {
    try { storage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  // ---- backups ----
  function makeBackup(state, now) {
    return {
      app: 'grandFinalePractice', backupVersion: 1, savedAt: new Date(now || Date.now()).toISOString(),
      schemaVersion: state.schemaVersion,
      settings: state.settings, plan: state.plan, profile: state.profile, progress: state.progress,
      mockHistory: state.mockHistory, overlay: state.overlay,
      log: state.log, activity: state.activity, legacyHistory: state.legacyHistory,
      az: state.az, rewards: state.rewards, dress: state.dress
    };
  }

  // -> {ok, error?, summary?, state?}
  function readBackup(text, now) {
    var b;
    try { b = JSON.parse(String(text || '').replace(/^﻿/, '')); }
    catch (e) { return { ok: false, error: 'This file is not a backup (it is not valid JSON).' }; }
    if (!isObj(b) || b.app !== 'grandFinalePractice') return { ok: false, error: 'This file is not a Grand Finale Practice backup.' };
    if (b.backupVersion !== 1) return { ok: false, error: 'This backup is from a different version (' + b.backupVersion + ').' };
    var s = {
      schemaVersion: typeof b.schemaVersion === 'number' ? b.schemaVersion : dep('migrations', './migrations.js').CURRENT,
      settings: b.settings, plan: b.plan, profile: b.profile, progress: b.progress || {},
      mockHistory: b.mockHistory || [], overlay: b.overlay, log: b.log, activity: b.activity, legacyHistory: b.legacyHistory
    };
    if (b.az !== undefined) s.az = b.az;
    if (b.rewards !== undefined) s.rewards = b.rewards;
    if (b.dress !== undefined) s.dress = b.dress;
    try { s = dep('migrations', './migrations.js').migrate(s); }
    catch (e) { return { ok: false, error: e.message }; }
    var errs = validate(s);
    if (errs.length) return { ok: false, error: 'The backup is damaged: ' + errs.slice(0, 3).join('; ') };
    var state = fill(s, now);
    state.sessions = {};
    state.ui = { screen: 'home', params: {} };
    var o = state.overlay;
    return {
      ok: true, state: state,
      summary: {
        savedAt: b.savedAt, name: state.profile.name, avatar: state.profile.avatar,
        words: Object.keys(state.progress).length, mocks: state.mockHistory.length,
        added: o.added.length, edited: Object.keys(o.edited).length, hidden: o.hidden.length,
        stickers: dep('stickers', './stickers.js').unique(state.rewards), azDone: Object.keys(state.az.w).filter(function (id) { return state.az.w[id] === 'd'; }).length,
        dressItems: dep('dress', './dress.js').counts(state.dress).owned
      }
    };
  }

  // Remind every 100 answers or 3 days.
  function needsBackupReminder(state, now) {
    var b = state.backup || {};
    if ((b.answersSince || 0) >= 100) return true;
    var since = typeof b.remindAfter === 'number' ? b.remindAfter : typeof b.lastAt === 'number' ? b.lastAt
      : typeof state.createdAt === 'number' ? state.createdAt : now;
    return (b.answersSince || 0) > 0 && now - since >= 3 * 86400000;
  }

  return {
    KEY: KEY, CORRUPT_PREFIX: CORRUPT_PREFIX, defaultSettings: defaultSettings, defaultState: defaultState, defaultAz: defaultAz, normalizeAz: normalizeAz,
    validate: validate, fill: fill, load: load, save: save, makeBackup: makeBackup, readBackup: readBackup,
    needsBackupReminder: needsBackupReminder
  };
});
