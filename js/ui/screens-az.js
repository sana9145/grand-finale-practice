/* The 🔤 A–Z tab (every word on both lists, letter by letter) and the 🔥 Extremely hard tab. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App;
  var A = GF.az, K = GF.stickers, S = GF.scheduler, U = GF.util;

  function newCard(id) { return { id: id, revealed: false, spoken: false, asked: {} }; }
  function fmt(n) { return Number(n).toLocaleString('en-GB'); }
  function az() { return App.state.az; }
  function filter() { return az().filter; }

  // Golden letter badge when a letter becomes complete. -> the letter if it just became complete, else null.
  App.checkLetter = function (letter) {
    var ids = A.letterIds(App.words, letter, filter());
    if (!A.summary(ids, az().w).complete) return null;
    return K.awardLetter(App.state.rewards, letter, App.today()) ? letter : null;
  };
  // A to Z Champion: every letter complete under the current filter. -> true if just won.
  App.checkChampion = function () {
    var ov = A.overview(App.words, filter(), az().w);
    return ov.lettersTotal > 0 && ov.lettersDone === ov.lettersTotal && K.awardTrophy(App.state.rewards, 'azChampion', App.today());
  };

  function ring(done, total) {
    var R = 26, C = 2 * Math.PI * R, frac = total ? done / total : 0;
    var svgEl = UI.svg('svg', { viewBox: '0 0 64 64', class: 'az-ring', 'aria-hidden': 'true' });
    svgEl.appendChild(UI.svg('circle', { cx: 32, cy: 32, r: R, class: 'ring-bg' }));
    svgEl.appendChild(UI.svg('circle', { cx: 32, cy: 32, r: R, class: 'ring-fg', 'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': (C * (1 - frac)).toFixed(2), transform: 'rotate(-90 32 32)' }));
    return svgEl;
  }

  function filterControls(onChange) {
    var f = filter();
    var set = function (k, v) { f[k] = v; App.save(); if (onChange) onChange(); App.rerender(); };
    var listBtn = function (v, label) {
      return h('button.tab' + (f.list === v ? '.on' : ''), { type: 'button', 'aria-pressed': String(f.list === v), onclick: function () { set('list', v); } }, label);
    };
    return h('div.az-filters',
      h('div.tabs', { role: 'group', 'aria-label': 'Which list' }, listBtn('68', '6–8 list'), listBtn('911', '9–11 list'), listBtn('both', 'Both lists')),
      h('button.tab' + (f.extreme ? '.on' : ''), { type: 'button', 'aria-pressed': String(f.extreme), onclick: function () { set('extreme', !f.extreme); } },
        f.extreme ? '🔥 Extremely hard words: on' : '🔥 Extremely hard words: off'));
  }

  // ======================================================================
  // A–Z home
  // ======================================================================
  App.screens.az = function (root) {
    var st = App.state, ov = A.overview(App.words, filter(), az().w);
    root.appendChild(h('h1', '🔤 A to Z'));
    root.appendChild(h('p.az-head', 'Letters done: ' + ov.lettersDone + ' of ' + ov.lettersTotal + ' · Words done: ' + fmt(ov.wordsDone) + ' of ' + fmt(ov.wordsTotal)));
    root.appendChild(filterControls());
    var s = st.sessions.az;
    var resume = s && s.phase !== 'done' ? s : null;
    var last = az().last;
    if (resume || last) {
      root.appendChild(h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () {
        if (resume) App.go('azPlay', {}, { autoSpeak: !resume.feedback && resume.card && !resume.card.revealed });
        else startNext(last.letter);
      } }, resume ? '▶ Continue ' + resume.letter + ' · part ' + (resume.part + 1) : '▶ Continue with ' + last.letter)));
    }
    root.appendChild(h('div.az-grid', ov.letters.map(function (t) {
      return h('button.az-tile' + (t.complete ? '.complete' : ''), {
        type: 'button', 'aria-label': 'Letter ' + t.letter + ': ' + t.done + ' of ' + t.total + ' done' + (t.complete ? ', complete' : ''),
        onclick: function () { App.go('azLetter', { letter: t.letter }); }
      },
      h('span.az-ring-box', ring(t.done, t.total), h('span.az-letter', t.letter)),
      h('span.az-count', t.done + ' / ' + t.total),
      t.complete ? h('span.az-check', '✓') : null,
      t.hiddenExtreme ? h('span.az-hidden', '+' + t.hiddenExtreme + ' extremely hard (hidden)') : null);
    })));
    root.appendChild(h('p.muted', 'A word is done once you spell it right here. Each letter is in parts of 20 words, in ABC order.'));
  };

  // ======================================================================
  // One letter
  // ======================================================================
  function startNext(letter) {
    var ps = A.parts(App.words, letter, filter());
    if (!ps.length) { App.go('azLetter', { letter: letter }); return; }
    App.startAzPart(letter, A.nextPart(ps, az().w));
  }

  App.startAzPart = function (letter, idx) {
    var st = App.state;
    var ps = A.parts(App.words, letter, filter());
    if (!ps[idx]) { UI.alert('No words here', 'There are no words in this part with the current choices.'); return; }
    var old = st.sessions.az;
    if (old && old.letter === letter && old.part === idx && old.phase !== 'done') { App.go('azPlay', {}, { autoSpeak: !old.feedback && old.card && !old.card.revealed }); return; }
    var seed = U.hashSeed(letter + idx + ':' + Date.now());
    var sess = A.next(A.startPart(ps[idx], { shuffle: az().shuffle, seed: seed }));
    st.sessions.az = {
      kind: 'az', letter: letter, part: idx, parts: ps.length, range: A.partRange(ps[idx], App.byId),
      sess: sess, card: newCard(sess.current), feedback: null, undo: [], phase: 'card', result: null
    };
    az().last = { letter: letter, part: idx };
    App.go('azPlay', {}, { autoSpeak: true });
  };

  App.screens.azLetter = function (root, params) {
    var L = params.letter || (az().last && az().last.letter) || 'A';
    var st = App.state, status = az().w;
    var ps = A.parts(App.words, L, filter());
    var ids = [].concat.apply([], ps);
    var sum = A.summary(ids, status);
    root.appendChild(h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go('az'); } }, '← A to Z'));
    root.appendChild(h('div.letter-head', h('span.letter-big' + (sum.complete ? '.complete' : ''), L),
      h('div', h('h1', 'Letter ' + L), h('p', 'Words done: ' + sum.done + ' of ' + sum.total + (sum.needs ? ' · ' + sum.needs + ' need practice' : '')),
        sum.complete ? h('p.sticker-won', '🏅 Letter complete!') : null)));
    if (!ps.length) {
      root.appendChild(h('p.panel', 'No words for ' + L + ' with the current choices.'));
      root.appendChild(filterControls());
      return;
    }
    var s = st.sessions.az;
    var resume = s && s.letter === L && s.phase !== 'done' ? s : null;
    var nextIdx = resume ? resume.part : A.nextPart(ps, status);
    root.appendChild(h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () { App.startAzPart(L, nextIdx); } },
      (resume ? '▶ Continue part ' : '▶ Start part ') + (nextIdx + 1) + ' of ' + ps.length)));
    root.appendChild(h('div.row.center',
      h('button.btn', { type: 'button', onclick: function () { App.go('azList', { letter: L }); } }, '📋 Word list'),
      h('button.btn', { type: 'button', disabled: !sum.needs, onclick: function () { App.startBoard({ type: 'azMissed', letter: L }); } },
        "🔁 Practise this letter's missed words" + (sum.needs ? ' (' + sum.needs + ')' : ''))));
    root.appendChild(h('div.parts', ps.map(function (p, i) {
      var ps1 = A.partStatus(p, status), ps2 = A.summary(p, status);
      var label = ps1 === 'done' ? '✓ Done' : ps1 === 'progress' ? 'In progress · ' + ps2.asked + '/' + p.length : 'Not started';
      return h('button.part-row.' + ps1, { type: 'button', onclick: function () { App.startAzPart(L, i); } },
        h('span.part-name', 'Part ' + (i + 1) + ' of ' + ps.length + ': ' + A.partRange(p, App.byId)),
        h('span.part-status', label + (ps2.needs ? ' · ✗ ' + ps2.needs : '')));
    })));
    root.appendChild(filterControls());
  };

  App.screens.azList = function (root, params) {
    var L = params.letter || 'A', status = az().w;
    var words = A.letterWords(App.words, L, filter());
    root.appendChild(h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go('azLetter', { letter: L }); } }, '← Letter ' + L));
    root.appendChild(h('h1', '📋 ' + L + ': every word (' + words.length + ')'));
    root.appendChild(h('p.muted', '✓ done · ✗ needs practice · • not yet'));
    root.appendChild(h('ul.wordlist.az-list', words.map(function (w) {
      var s = status[w.id];
      return h('li.' + (s === 'd' ? 'ok' : s === 'n' ? 'miss' : 'todo'),
        h('span.mark', { 'aria-label': s === 'd' ? 'done' : s === 'n' ? 'needs practice' : 'not yet' }, s === 'd' ? '✓' : s === 'n' ? '✗' : '•'),
        h('button.btn.icon.small', { type: 'button', 'aria-label': 'Say ' + w.display, onclick: function () { UI.card.sayWord(w); } }, '🔊'),
        h('span.w', w.display), w.extreme ? h('span.tag.tricky', 'extremely hard') : null,
        w.meaning ? h('div.m', w.meaning) : null);
    })));
  };

  // ======================================================================
  // Playing a part
  // ======================================================================
  function azNext(s) {
    s.feedback = null;
    if (s.sess.finished) { finishPart(s); return; }
    s.sess = A.next(s.sess);
    if (!s.sess.current) { finishPart(s); return; }
    s.card = newCard(s.sess.current);
    App.save();
    App.render({ keepScroll: true, autoSpeak: true });
  }

  function finishPart(s) {
    s.phase = 'done';
    s.card = null;
    App.save();
    if (s.result && s.result.letterDone) { UI.sounds.trophy(); UI.confetti(); }
    App.rerender();
  }

  function azSwap(s) {
    var cur = s.sess.current;
    if (!s.sess.queue.length) { UI.toast('No other word available'); return; }
    s.sess.queue.push(cur);
    s.sess = A.next(s.sess);
    s.card = newCard(s.sess.current);
    App.save();
    UI.toast('New word, no penalty');
    App.render({ keepScroll: true, autoSpeak: true });
  }

  App.screens.azPlay = function (root, params, opts) {
    var st = App.state, s = st.sessions.az;
    if (!s) { App.go('az'); return; }
    opts = opts || {};
    if (s.phase === 'done') { partDone(root, s); return; }
    if (!s.card) { finishPart(s); return; }
    var word = App.word(s.feedback ? s.feedback.id : s.card.id);
    if (!word) { // a word removed by the parent: skip it
      s.feedback = null;
      azNext(s);
      return;
    }
    var pos = A.position(s.sess);
    root.appendChild(h('div.play-head', h('h1', '🔤 ' + s.letter),
      h('p.counter', { 'aria-live': 'polite' }, s.letter + ' · Part ' + (s.part + 1) + ' of ' + s.parts + ' · word ' + pos.n + ' of ' + pos.total,
        pos.retry && !s.feedback ? h('span.chip.retry', 'second try') : null),
      UI.rewards.meter()));
    var done = s.feedback ? pos.asked : Math.max(0, pos.n - (pos.retry ? 0 : 1));
    root.appendChild(h('div.bar.az-bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(pos.total), 'aria-valuenow': String(done) },
      h('span', { style: { width: (pos.total ? done / pos.total * 100 : 0).toFixed(1) + '%' } })));

    if (s.feedback) {
      var f = s.feedback, extra = [];
      if (f.right) extra.push(h('p', '✓ Done in the A–Z tab!'));
      else if (f.willRetry) extra.push(h('p', 'This word comes back once at the end of the part.'));
      else extra.push(h('p', 'This one goes on the "needs practice" list. You can practise it again later.'));
      root.appendChild(UI.card.feedback({
        word: word, right: f.right, auto: f.auto, fb: f, extra: extra,
        nextLabel: f.partDone ? 'Finish the part ➜' : 'Next word ➜',
        onNext: function () { azNext(s); },
        canUndo: App.canUndo('az'), onUndo: function () { App.undo('az'); }
      }));
      return;
    }
    var card = UI.card.question({
      word: word, card: s.card, autoSpeak: !!opts.autoSpeak,
      header: pos.retry ? h('span.chip', '🔁 One more try at this word') : null,
      onChange: App.save,
      onReveal: function () { App.rerender(); },
      onJudge: function (right, auto) {
        App.answer('az', right, function (sess, r) {
          var id = sess.card.id;
          var res = A.answer(sess.sess, st.az.w[id], r);
          st.az.w[id] = res.mark;
          sess.sess = res.sess;
          sess.feedback.auto = !!auto;
          sess.feedback.willRetry = !r && res.sess.queue.indexOf(id) >= 0;
          if (res.sess.finished) {
            sess.feedback.partDone = true;
            App.givePack('finishing part ' + (sess.part + 1) + ' of ' + sess.letter);
            var letterDone = App.checkLetter(sess.letter);
            sess.result = { letterDone: letterDone, champion: !!letterDone && App.checkChampion() };
          }
        });
        App.rerender();
      },
      canUndo: App.canUndo('az'), onUndo: function () { App.undo('az'); },
      onSwap: function () { azSwap(s); }
    });
    root.appendChild(card);
    root._cleanup = card._cleanup;
  };

  function partDone(root, s) {
    var L = s.letter, res = s.result || {};
    var ps = A.parts(App.words, L, filter());
    var nextIdx = A.nextPart(ps, az().w);
    var letterComplete = A.summary([].concat.apply([], ps), az().w).complete;
    if (res.letterDone) {
      root.appendChild(h('section.celebrate',
        h('div.gold-letter.got.huge', L),
        h('h1', 'Letter ' + L + ' complete!'),
        h('p', 'You won the golden ' + L + ' for your sticker book! 🏅'),
        res.champion ? h('p.sticker-won.champion', '🏆 A to Z Champion! You finished every letter!') : null));
    }
    var missed = s.sess.ids.filter(function (id) { return az().w[id] === 'n'; }).map(function (id) { return App.byId[id]; }).filter(Boolean);
    root.appendChild(h('section.card.center',
      h('p.big-emoji', '🎉'),
      h('h2', L + ' · Part ' + (s.part + 1) + ' of ' + s.parts + ' done!'),
      h('p', s.range),
      h('p', '✓ ' + s.sess.right + ' right · ✗ ' + s.sess.wrong + ' to practise'),
      missed.length ? h('p.muted', 'Needs practice: ' + missed.map(function (w) { return w.display; }).join(', ')) : null,
      h('div.row.center',
        !letterComplete || nextIdx !== s.part ? h('button.btn.big.primary', { type: 'button', onclick: function () { App.startAzPart(L, nextIdx); } }, '▶ Part ' + (nextIdx + 1) + ' ➜') : null,
        h('button.btn.big', { type: 'button', onclick: function () { App.go('azLetter', { letter: L }); } }, 'Back to ' + L),
        h('button.btn.big', { type: 'button', onclick: function () { App.go('az'); } }, '🔤 A to Z'))));
  }

  // ======================================================================
  // 🔥 Extremely hard
  // ======================================================================
  var RANGES = ['A-F', 'G-M', 'N-S', 'T-Z'];

  App.screens.extreme = function (root) {
    var st = App.state, all = App.extremeIds();
    var inPlan = App.plan().list_9_11.indexOf('extreme') >= 0;
    root.appendChild(h('h1', '🔥 Extremely hard'));
    root.appendChild(h('p', 'Rare, technical or foreign words from the 9–11 list: ' + all.length + ' words. Pick a letter range for a short board game.'));
    root.appendChild(h('p.gentle', 'Grown-ups: ' + (inPlan ? "these words are in the study plan, so they also come up in Today's practice."
      : "off the study plan by default. Turn on in the plan if you want them in Today's practice.")));
    root.appendChild(h('div.choices', RANGES.map(function (r) {
      var ids = App.extremeIds(r);
      return h('button.choice', { type: 'button', disabled: !ids.length, onclick: function () { App.startBoard({ type: 'extreme', range: r }); } },
        h('span.choice-emoji', '🔥'), h('span.choice-name', r.replace('-', '–')),
        h('span.choice-sub', S.countMastered(ids, st.progress) + '/' + ids.length + ' mastered'));
    })));
    root.appendChild(h('div.row.center', h('button.btn', { type: 'button', onclick: function () { App.go('extremeList'); } }, '📋 See every word')));
  };

  App.screens.extremeList = function (root) {
    var st = App.state;
    var words = App.extremeIds().map(function (id) { return App.byId[id]; });
    root.appendChild(h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go('extreme'); } }, '← Extremely hard'));
    root.appendChild(h('h1', '📋 Extremely hard words (' + words.length + ')'));
    var by = {};
    words.forEach(function (w) { (by[w.letter] = by[w.letter] || []).push(w); });
    Object.keys(by).sort().forEach(function (L) {
      root.appendChild(h('h2', L));
      root.appendChild(h('ul.wordlist', by[L].map(function (w) {
        var p = st.progress[w.id];
        return h('li' + (S.isMastered(p) ? '.ok' : ''),
          h('span.mark', S.isMastered(p) ? '✓' : ''),
          h('button.btn.icon.small', { type: 'button', 'aria-label': 'Say ' + w.display, onclick: function () { UI.card.sayWord(w); } }, '🔊'),
          h('span.w', w.display), w.meaning ? h('div.m', w.meaning) : null);
      })));
    });
  };
})();
