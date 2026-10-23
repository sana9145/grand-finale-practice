/* App shell: saved state, the merged word list, routing, answer recording and undo. */
(function () {
  'use strict';
  var GF = window.GF, UI = window.UI, h = UI.h;

  var App = (window.App = {
    bank: window.WORD_BANK || null, state: null, words: [], byId: {}, parentUnlocked: false,
    notices: [], screens: {}, keyHandler: null, storage: null, storageOk: true, saveWarned: false
  });

  // ---------- storage (never throws) ----------
  function memoryStorage() {
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } };
  }
  function pickStorage() {
    try {
      var ls = window.localStorage;
      ls.getItem(GF.storage.KEY);
      return ls;
    } catch (e) { App.storageOk = false; return memoryStorage(); }
  }

  App.save = function () {
    var ok = GF.storage.save(App.storage, App.state);
    if (!ok && !App.saveWarned) {
      App.saveWarned = true;
      App.notice('The app could not save just now (the browser storage may be full or blocked). Please download a backup from the Parent area.');
    }
    return ok;
  };

  App.notice = function (msg) {
    if (App.notices.indexOf(msg) < 0) App.notices.push(msg);
    renderNotices();
  };

  // ---------- words ----------
  App.levels = function () { return App.bank.finale_format.round2.levels; };
  App.refreshWords = function () {
    var m = GF.overlay.merge(App.bank.words, App.state.overlay, App.levels());
    App.words = m.words;
    App.byId = m.byId;
  };
  App.word = function (id) { return App.byId[id]; };

  // ---------- dates ----------
  App.today = function () { return GF.util.dayKey(Date.now()); };
  App.finalDate = function () { return App.state.settings.finalDate || App.bank.finale_format.final_date; };
  App.daysToFinal = function () { return GF.util.daysBetween(App.today(), App.finalDate()); };
  App.plan = function () { return GF.plan.normalize(App.state.plan, App.bank); };

  App.streak = function () {
    var a = App.state.activity || {};
    var day = App.today();
    if (!(a[day] && a[day].all)) day = GF.util.addDays(day, -1);
    var n = 0;
    while (a[day] && a[day].all) { n++; day = GF.util.addDays(day, -1); }
    return n;
  };

  // ---------- routing ----------
  var PARENT_SCREENS = ['parent', 'plan', 'settings', 'editor', 'wordForm', 'import', 'backup', 'print', 'history', 'historyItem', 'strategy', 'reset'];
  // Screens where she is practising (brain breaks and reward pop-ups show here).
  var PLAY_SCREENS = ['today', 'board', 'azPlay', 'mock', 'legacy'];
  App.isPlayScreen = function (s) { return PLAY_SCREENS.indexOf(s) >= 0; };
  App.isParentScreen = function (s) { return PARENT_SCREENS.indexOf(s) >= 0; };

  App.go = function (screen, params, opts) {
    opts = opts || {};
    if (App.isParentScreen(screen) && !App.parentUnlocked) screen = 'home';
    if (screen === 'home') App.parentUnlocked = false;
    App.state.ui = { screen: screen, params: params || {} };
    App.save();
    App.render(opts);
    if (!opts.keepScroll) window.scrollTo(0, 0);
  };

  var current = null;
  App.render = function (opts) {
    opts = opts || {};
    var main = document.getElementById('app');
    if (current && current._cleanup) current._cleanup();
    UI.speech.stop();
    App.keyHandler = null;
    App.hiddenWord = null; // set again by a question card
    document.title = 'Grand Finale Practice';
    UI.clear(main);
    var ui = App.state.ui || { screen: 'home', params: {} };
    var fn = App.screens[ui.screen] || App.screens.home;
    var node = h('div.screen');
    main.appendChild(node);
    try { fn(node, ui.params || {}, opts); }
    catch (e) {
      UI.clear(node);
      node.appendChild(h('div.panel', h('h2', 'Oops, something went wrong on this screen.'),
        h('p', String(e && e.message || e)),
        h('button.btn.primary', { type: 'button', onclick: function () { App.go('home'); } }, '🏠 Go home')));
      if (window.console) console.error(e);
    }
    current = node;
    renderHeader();
    renderNotices();
    UI.guardWord(document.body);
    // Packs to open and brain breaks wait until no question is on screen.
    if (!App.hiddenWord && UI.rewards) UI.rewards.afterRender(ui.screen);
  };
  // Re-draw the current screen without speaking or scrolling.
  App.rerender = function () { App.render({ keepScroll: true }); };

  // ---------- stickers, stars and trophies ----------
  App.rewards = function () { return App.state.rewards; };
  // profile.stickers stays the number of stickers in the book (older parts of the app read it).
  App.syncStickers = function () { App.state.profile.stickers = GF.stickers.total(App.state.rewards); };
  App.rand = function (salt) { return GF.util.rng(GF.util.hashSeed(String(salt) + ':' + Date.now() + ':' + GF.stickers.total(App.state.rewards))); };
  // A pack of 3 stickers to open (finishing a board, an A-Z part, or Today's goal).
  App.givePack = function (reason) {
    var item = GF.stickers.award(App.state.rewards, App.rand('pack' + reason), GF.stickers.PACK_SIZE, 'pack', reason);
    App.syncStickers();
    return item;
  };
  // The board token: a token she unlocked and picked, else her avatar.
  App.token = function () {
    var r = App.state.rewards;
    return r.token && GF.stickers.unlockedTokens(r).indexOf(r.token) >= 0 ? r.token : App.state.profile.avatar;
  };

  // Stars, 3-in-a-row stickers, surprise boxes, the 3-day-streak trophy and brain-break time.
  function rewardAnswer(s, right, now) {
    var st = App.state, R = st.rewards;
    s.rewardCount = (s.rewardCount || 0) + 1;
    var ev = GF.stickers.onAnswer(R, right, App.rand('answer' + s.card.id), s.rewardCount);
    var gap = R.lastAnswerAt ? now - R.lastAnswerAt : 0;
    if (gap > 0 && gap < 3 * 60000) R.practiceMs += gap;
    R.lastAnswerAt = now;
    if (st.settings.brainBreak && R.practiceMs >= 20 * 60000) R.breakDue = true;
    if (App.streak() >= 3 && GF.stickers.awardTrophy(R, 'streak3', App.today())) ev.trophy = 'streak3';
    App.syncStickers();
    s.feedback.rewards = ev;
  }

  // ---------- recording an answer (every mode) ----------
  // key: session key in state.sessions; apply(session, right) changes the mode's own state.
  App.answer = function (key, right, apply, extra) {
    var st = App.state;
    var s = st.sessions[key];
    if (!s || !s.card || s.feedback) return;
    var id = s.card.id;
    var day = App.today();
    var now = Date.now();
    var bare = GF.util.clone(s); delete bare.undo;
    var snap = {
      session: bare, progress: st.progress[id] ? GF.util.clone(st.progress[id]) : null, stickers: st.profile.stickers,
      activity: st.activity[day] ? GF.util.clone(st.activity[day]) : null, day: day, backup: GF.util.clone(st.backup), logLen: st.log.length,
      rewards: GF.util.clone(st.rewards), az: st.az.w[id] || null
    };
    s.undo = (s.undo || []).concat([snap]).slice(-5);
    st.progress[id] = GF.scheduler.answer(st.progress[id], right, now, day);
    st.log.push({ id: id, right: right, t: now });
    if (st.log.length > 4000) { st.log = st.log.slice(-3000); s.undo.forEach(function (u) { u.logLen = Math.min(u.logLen, st.log.length - 1); }); }
    var a = st.activity[day] || (st.activity[day] = { all: 0, today: 0 });
    a.all++;
    if (key === 'today') a.today++;
    st.backup.answersSince = (st.backup.answersSince || 0) + 1;
    s.feedback = Object.assign({ id: id, right: right }, extra || {});
    if (apply) apply(s, right);
    rewardAnswer(s, right, now);
    App.save();
    if (right) UI.sounds.right(); else UI.sounds.wrong();
  };

  App.canUndo = function (key) {
    var s = App.state.sessions[key];
    return !!(s && s.undo && s.undo.length);
  };

  App.undo = function (key) {
    var st = App.state;
    var s = st.sessions[key];
    if (!s || !s.undo || !s.undo.length) return;
    var snap = s.undo.pop();
    var restored = snap.session;
    restored.undo = s.undo;
    var id = restored.card && restored.card.id;
    if (id) { if (snap.progress) st.progress[id] = snap.progress; else delete st.progress[id]; }
    st.profile.stickers = snap.stickers;
    if (snap.rewards) st.rewards = snap.rewards;
    if (id && snap.az !== undefined) { if (snap.az) st.az.w[id] = snap.az; else delete st.az.w[id]; }
    if (snap.activity) st.activity[snap.day] = snap.activity; else delete st.activity[snap.day];
    st.backup = snap.backup;
    if (st.log.length > snap.logLen) st.log.length = snap.logLen;
    if (restored.card) restored.card.revealed = true;
    st.sessions[key] = restored;
    App.save();
    UI.toast('↩ Last answer undone');
    App.rerender();
  };

  // ---------- header ----------
  function renderHeader() {
    var bar = document.getElementById('topbar');
    UI.clear(bar);
    var st = App.state;
    var onHome = (st.ui && st.ui.screen) === 'home';
    bar.appendChild(h('button.title', { type: 'button', onclick: function () { App.go('home'); }, 'aria-label': 'Grand Finale Practice, go home' }, 'Grand Finale Practice'));
    var right = h('div.top-actions');
    if (!App.isParentScreen(st.ui && st.ui.screen)) {
      right.appendChild(h('button.btn.icon.stars-btn', { type: 'button', 'aria-label': st.rewards.stars + ' stars. Open the sticker book', title: 'Sticker book', onclick: function () { App.go('stickers'); } }, '⭐ ' + st.rewards.stars));
    }
    if (!onHome) right.appendChild(h('button.btn.icon', { type: 'button', onclick: function () { App.go('home'); }, 'aria-label': 'Home', title: 'Home' }, '🏠'));
    right.appendChild(h('button.btn.icon', {
      type: 'button', 'aria-label': st.settings.sfx ? 'Sound effects on (tap to mute)' : 'Sound effects off (tap to turn on)',
      title: 'Sound effects', 'aria-pressed': String(!st.settings.sfx),
      onclick: function () {
        st.settings.sfx = !st.settings.sfx;
        UI.sounds.setEnabled(st.settings.sfx);
        App.save();
        renderHeader();
        UI.guardWord(document.getElementById('topbar'));
        UI.toast(st.settings.sfx ? '🔔 Sound effects on' : '🔕 Sound effects off (the voice still speaks)');
      }
    }, st.settings.sfx ? '🔔' : '🔕'));
    bar.appendChild(right);
  }

  function renderNotices() {
    var box = document.getElementById('notices');
    if (!box) return;
    UI.clear(box);
    App.notices.forEach(function (msg, i) {
      box.appendChild(h('div.notice', { role: 'status' }, h('span', UI.safe(msg)),
        h('button.btn.icon.small', { type: 'button', 'aria-label': 'Dismiss', onclick: function () { App.notices.splice(i, 1); renderNotices(); } }, '✕')));
    });
  }

  // ---------- keyboard ----------
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (document.querySelector('.modal-back')) return;
    // Space/Enter on a focused button should press that button, except on the card where shortcuts win.
    if (App.keyHandler && App.keyHandler(e)) { e.preventDefault(); }
  }

  // ---------- start ----------
  App.init = function () {
    var main = document.getElementById('app');
    // Inside another page (e.g. a hosted link): printing and file downloads are blocked there.
    App.embedded = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
    if (App.embedded) document.documentElement.classList.add('embedded');
    if (!App.bank || !App.bank.words) {
      main.appendChild(h('div.panel', h('h2', 'The word list is missing'),
        h('p', 'The file js/data/words.js could not be loaded. Keep all the app files together in one folder, then open index.html again.'),
        h('p', 'If you changed data/words.json, run: node tools/build-words-js.mjs')));
      return;
    }
    App.storage = pickStorage();
    var r = GF.storage.load(App.storage, Date.now());
    App.state = r.state;
    if (!r.storageOk || !App.storageOk) App.notice('This browser is not letting the app save. Progress will be lost when the page closes. Try opening it in Chrome, Edge or Safari normally (not a private window).');
    if (r.notice && r.storageOk) App.notice(r.notice);
    App.state.overlay = GF.overlay.adoptOrphans(App.bank.words, App.state.overlay);
    App.refreshWords();
    if (!App.state.backup.remindAfter) App.state.backup.remindAfter = App.state.createdAt || Date.now();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* ignore */ }

    UI.sounds.setEnabled(App.state.settings.sfx);
    UI.speech.onFail(function (reason) {
      if (App.state.settings.speech === 'parent') return;
      App.notice('🗣️ ' + reason + ' The app has switched to Parent reads mode: a grown-up reads each word from the hidden parent panel. You can try another voice in Settings.');
      App.rerender();
    });
    // If no voice turns up, onFail (above) switches to Parent reads and redraws the screen.
    UI.speech.init(App.state.settings);

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', function () { UI.sounds.unlock(); }, { once: true });

    var ui = App.state.ui || {};
    if (App.isParentScreen(ui.screen)) App.state.ui = { screen: 'home', params: {} };
    App.resuming = true;
    App.render();
    App.resuming = false;
    renderNotices();
  };
})();
