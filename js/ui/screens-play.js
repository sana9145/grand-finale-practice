/* Play modes: Today's practice, training boards, Fix my mistakes, Mock Final, Last year's final. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App;
  var Board = GF.board, P = GF.plan, S = GF.scheduler, F = GF.finale, U = GF.util, K = GF.stickers;

  function newCard(id) { return { id: id, revealed: false, spoken: false, asked: {} }; }
  function themeById(id) { return App.bank.themes.filter(function (t) { return t.id === id; })[0] || { id: id, label: id, emoji: '' }; }
  function levelById(id) { return App.bank.finale_format.round2.levels.filter(function (l) { return l.id === id; })[0]; }
  function tierLabel(t) { return t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1); }
  function patternById(id) { return (App.bank.silent_patterns || []).filter(function (p) { return p.id === id; })[0] || { id: id, label: id }; }

  // ======================================================================
  // Board pools
  // ======================================================================
  function poolIds(spec) {
    var bank = App.bank, words = App.words, st = App.state;
    if (spec.type === 'theme') return P.themePool(words, bank, spec.theme, spec.tier);
    if (spec.type === 'pattern') return P.patternPool(words, bank, spec.pattern);
    if (spec.type === 'round2') return P.round2Pool(words, bank, spec.level, spec.focus);
    if (spec.type === 'band') return P.bandPool(words, bank, spec.band);
    if (spec.type === 'fix') return words.filter(function (w) { return !w.hidden && S.isMissed(st.progress[w.id]); }).map(function (w) { return w.id; });
    if (spec.type === 'azMissed') return GF.az.letterIds(words, spec.letter, st.az.filter).filter(function (id) { return st.az.w[id] === 'n'; });
    if (spec.type === 'extreme') return App.extremeIds(spec.range);
    return [];
  }

  // Extremely hard words, optionally only those starting with a letter in a range like "A-F".
  App.extremeIds = function (range) {
    var from = range ? range.charAt(0) : 'A', to = range ? range.charAt(2) : 'Z';
    return App.words.filter(function (w) { return w.extreme && !w.hidden && w.letter >= from && w.letter <= to; })
      .sort(GF.az.compare).map(function (w) { return w.id; });
  };

  function specTitle(spec) {
    if (spec.type === 'theme') { var t = themeById(spec.theme); return t.emoji + ' ' + t.label + ' · ' + tierLabel(spec.tier); }
    if (spec.type === 'pattern') return '🤫 ' + patternById(spec.pattern).label;
    if (spec.type === 'round2') return '📈 ' + levelById(spec.level).label + ' · ' + (spec.focus ? 'Focus (6–8)' : 'All 6–8');
    if (spec.type === 'band') return '📚 9–11 list · ' + tierLabel(spec.band);
    if (spec.type === 'fix') return '🔁 Fix my mistakes';
    if (spec.type === 'azMissed') return '🔤 ' + spec.letter + ' · missed words';
    if (spec.type === 'extreme') return '🔥 Extremely hard · ' + spec.range.replace('-', '–');
    return 'Board';
  }

  function specKey(spec) { return JSON.stringify([spec.type, spec.theme, spec.tier, spec.pattern, spec.level, spec.focus, spec.band, spec.letter, spec.range]); }

  function orderedPool(spec, seed) {
    return S.order(poolIds(spec), App.state.progress, App.today(), U.rng(seed));
  }

  App.startBoard = function (spec) {
    var st = App.state;
    var old = st.sessions.board;
    if (old && old.key === specKey(spec) && !old.board.finished) { App.go('board', {}, { autoSpeak: !old.feedback && old.card && !old.card.revealed }); return; }
    var ids = poolIds(spec);
    if (!ids.length) {
      if (spec.type === 'fix') { App.go('noMistakes'); return; }
      if (spec.type === 'azMissed') { UI.alert('No missed words', 'Every word in ' + spec.letter + ' that was asked is done. Brilliant!'); return; }
      UI.alert('No words here', 'There are no words in this list yet.');
      return;
    }
    var seed = U.hashSeed(specKey(spec) + Date.now());
    var b = Board.next(Board.create({ ids: orderedPool(spec, seed), length: st.settings.boardLength, wrongMode: st.settings.boardWrong }));
    st.sessions.board = { kind: 'board', key: specKey(spec), spec: spec, seed: seed, board: b, card: newCard(b.current), feedback: null, undo: [], stickersAtStart: K.total(st.rewards) };
    App.go('board', {}, { autoSpeak: true });
  };

  App.screens.noMistakes = function (root) {
    root.appendChild(h('div.panel.center', h('p.big-emoji', '🎉'), h('h1', 'No mistakes to fix 🎉'),
      h('p', 'Every word you have missed is fixed. Brilliant!'),
      h('button.btn.big.primary', { type: 'button', onclick: function () { App.go('home'); } }, '🏠 Home')));
  };

  // ======================================================================
  // Today's practice
  // ======================================================================
  function buildToday(day, salt) {
    var st = App.state;
    var seed = U.hashSeed(day + ':' + (st.createdAt || 0) + ':' + (salt || 0));
    return GF.today.buildQueue({ words: App.words, bank: App.bank, plan: App.plan(), progress: st.progress, today: day, seed: seed }).queue;
  }

  App.startToday = function () {
    var st = App.state, day = App.today();
    var s = st.sessions.today;
    if (!s || s.day !== day) {
      var q = buildToday(day, 0);
      if (!q.length) { UI.alert('The study plan is empty', 'Ask a grown-up to tick some boxes in the study plan (Parent area).'); return; }
      var b = Board.next(Board.create({ ids: q, length: st.settings.boardLength, wrongMode: st.settings.boardWrong }));
      s = st.sessions.today = { kind: 'today', day: day, seed: U.hashSeed(day), board: b, count: (st.activity[day] && st.activity[day].today) || 0, card: newCard(b.current), feedback: null, undo: [], goalCelebrated: false, refills: 0 };
    }
    App.go('today', {}, { autoSpeak: !s.feedback && s.card && !s.card.revealed });
  };

  // When the plan changes, today's remaining queue follows it.
  App.replanToday = function () {
    var s = App.state.sessions.today;
    if (!s || s.day !== App.today()) return;
    var cur = s.card && s.card.id;
    s.board.queue = buildToday(s.day, ++s.refills).filter(function (id) { return id !== cur; });
  };

  // ======================================================================
  // Shared board screen (today / board)
  // ======================================================================
  function boardNext(key) {
    var st = App.state, s = st.sessions[key];
    s.feedback = null;
    if (s.board.finished) {
      if (key === 'today') s.board = Board.newLap(s.board);
      else { App.save(); App.rerender(); return; }
    }
    s.board = Board.next(s.board);
    if (!s.board.current) {
      var ids = key === 'today' ? buildToday(s.day, ++s.refills) : orderedPool(s.spec, s.seed + s.board.answered);
      s.board = Board.next(Board.refill(s.board, ids));
    }
    if (!s.board.current) {
      s.card = null;
      App.save();
      if (key === 'board' && s.spec.type === 'fix') { st.sessions.board = null; App.go('noMistakes'); return; }
      if (key === 'board' && s.spec.type === 'azMissed') { st.sessions.board = null; UI.toast('All the missed words are done!'); App.go('azLetter', { letter: s.spec.letter }); return; }
      App.rerender();
      return;
    }
    s.card = newCard(s.board.current);
    App.save();
    App.render({ keepScroll: true, autoSpeak: true });
  }

  function boardSwap(key) {
    var s = App.state.sessions[key];
    var old = s.card.id;
    s.board = Board.next(s.board);
    if (!s.board.current) {
      var ids = key === 'today' ? buildToday(s.day, ++s.refills) : orderedPool(s.spec, s.seed + 17);
      s.board = Board.next(Board.refill(s.board, ids.filter(function (x) { return x !== old; })));
    }
    if (!s.board.current) { UI.toast('No other word available'); return; }
    s.board.queue.splice(Math.min(6, s.board.queue.length), 0, old); // the swapped word comes back later
    s.card = newCard(s.board.current);
    App.save();
    UI.toast('New word, no penalty');
    App.render({ keepScroll: true, autoSpeak: true });
  }

  function boardScreen(root, key, opts) {
    var st = App.state, s = st.sessions[key];
    if (!s) { App.go('home'); return; }
    var title = key === 'today' ? "📅 Today's practice" : specTitle(s.spec);
    var goal = st.settings.dailyGoal;
    var sub = key === 'today'
      ? h('p.counter', { 'aria-live': 'polite' }, h('b', s.count + ' / ' + goal), ' today' + (s.count >= goal ? ' · Goal reached! 🎉' : ''))
      : h('p.counter', 'Square ' + s.board.pos + ' of ' + s.board.length + ' · ✓ ' + s.board.right + '  ✗ ' + s.board.wrong);
    root.appendChild(h('div.play-head', h('h1', title), sub, UI.rewards.meter()));

    var layout = h('div.play');
    root.appendChild(layout);
    var boardBox = h('div.board-box', UI.board.view(s.board, App.token(), { bounce: !!(s.feedback && s.feedback.move > 0), theme: K.theme(st.rewards) }));
    layout.appendChild(boardBox);

    var cardBox = h('div.card-box');
    layout.appendChild(cardBox);

    // Training board finished: trophy screen.
    if (key === 'board' && s.board.finished && !s.feedback) {
      var earned = Math.max(0, K.total(st.rewards) - (s.stickersAtStart || 0));
      cardBox.appendChild(h('section.card.center',
        h('p.big-emoji', '🏆'), h('h2', 'You reached the trophy!'),
        h('p', '✓ ' + s.board.right + ' right · ✗ ' + s.board.wrong + ' to practise · ' + earned + ' new sticker' + (earned === 1 ? '' : 's')),
        h('div.row.center',
          h('button.btn.big.primary', { type: 'button', onclick: function () { var sp = s.spec; st.sessions.board = null; App.startBoard(sp); } }, '🔄 Play again'),
          h('button.btn.big', { type: 'button', onclick: function () { App.go(backTo(s.spec), { letter: s.spec.letter }); } }, 'Choose another'))));
      return;
    }
    if (!s.card) {
      cardBox.appendChild(h('section.card.center', h('p', 'No words left here.'), h('button.btn.big', { type: 'button', onclick: function () { App.go('home'); } }, '🏠 Home')));
      return;
    }

    var word = App.word(s.feedback ? s.feedback.id : s.card.id);
    if (!word) { // a word removed by the parent: skip it
      s.feedback = null;
      boardNext(key);
      return;
    }

    if (s.feedback) {
      var f = s.feedback;
      var extra = [];
      if (f.move > 0) extra.push(h('p', '➡️ Forward one square!'));
      else if (f.move < 0) extra.push(h('p', '⬅️ Back one square. You\'ll see this word again soon.'));
      else if (!f.right) extra.push(h('p', 'You\'ll see this word again soon.'));
      if (f.finished && key === 'today') extra.push(h('p.sticker-won', '🏆 You reached the trophy! A new lap starts.'));
      if (f.finished && key === 'board') extra.push(h('p.sticker-won', '🏆 You reached the trophy!'));
      if (f.goal) extra.push(h('p.sticker-won', "🎉 Today's goal is done! You can stop here or keep going."));
      if (f.azDone) extra.push(h('p.sticker-won', '✓ Done in the A–Z tab!'));
      if (f.letterDone) extra.push(h('p.sticker-won', '🏅 Letter ' + f.letterDone + ' is complete! The golden ' + f.letterDone + ' is in your sticker book.'));
      if (f.champion) extra.push(h('p.sticker-won', '🏆 A to Z Champion!'));
      cardBox.appendChild(UI.card.feedback({
        word: word, right: f.right, auto: f.auto, extra: extra, fb: f,
        nextLabel: f.finished && key === 'board' ? 'See my trophy ➜' : 'Next word ➜',
        onNext: function () { boardNext(key); },
        canUndo: App.canUndo(key), onUndo: function () { App.undo(key); }
      }));
      return;
    }

    var card = UI.card.question({
      word: word, card: s.card, autoSpeak: !!opts.autoSpeak,
      onChange: App.save,
      onReveal: function () { App.rerender(); },
      onJudge: function (right, auto) {
        App.answer(key, right, function (sess, r) {
          sess.board = Board.answer(sess.board, r, U.rng(sess.seed + sess.board.answered * 31 + 7));
          sess.feedback.move = sess.board.lastMove;
          sess.feedback.finished = sess.board.finished;
          sess.feedback.auto = !!auto;
          if (sess.board.finished) App.givePack(key === 'today' ? 'reaching the trophy' : 'finishing the board');
          if (key === 'today') {
            sess.count += 1;
            if (sess.count >= st.settings.dailyGoal && !sess.goalCelebrated) { sess.goalCelebrated = true; sess.feedback.goal = true; App.givePack("Today's goal"); }
          }
          // Missed A-Z words practised on a board count as done in the A-Z tab once right.
          if (key === 'board' && sess.spec.type === 'azMissed' && r) {
            st.az.w[sess.card.id] = 'd';
            sess.feedback.azDone = true;
            sess.feedback.letterDone = App.checkLetter(sess.spec.letter);
            if (sess.feedback.letterDone && App.checkChampion()) sess.feedback.champion = true;
          }
        });
        var f2 = s.feedback || App.state.sessions[key].feedback;
        if (f2 && f2.finished) { UI.sounds.trophy(); UI.confetti(); }
        else if (f2 && f2.goal) { UI.sounds.sticker(); UI.confetti(); }
        App.rerender();
      },
      canUndo: App.canUndo(key), onUndo: function () { App.undo(key); },
      onSwap: function () { boardSwap(key); }
    });
    cardBox.appendChild(card);
    root._cleanup = card._cleanup;
  }

  function backTo(spec) {
    return { round2: 'train2', band: 'train2', fix: 'home', azMissed: 'azLetter', extreme: 'extreme' }[spec.type] || 'train1';
  }

  App.screens.today = function (root, params, opts) { boardScreen(root, 'today', opts || {}); };
  App.screens.board = function (root, params, opts) { boardScreen(root, 'board', opts || {}); };

  // ======================================================================
  // Training pickers
  // ======================================================================
  function countLabel(ids) { return S.countMastered(ids, App.state.progress) + '/' + ids.length; }

  App.screens.train1 = function (root) {
    root.appendChild(h('h1', '🎯 Round 1 training'));
    root.appendChild(h('p', 'Pick a theme.'));
    root.appendChild(h('div.choices', App.bank.themes.map(function (t) {
      var ids = P.themePool(App.words, App.bank, t.id, 'all');
      return h('button.choice', { type: 'button', onclick: function () { App.go('train1theme', { theme: t.id }); } },
        h('span.choice-emoji', t.emoji), h('span.choice-name', t.label), h('span.choice-sub', countLabel(ids) + ' mastered'));
    })));
  };

  App.screens.train1theme = function (root, params) {
    var t = themeById(params.theme);
    root.appendChild(h('h1', t.emoji + ' ' + t.label));
    root.appendChild(h('p', 'Pick a tier.'));
    var tiers = P.TIERS.concat(['all']);
    root.appendChild(h('div.choices', tiers.map(function (tier) {
      var ids = P.themePool(App.words, App.bank, t.id, tier);
      return h('button.choice', { type: 'button', disabled: !ids.length, onclick: function () { App.startBoard({ type: 'theme', theme: t.id, tier: tier }); } },
        h('span.choice-name', t.label + ' · ' + tierLabel(tier)), h('span.choice-sub', countLabel(ids)));
    }).concat(t.id === 'silent_letter' ? [h('button.choice', { type: 'button', onclick: function () { App.go('train1pattern'); } },
      h('span.choice-name', '🔎 By pattern'), h('span.choice-sub', (App.bank.silent_patterns || []).length + ' patterns'))] : [])));
    root.appendChild(h('p.muted', App.bank.theme_tiers ? 'Easy: ' + App.bank.theme_tiers.easy + ' Hard: ' + App.bank.theme_tiers.hard : ''));
  };

  App.screens.train1pattern = function (root) {
    root.appendChild(h('h1', '🤫 Silent letters by pattern'));
    root.appendChild(h('div.choices', (App.bank.silent_patterns || []).map(function (p) {
      var ids = P.patternPool(App.words, App.bank, p.id);
      return h('button.choice', { type: 'button', disabled: !ids.length, onclick: function () { App.startBoard({ type: 'pattern', pattern: p.id }); } },
        h('span.choice-name', p.label), h('span.choice-sub', countLabel(ids)));
    })));
  };

  App.screens.train2 = function (root) {
    root.appendChild(h('h1', '📈 Round 2 training'));
    root.appendChild(h('p', 'Pick a level, then a word set. Focus words are the everyday words to learn first.'));
    App.bank.finale_format.round2.levels.forEach(function (l) {
      var f = P.round2Pool(App.words, App.bank, l.id, true), a = P.round2Pool(App.words, App.bank, l.id, false);
      var b = P.bandPool(App.words, App.bank, l.id);
      root.appendChild(h('div.level-row',
        h('h2', l.label + ' (+' + l.points_right + ')'),
        h('div.choices.three',
          h('button.choice', { type: 'button', onclick: function () { App.startBoard({ type: 'round2', level: l.id, focus: true }); } },
            h('span.choice-name', 'Focus (6–8)'), h('span.choice-sub', countLabel(f))),
          h('button.choice', { type: 'button', onclick: function () { App.startBoard({ type: 'round2', level: l.id, focus: false }); } },
            h('span.choice-name', 'All 6–8'), h('span.choice-sub', countLabel(a))),
          h('button.choice', { type: 'button', disabled: !b.length, onclick: function () { App.startBoard({ type: 'band', band: l.id }); } },
            h('span.choice-name', '9–11 list (' + l.label.toLowerCase() + ')'), h('span.choice-sub', countLabel(b))))));
    });
    root.appendChild(h('p.muted', "The 9–11 list's extremely hard words have their own tab on the Home screen."));
  };

  // ======================================================================
  // Mock Final
  // ======================================================================
  function fmt() { return App.bank.finale_format; }

  App.startMock = function (fresh) {
    var st = App.state;
    var s = st.sessions.mock;
    if (!fresh && s && s.phase !== 'results') { App.go('mock'); return; }
    var now = Date.now();
    st.sessions.mock = {
      kind: 'mock', id: 'mock-' + now, seed: U.hashSeed('mock' + now), startedAt: now, phase: 'intro', round: 1,
      r1: [], r2: [], used: [], recent: F.recentIds(st.mockHistory, 2), card: null, feedback: null, undo: [], swaps: 0, saved: false
    };
    App.go('mock');
  };

  function mockCtx(s) {
    return {
      words: App.words, bank: App.bank, plan: App.plan(), mockUses: App.state.settings.mockUses, mockR2: App.state.settings.mockR2, progress: App.state.progress,
      today: App.today(), rand: U.rng(s.seed + s.used.length * 7919 + s.swaps * 104729), used: s.used, recent: s.recent
    };
  }

  function entries(s) { return s.round === 1 ? s.r1 : s.r2; }
  function scores(s) { return F.score(fmt(), s.r1, s.r2); }

  function mockChoose(s, choice) {
    var d = s.round === 1 ? F.drawRound1(choice, mockCtx(s)) : F.drawRound2(choice, mockCtx(s));
    if (!d || !d.id) { UI.alert('No words', 'There are no words for this choice. Please pick another.'); return false; }
    entries(s).push({ choice: choice, id: d.id, tier: d.tier, right: null });
    s.used.push(d.id);
    s.card = newCard(d.id);
    s.phase = 'card';
    App.save();
    return true;
  }

  function mockUndoChoice(s) {
    if (!s.card || s.card.spoken) return;
    var e = entries(s).pop();
    if (e) s.used = s.used.filter(function (x) { return x !== e.id; });
    s.card = null;
    s.phase = 'choose';
    App.save();
    App.rerender();
  }

  function mockSwap(s) {
    var e = entries(s)[entries(s).length - 1];
    s.swaps += 1;
    var d = s.round === 1 ? F.drawRound1(e.choice, mockCtx(s)) : F.drawRound2(e.choice, mockCtx(s));
    if (!d || !d.id || d.id === e.id) { UI.toast('No other word available'); return; }
    e.id = d.id; e.tier = d.tier;
    s.used.push(d.id);
    s.card = newCard(d.id);
    s.card.spoken = true; // the choice stays locked
    App.save();
    UI.toast('New word, no penalty');
    App.render({ keepScroll: true, autoSpeak: true });
  }

  function mockNext(s) {
    s.feedback = null;
    var n = s.round === 1 ? fmt().round1.words : fmt().round2.words;
    if (entries(s).length >= n) {
      if (s.round === 1) { s.phase = 'between'; }
      else { s.phase = 'results'; saveMock(s); }
    } else s.phase = 'choose';
    s.card = s.phase === 'choose' ? null : s.card;
    App.save();
    if (s.phase === 'results') {
      var sc = scores(s);
      if (F.placesBeaten(fmt(), sc.total).length) { UI.sounds.trophy(); UI.confetti(); }
    }
    App.rerender();
  }

  function saveMock(s) {
    var st = App.state;
    if (s.saved || st.mockHistory.some(function (m) { return m.id === s.id; })) { s.saved = true; return; }
    var sc = scores(s);
    var prevBest = st.mockHistory.length ? Math.max.apply(null, st.mockHistory.map(function (m) { return m.total; })) : null;
    var pack = function (round, list) {
      return list.map(function (e) {
        var w = App.word(e.id) || { display: e.id };
        return { choice: e.choice, tier: e.tier, id: e.id, word: w.display, right: e.right, points: F.points(fmt(), round, e.choice, e.right) };
      });
    };
    st.mockHistory.push({
      id: s.id, date: App.today(), startedAt: s.startedAt, finishedAt: Date.now(),
      round1: pack(1, s.r1), round2: pack(2, s.r2), r1Score: sc.r1, r2Score: sc.r2, total: sc.total, prevBest: prevBest
    });
    if (st.mockHistory.length > 200) st.mockHistory = st.mockHistory.slice(-200);
    // Trophies for the sticker book.
    var R = st.rewards, day = App.today(), won = [];
    var trophy = function (id, ok) { if (ok && K.awardTrophy(R, id, day)) won.push(id); };
    trophy('firstMock', true);
    trophy('mock130', sc.total >= 130);
    trophy('mock140', sc.total >= 140);
    trophy('mock150', sc.total >= 150);
    trophy('personalBest', prevBest != null && sc.total > prevBest);
    s.trophies = won;
    s.saved = true;
    s.undo = []; // a saved mock can't be undone
  }

  function scoreBar(s) {
    var sc = scores(s);
    var n = s.round === 1 ? fmt().round1.words : fmt().round2.words;
    var idx = Math.min(entries(s).length + (s.phase === 'choose' ? 1 : 0), n);
    return h('div.scorebar',
      h('span', (s.round === 1 ? 'Round 1: Themes' : 'Round 2: Difficulty') + ' · word ' + idx + ' of ' + n),
      h('span.score', 'Score: ' + sc.total));
  }

  App.screens.mock = function (root, params, opts) {
    var st = App.state, s = st.sessions.mock;
    if (!s) { App.go('home'); return; }
    opts = opts || {};
    root.appendChild(h('h1', '🏆 Mock Final'));

    if (s.phase === 'intro') {
      var r1 = fmt().round1, r2 = fmt().round2;
      root.appendChild(h('section.card.intro',
        h('h2', 'This is just like the real grand final!'),
        h('div.intro-round', h('h3', '1️⃣ Round 1: Themes'),
          h('p', r1.words + ' words. Before each word, you choose a theme: ' + r1.themes.map(function (t) { return t.emoji + ' ' + t.label; }).join(', ') + '. You can choose the same theme again.'),
          h('p', 'Right = +' + r1.points_right + ' points. Wrong = ' + r1.points_wrong + ' points.')),
        h('div.intro-round', h('h3', '2️⃣ Round 2: Choose how hard'),
          h('p', r2.words + ' words. Before each word, you choose: ' + r2.levels.map(function (l) { return l.label + ' (+' + l.points_right + ')'; }).join(', ') + '.'),
          h('p', 'Careful: a wrong answer takes away ' + Math.abs(r2.points_wrong) + ' points.')),
        h('p', 'The most you can score is ' + fmt().max_total + '. You can ask for the word again, its meaning, a sentence, or its part of speech.'),
        h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () { s.phase = 'choose'; App.save(); App.rerender(); } }, "Let's start! ➜"))));
      return;
    }

    if (s.phase === 'between') {
      var sc = scores(s);
      root.appendChild(h('section.card.center',
        h('p.big-emoji', '🎉'), h('h2', 'Round 1 done!'),
        h('p.bigscore', sc.r1 + ' points'),
        sc.r1 <= 10 ? h('p.gentle', 'In the real final, two children left here. Let\'s keep going!') : h('p', 'Great! Now Round 2: you choose how hard each word is.'),
        h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () { s.round = 2; s.phase = 'choose'; App.save(); App.rerender(); } }, 'Start Round 2 ➜')),
        App.canUndo('mock') ? h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: function () { App.undo('mock'); } }, '↩ Undo last answer')) : null));
      App.keyHandler = function (e) { if ((e.key === 'u' || e.key === 'U') && App.canUndo('mock')) { App.undo('mock'); return true; } return false; };
      return;
    }

    if (s.phase === 'results') { mockResults(root, s); return; }

    root.appendChild(scoreBar(s));

    if (s.phase === 'choose') {
      var locked = false;
      var btns;
      var pick = function (choice) {
        if (locked) return;
        locked = true;
        btns.forEach(function (b) { b.disabled = true; });
        if (!mockChoose(s, choice)) { locked = false; btns.forEach(function (b) { b.disabled = false; }); return; }
        App.rerender();
      };
      if (s.round === 1) {
        root.appendChild(h('h2.center', 'Choose a theme!'));
        btns = fmt().round1.themes.map(function (t) {
          return h('button.choice.big-choice', { type: 'button', onclick: function () { pick(t.id); } }, h('span.choice-emoji', t.emoji), h('span.choice-name', t.label));
        });
      } else {
        root.appendChild(h('h2.center', 'Choose how hard!'));
        btns = fmt().round2.levels.map(function (l) {
          return h('button.choice.big-choice.lvl-' + l.id, { type: 'button', onclick: function () { pick(l.id); } },
            h('span.choice-name', l.label), h('span.choice-pts', '+' + l.points_right), h('span.choice-sub', 'wrong ' + fmt().round2.points_wrong));
        });
      }
      root.appendChild(h('div.choices.three', btns));
      if (App.canUndo('mock')) root.appendChild(h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: function () { App.undo('mock'); } }, '↩ Undo last answer')));
      App.keyHandler = function (e) { if ((e.key === 'u' || e.key === 'U') && App.canUndo('mock')) { App.undo('mock'); return true; } return false; };
      return;
    }

    // phase card
    var e = entries(s)[entries(s).length - 1];
    var label = s.round === 1 ? themeById(e.choice).emoji + ' ' + themeById(e.choice).label : levelById(e.choice).label + ' (+' + levelById(e.choice).points_right + ')';
    var word = App.word(s.feedback ? s.feedback.id : s.card.id);
    if (s.feedback) {
      var pts = F.points(fmt(), s.round, e.choice, s.feedback.right);
      root.appendChild(UI.card.feedback({
        word: word, right: s.feedback.right, auto: s.feedback.auto, fb: s.feedback,
        extra: h('p.points', (pts > 0 ? '+' : '') + pts + ' points · Score: ' + scores(s).total),
        nextLabel: 'Next ➜', onNext: function () { mockNext(s); },
        canUndo: App.canUndo('mock'), onUndo: function () { App.undo('mock'); }
      }));
      return;
    }
    var card = UI.card.question({
      word: word, card: s.card, autoSpeak: !!opts.autoSpeak,
      header: h('span.chip', 'You chose: ' + label),
      onChange: App.save,
      onReveal: function () { App.rerender(); },
      onJudge: function (right, auto) {
        App.answer('mock', right, function (sess, r) { entries(sess)[entries(sess).length - 1].right = r; sess.feedback.auto = !!auto; });
        App.rerender();
      },
      canUndo: App.canUndo('mock'), onUndo: function () { App.undo('mock'); },
      onSwap: function () { mockSwap(s); },
      choiceUndo: { label: '↩ Change my ' + (s.round === 1 ? 'theme' : 'level'), fn: function () { mockUndoChoice(s); } }
    });
    root.appendChild(card);
    root._cleanup = card._cleanup;
  };

  function mockResults(root, s) {
    var st = App.state;
    var sc = scores(s);
    var rec = st.mockHistory.filter(function (m) { return m.id === s.id; })[0];
    var prevBest = rec ? rec.prevBest : null;
    var places = F.placesBeaten(fmt(), sc.total);
    var sheet = h('div.print-sheet.results');
    sheet.appendChild(h('div.center',
      h('p.big-emoji', places.length ? '🏆' : '🌟'),
      h('p.bigscore', sc.total + ' / ' + fmt().max_total),
      h('p', 'Round 1: ' + sc.r1 + ' · Round 2: ' + sc.r2),
      places.length ? h('p.sticker-won', 'That would be ' + places[0].place + ' in 2025! 🎉') : null,
      prevBest == null ? h('p', 'Your first Mock Final!') : sc.total > prevBest ? h('p.sticker-won', 'New personal best! (before: ' + prevBest + ')') : h('p', 'Personal best: ' + prevBest),
      (s.trophies || []).length ? h('div.no-print', (s.trophies || []).map(function (id) {
        var t = K.TROPHIES.filter(function (x) { return x.id === id; })[0];
        return h('p.sticker-won', 'New trophy for your sticker book: ' + t.emoji + ' ' + t.label + '!');
      })) : null));
    sheet.appendChild(h('table.compare', h('tbody',
      fmt().results_2025.map(function (r) { return h('tr', h('td', '2025 ' + r.place), h('td', String(r.total))); }),
      h('tr.me', h('td', st.profile.avatar + ' ' + st.profile.name), h('td', String(sc.total))))));
    [[1, s.r1], [2, s.r2]].forEach(function (pair) {
      sheet.appendChild(h('h3', pair[0] === 1 ? 'Round 1: Themes' : 'Round 2: Difficulty'));
      sheet.appendChild(h('ul.wordlist', pair[1].map(function (e) {
        var w = App.word(e.id) || { display: e.id, word: e.id, meaning: '' };
        var choice = pair[0] === 1 ? themeById(e.choice).label : levelById(e.choice).label;
        var pts = F.points(fmt(), pair[0], e.choice, e.right);
        return h('li.' + (e.right ? 'ok' : 'miss'),
          h('span.mark', e.right ? '✓' : '✗'),
          h('button.btn.icon.small.no-print', { type: 'button', 'aria-label': 'Say ' + w.display, onclick: function () { UI.card.sayWord(w); } }, '🔊'),
          h('span.w', w.display), h('span.muted', ' ' + choice + ' · ' + (pts > 0 ? '+' : '') + pts),
          w.meaning ? h('div.m', w.meaning) : null);
      })));
    });
    root.appendChild(sheet);
    root.appendChild(h('div.row.center.no-print',
      h('button.btn.print-btn', { type: 'button', onclick: function () { window.print(); } }, '🖨 Print'),
      h('button.btn.primary', { type: 'button', onclick: function () { App.startMock(true); } }, '🔄 New Mock Final'),
      h('button.btn', { type: 'button', onclick: function () { App.go('home'); } }, '🏠 Home')));
  }

  // ======================================================================
  // Last year's final
  // ======================================================================
  App.screens.legacyList = function (root) {
    var finalists = (App.bank.final_2025 && App.bank.final_2025.finalists) || [];
    root.appendChild(h('h1', "📼 Last year's final"));
    root.appendChild(h('p', 'Play the exact words one 2025 finalist got, with the same choices, then compare. (No names.)'));
    root.appendChild(h('div.choices', finalists.map(function (f, i) {
      var sub = f.total + ' points' + (f.place ? ' · ' + f.place : f.eliminated_after_round1 ? ' · out after round 1' : '');
      return h('button.choice', { type: 'button', onclick: function () { startLegacy(i); } },
        h('span.choice-name', f.label), h('span.choice-sub', sub));
    })));
  };

  function startLegacy(i) {
    var f = App.bank.final_2025.finalists[i];
    var r1 = f.round1.map(function (x) { return { choice: x.theme, id: U.idOf(x.word), finalistRight: x.right, right: null }; });
    var r2 = (f.round2 || []).map(function (x) { return { choice: x.level, id: U.idOf(x.word), finalistRight: x.right, right: null }; });
    App.state.sessions.legacy = { kind: 'legacy', fi: i, label: f.label, phase: 'card', round: 1, idx: 0, r1: r1, r2: r2, card: newCard(r1[0].id), feedback: null, undo: [], saved: false };
    App.go('legacy', {}, { autoSpeak: true });
  }

  function legacyNext(s) {
    s.feedback = null;
    var list = s.round === 1 ? s.r1 : s.r2;
    s.idx += 1;
    if (s.idx >= list.length) {
      if (s.round === 1 && s.r2.length) { s.phase = 'between'; s.card = null; }
      else { s.phase = 'results'; s.card = null; saveLegacy(s); }
      App.save(); App.rerender(); return;
    }
    s.card = newCard(list[s.idx].id);
    App.save();
    App.render({ keepScroll: true, autoSpeak: true });
  }

  function saveLegacy(s) {
    if (s.saved) return;
    var sc = F.score(fmt(), s.r1, s.r2);
    App.state.legacyHistory.push({ date: App.today(), finalist: s.label, r1: sc.r1, r2: s.r2.length ? sc.r2 : null, total: sc.total });
    if (App.state.legacyHistory.length > 100) App.state.legacyHistory = App.state.legacyHistory.slice(-100);
    s.saved = true;
    s.undo = [];
  }

  App.screens.legacy = function (root, params, opts) {
    var s = App.state.sessions.legacy;
    if (!s) { App.go('legacyList'); return; }
    var f = App.bank.final_2025.finalists[s.fi];
    root.appendChild(h('h1', '📼 ' + s.label + "'s words"));

    if (s.phase === 'between') {
      var sc0 = F.score(fmt(), s.r1, []);
      root.appendChild(h('section.card.center', h('h2', 'Round 1 done!'),
        h('p.bigscore', 'You: ' + sc0.r1 + ' · ' + s.label + ': ' + f.round1_score),
        h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () { s.round = 2; s.idx = 0; s.phase = 'card'; s.card = newCard(s.r2[0].id); App.save(); App.render({ autoSpeak: true }); } }, 'Start Round 2 ➜')),
        App.canUndo('legacy') ? h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: function () { App.undo('legacy'); } }, '↩ Undo last answer')) : null));
      return;
    }
    if (s.phase === 'results') { legacyResults(root, s, f); return; }

    var list = s.round === 1 ? s.r1 : s.r2;
    var e = list[s.idx];
    var sc = F.score(fmt(), s.r1, s.r2);
    root.appendChild(h('div.scorebar', h('span', 'Round ' + s.round + ' · word ' + (s.idx + 1) + ' of ' + list.length), h('span.score', 'Score: ' + sc.total)));
    var label = s.round === 1 ? themeById(e.choice).emoji + ' ' + themeById(e.choice).label : levelById(e.choice).label + ' (+' + levelById(e.choice).points_right + ')';
    var word = App.word(s.feedback ? s.feedback.id : s.card.id);
    if (s.feedback) {
      var pts = F.points(fmt(), s.round, e.choice, s.feedback.right);
      root.appendChild(UI.card.feedback({
        word: word, right: s.feedback.right, auto: s.feedback.auto, fb: s.feedback,
        extra: [h('p.points', (pts > 0 ? '+' : '') + pts + ' points'), h('p.muted', s.label + (e.finalistRight ? ' got this right.' : ' missed this one. Tricky last year!'))],
        nextLabel: 'Next ➜', onNext: function () { legacyNext(s); },
        canUndo: App.canUndo('legacy'), onUndo: function () { App.undo('legacy'); }
      }));
      return;
    }
    var card = UI.card.question({
      word: word, card: s.card, autoSpeak: !!(opts && opts.autoSpeak),
      header: h('span.chip', s.label + ' chose: ' + label),
      onChange: App.save,
      onReveal: function () { App.rerender(); },
      onJudge: function (right, auto) {
        App.answer('legacy', right, function (sess, r) { (sess.round === 1 ? sess.r1 : sess.r2)[sess.idx].right = r; sess.feedback.auto = !!auto; });
        App.rerender();
      },
      canUndo: App.canUndo('legacy'), onUndo: function () { App.undo('legacy'); }
    });
    root.appendChild(card);
    root._cleanup = card._cleanup;
  }

  function legacyResults(root, s, f) {
    var sc = F.score(fmt(), s.r1, s.r2);
    var mine = s.r2.length ? sc.total : sc.r1;
    var table = h('table.side',
      h('thead', h('tr', h('th', 'Word'), h('th', 'You'), h('th', s.label))),
      h('tbody', [[1, s.r1], [2, s.r2]].map(function (pair) {
        if (!pair[1].length) return null;
        return [h('tr.round', h('td', { colspan: '3' }, pair[0] === 1 ? 'Round 1: Themes' : 'Round 2: Difficulty'))].concat(pair[1].map(function (e) {
          var w = App.word(e.id) || { display: e.id };
          return h('tr',
            h('td', w.display, e.finalistRight ? null : h('span.tag.tricky', 'tricky last year')),
            h('td.' + (e.right ? 'ok' : 'miss'), e.right ? '✓' : '✗'),
            h('td.' + (e.finalistRight ? 'ok' : 'miss'), e.finalistRight ? '✓' : '✗'));
        }));
      })),
      h('tfoot',
        h('tr', h('td', 'Round 1'), h('td', String(sc.r1)), h('td', String(f.round1_score))),
        s.r2.length ? h('tr', h('td', 'Round 2'), h('td', String(sc.r2)), h('td', String(f.round2_score))) : null,
        h('tr.total', h('td', 'Total'), h('td', String(mine)), h('td', String(f.total)))));
    root.appendChild(h('section.card',
      h('p.bigscore.center', 'You ' + mine + ' · ' + s.label + ' ' + f.total),
      f.eliminated_after_round1 ? h('p.center', s.label + ' was eliminated after round 1, so there is only one round.') : null,
      f.note ? h('p.muted.center', f.note) : null,
      h('div.table-wrap', table)));
    root.appendChild(h('div.row.center',
      h('button.btn.primary', { type: 'button', onclick: function () { App.go('legacyList'); } }, 'Try another finalist'),
      h('button.btn', { type: 'button', onclick: function () { App.go('home'); } }, '🏠 Home')));
  }
})();
