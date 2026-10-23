/* The question card shared by every mode, the reveal, and the after-answer feedback.
   The word itself never enters the page before Check. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});
  var h = UI.h;

  // The owl never says the same line twice in a row, and speaks a short cheer only every few right answers.
  var lastLine = null, rightsSinceSpoken = 0;

  function S() { return UI.speech; }
  function settings() { return window.App.state.settings; }

  function wordSpeech(w) { return w.say_as || w.word; }

  function sayWord(w, onend) { return S().say(wordSpeech(w), { onend: onend }); }

  function spellIt(w) {
    S().say(null, { list: window.GF.letterNames.spellOut(w.word, settings().zName), gap: 220 });
  }

  // ---------- reveal: big spaced letters with silent letters and double letters marked ----------
  function letters(w) {
    var bank = window.App.bank;
    var display = String(w.display || w.word);
    if (display.toLowerCase() !== w.word) display = w.word;
    var located = window.GF.silentRules.locate(w.word, w.silent_letters || [], bank.silent_letter_rules);
    var silentIdx = {};
    located.forEach(function (x) { x.indexes.forEach(function (i) { silentIdx[i] = true; }); });
    var row = h('div.letters', { 'aria-label': display });
    var k = -1; // index into the word without spaces/hyphens
    var chars = display.split('');
    chars.forEach(function (ch, i) {
      if (ch === ' ') { row.appendChild(h('span.gap', { 'aria-hidden': 'true' }, ' ')); return; }
      if (ch === '-') { row.appendChild(h('span.letter.hyphen', '-')); return; }
      k++;
      var lower = ch.toLowerCase();
      var dbl = /[a-z]/i.test(ch) && ((chars[i - 1] || '').toLowerCase() === lower || (chars[i + 1] || '').toLowerCase() === lower);
      var cls = 'span.letter' + (silentIdx[k] ? '.silent' : '') + (dbl ? '.double' : '');
      row.appendChild(h(cls, ch));
    });
    return { row: row, lines: window.GF.silentRules.describe(located) };
  }

  function revealBlock(w, opts) {
    opts = opts || {};
    var L = letters(w);
    var tags = [];
    if (/ /.test(w.word)) tags.push(h('span.tag', 'Two words'));
    if (/-/.test(w.word)) tags.push(h('span.tag', 'Has a hyphen'));
    if ((w.silent_letters || []).length) tags.push(h('span.tag.silent-tag', '🤫 Silent letter'));
    if (w.final_2025 && w.final_2025.finalist_right === false) tags.push(h('span.tag.tricky', 'Tricky last year'));
    return h('div.reveal',
      L.row,
      tags.length ? h('div.tags', tags) : null,
      L.lines.map(function (t) { return h('p.silent-line', t); }),
      w.notes ? h('p.notes', '📝 ' + w.notes) : null,
      w.spelling_note ? h('p.spelling-note', 'ℹ️ ' + w.spelling_note + ' Spell it the way it is shown here.') : null,
      h('div.row.center',
        h('button.btn', { type: 'button', onclick: function () { spellIt(w); } }, '🔤 Spell it for me'),
        h('button.btn', { type: 'button', onclick: function () { sayWord(w); } }, '🔊 Say it')),
      opts.full === false ? null : h('div.fulltext',
        w.meaning ? h('p', h('b', 'Meaning: '), w.meaning) : null,
        w.sentence ? h('p', h('b', 'Sentence: '), w.sentence) : null,
        w.pos ? h('p.muted', w.pos) : null)
    );
  }

  // ---------- timer ----------
  function phasesFor(st) {
    if (st.timer === 'rules') return [{ name: 'Ask', secs: 20 }, { name: 'Spell', secs: 20 }];
    if (st.timer === '30') return [{ name: 'Spell', secs: 30 }];
    if (st.timer === 'custom') return [{ name: 'Spell', secs: Math.max(5, Math.min(300, Number(st.timerCustom) || 30)) }];
    return [];
  }

  function Timer(phases, hooks) {
    var R = 26, C = 2 * Math.PI * R;
    var svgEl = UI.svg('svg', { viewBox: '0 0 64 64', width: '64', height: '64', 'aria-hidden': 'true' });
    var bg = UI.svg('circle', { cx: 32, cy: 32, r: R, class: 'ring-bg' });
    var fg = UI.svg('circle', { cx: 32, cy: 32, r: R, class: 'ring-fg', 'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': '0', transform: 'rotate(-90 32 32)' });
    svgEl.appendChild(bg); svgEl.appendChild(fg);
    var num = h('span.ring-num', '');
    var label = h('span.ring-label', 'Timer');
    var el = h('div.timer', { role: 'timer', 'aria-live': 'off' }, h('div.ring', svgEl, num), label);
    var phase = 0, left = phases.length ? phases[0].secs * 1000 : 0, running = false, last = 0, iv = null, over = false;
    function draw() {
      var p = phases[phase];
      if (!p) return;
      var frac = Math.max(0, left / (p.secs * 1000));
      fg.setAttribute('stroke-dashoffset', (C * (1 - frac)).toFixed(2));
      num.textContent = over ? '0' : String(Math.ceil(left / 1000));
      label.textContent = UI.safe(over ? 'Time!' : running ? p.name : 'Starts when the word is said');
      el.classList.toggle('low', !over && left < 5000);
      el.classList.toggle('over', over);
    }
    function tick() {
      var now = Date.now();
      var dt = now - last; last = now;
      if (S().speaking || document.hidden) return; // pause while speech plays or the page is hidden
      left -= dt;
      if (left <= 0) {
        if (phase < phases.length - 1) { phase++; left = phases[phase].secs * 1000; if (hooks.onPhase) hooks.onPhase(phases[phase].name); }
        else { left = 0; over = true; stop(); draw(); if (hooks.onEnd) hooks.onEnd(); return; }
      }
      draw();
    }
    function start() { if (running || over || !phases.length) return; running = true; last = Date.now(); iv = setInterval(tick, 100); draw(); }
    function stop() { clearInterval(iv); iv = null; }
    draw();
    return { el: el, start: start, stop: stop, isOver: function () { return over; } };
  }

  // ---------- question card ----------
  // opts: {word, card, header, onChange, onReveal, onJudge(right, auto), canUndo, onUndo, onSwap, autoSpeak,
  //        choiceUndo:{label, fn}, judgeLabel}
  function question(opts) {
    var w = opts.word, card = opts.card;
    card.asked = card.asked || {};
    var st = settings();
    var parentMode = S().mode() === 'parent';
    var root = h('section.card', { 'aria-label': 'Spelling question' });
    var timer = null;
    var askLocked = false;

    function changed() { if (opts.onChange) opts.onChange(); }

    if (opts.header) root.appendChild(h('div.card-head', opts.header));

    if (card.revealed) {
      // ---- after Check ----
      root.appendChild(revealBlock(w));
      var judged = false;
      var right = h('button.btn.big.right', { type: 'button' }, '✓ Right');
      var wrong = h('button.btn.big.wrong', { type: 'button' }, '✗ Not quite');
      var judge = function (val) {
        if (judged) return;
        judged = true;
        right.disabled = true; wrong.disabled = true;
        opts.onJudge(val, false);
      };
      right.addEventListener('click', function () { judge(true); });
      wrong.addEventListener('click', function () { judge(false); });
      root.appendChild(h('p.judge-q', st.judge === 'self' ? 'Did you spell it right?' : 'Parent: was it spelled right?'));
      root.appendChild(h('div.row.judge', right, wrong));
      if (opts.canUndo) root.appendChild(h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: opts.onUndo }, '↩ Undo last answer')));
      window.App.keyHandler = function (e) {
        var k = e.key;
        if (k === 'y' || k === 'Y' || k === 'ArrowRight') { judge(true); return true; }
        if (k === 'n' || k === 'N' || k === 'ArrowLeft') { judge(false); return true; }
        if (k === ' ') { sayWord(w); return true; }
        if ((k === 'u' || k === 'U') && opts.canUndo) { opts.onUndo(); return true; }
        return false;
      };
      return root;
    }

    // ---- before Check ----
    window.App.hiddenWord = w.word; // App.render masks it anywhere else on the page
    var phases = phasesFor(st);
    var info = h('div.info', { 'aria-live': 'polite' });
    var sayBtn = h('button.btn.big.say', { type: 'button' }, card.spoken ? '🔊 Say again' : '🔊 Hear the word');
    var qBtns = [];
    var timeMsg = h('p.time-msg', '');

    function markSpoken() {
      if (!card.spoken) {
        card.spoken = true;
        sayBtn.textContent = UI.safe('🔊 Say again');
        if (choiceRow) choiceRow.remove();
        changed();
      }
      if (timer) timer.start();
    }

    function speakWord() {
      if (askLocked) return;
      if (parentMode) { markSpoken(); UI.toast('Parent: read the word aloud'); return; }
      sayWord(w);
      markSpoken();
    }
    sayBtn.addEventListener('click', speakWord);

    function showInfo() {
      UI.clear(info);
      var showText = st.showText || parentMode;
      if (card.asked.pos) info.appendChild(h('p', h('b', 'Part of speech: '), w.pos || 'not known'));
      if (card.asked.meaning) info.appendChild(h('p', h('b', 'Meaning: '), showText ? (w.meaning ? window.GF.mask.mask(w.meaning, w.word) : 'No meaning yet.') : '(said aloud)'));
      if (card.asked.sentence) info.appendChild(h('p', h('b', 'Sentence: '), showText ? (w.sentence ? window.GF.mask.mask(w.sentence, w.word) : 'No sentence yet.') : '(said aloud)'));
    }

    function ask(kind) {
      if (askLocked) return;
      card.asked[kind] = true;
      changed();
      showInfo();
      if (kind === 'meaning') S().say(w.meaning ? window.GF.mask.mask(w.meaning, w.word).replace(/_____/g, 'blank') : 'Sorry, there is no meaning for this word yet.');
      if (kind === 'sentence') {
        // Speak the real sentence (that is what the pronouncer does); the text on screen stays masked.
        S().say(w.sentence || 'Sorry, there is no sentence for this word yet.');
      }
      if (kind === 'pos') S().say(window.GF.letterNames.posPhrase(w.pos));
      markSpoken();
    }

    var mBtn = h('button.btn.q', { type: 'button', onclick: function () { ask('meaning'); } }, '📖 Meaning');
    var sBtn = h('button.btn.q', { type: 'button', onclick: function () { ask('sentence'); } }, '💬 Sentence');
    var pBtn = h('button.btn.q', { type: 'button', onclick: function () { ask('pos'); } }, '🏷️ Part of speech');
    qBtns = [sayBtn, mBtn, sBtn, pBtn];

    var top = h('div.card-top');
    if (phases.length) {
      timer = Timer(phases, {
        onPhase: function (name) {
          if (name === 'Spell') {
            askLocked = true;
            qBtns.forEach(function (b) { b.disabled = true; });
            timeMsg.textContent = UI.safe('Asking time is over. Now spell it!');
            UI.sounds.tap();
          }
        },
        onEnd: function () {
          timeMsg.textContent = UI.safe('Time!');
          UI.sounds.time();
          if (st.timeUp === 'wrong' && !card.revealed) {
            card.revealed = true;
            changed();
            opts.onJudge(false, true);
          }
        }
      });
      top.appendChild(timer.el);
      // Redrawn after the word was already heard (e.g. after a reload): the timer starts again.
      // On a fresh page load it waits for the word to be said again.
      if (card.spoken && !opts.autoSpeak && !window.App.resuming) setTimeout(function () { timer.start(); }, 0);
    }
    if (st.soundAlike && (w.sound_alike_with || []).length) {
      top.appendChild(h('p.badge', '👂 This word has a sound-alike. Ask for the meaning!'));
    }
    if (top.childNodes.length) root.appendChild(top);

    root.appendChild(h('div.say-row', sayBtn));
    root.appendChild(h('div.row.qrow', mBtn, sBtn, pBtn));
    root.appendChild(timeMsg);
    root.appendChild(info);
    showInfo();

    if (parentMode) root.appendChild(parentPanel(w));

    var checkBtn = h('button.btn.big.check', { type: 'button' }, '✔ Check');
    var check = function () {
      if (card.revealed) return;
      if (timer) timer.stop();
      S().stop();
      card.revealed = true;
      changed();
      opts.onReveal();
    };
    checkBtn.addEventListener('click', check);
    root.appendChild(h('div.row.center', checkBtn));

    var choiceRow = null;
    if (opts.choiceUndo && !card.spoken) {
      choiceRow = h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: opts.choiceUndo.fn }, opts.choiceUndo.label));
      root.appendChild(choiceRow);
    }

    var foot = h('div.row.center.foot');
    if (opts.canUndo) foot.appendChild(h('button.btn.ghost', { type: 'button', onclick: opts.onUndo }, '↩ Undo last answer'));
    if (opts.onSwap) foot.appendChild(UI.holdButton('Parent: voice unclear, new word', 1200, opts.onSwap, 'small'));
    if (foot.childNodes.length) root.appendChild(foot);

    window.App.keyHandler = function (e) {
      var k = e.key;
      if (k === ' ') { speakWord(); return true; }
      if (k === 'm' || k === 'M') { ask('meaning'); return true; }
      if (k === 's' || k === 'S') { ask('sentence'); return true; }
      if (k === 'p' || k === 'P') { ask('pos'); return true; }
      if (k === 'Enter') { check(); return true; }
      if ((k === 'u' || k === 'U') && opts.canUndo) { opts.onUndo(); return true; }
      return false;
    };

    if (opts.autoSpeak) speakWord();
    root._cleanup = function () { if (timer) timer.stop(); };
    return root;
  }

  // Parent reads mode: the word lives only in a panel built when the parent taps it.
  function parentPanel(w) {
    var box = h('div.parent-panel');
    var open = false;
    var btn = h('button.btn.parent-btn', { type: 'button' }, '👀 Parent: tap to see the word to read aloud');
    var content = null;
    btn.addEventListener('click', function () {
      open = !open;
      if (open) {
        content = h('div.parent-word',
          h('p.pw', w.display),
          w.say_as ? h('p.muted', 'Say it like: ' + w.say_as) : null,
          h('p.muted', 'Read it twice, clearly. Then tap here again to hide it.'));
        box.appendChild(content);
        btn.textContent = '🙈 Hide the word';
      } else {
        if (content) content.remove();
        content = null;
        btn.textContent = '👀 Parent: tap to see the word to read aloud';
      }
    });
    box.appendChild(h('p.muted', '🗣️ Parent reads mode: no voice is available, so a grown-up reads the word.'));
    box.appendChild(btn);
    return box;
  }

  // ---------- after the answer ----------
  // opts: {word, right, fb (the session's feedback record: keeps the owl's line and the rewards), extra (node|string),
  //        onNext, nextLabel, canUndo, onUndo, auto (time ran out)}
  function feedback(opts) {
    var w = opts.word;
    var M = window.GF.mascot;
    var fb = opts.fb || {};
    var fresh = !fb.line; // first time this answer is shown (not a redraw or a reload)
    if (fresh) { fb.line = opts.right ? M.cheer(lastLine) : M.kind(lastLine); lastLine = fb.line; }
    var line = fb.line;
    var msg = opts.auto ? 'Time ran out. ' + line : line;
    var ev = fb.rewards || null;
    if (fresh) {
      var spokeSticker = !!(ev && ev.sticker && UI.rewards && UI.rewards.sayName(ev.sticker));
      if (opts.right && !spokeSticker && settings().cheerVoice && S().mode() !== 'parent' && ++rightsSinceSpoken >= 4) {
        rightsSinceSpoken = 0;
        S().say(line);
      }
    }
    var next = h('button.btn.big.primary.next', { type: 'button', onclick: function () { opts.onNext(); } }, opts.nextLabel || 'Next word ➜');
    var root = h('section.card.feedback' + (opts.right ? '.is-right' : '.is-wrong'),
      h('div.owl', h('span.owl-face', { 'aria-hidden': 'true' }, '🦉'), h('p.fb-msg', (opts.right ? '⭐ ' : '💛 ') + msg)),
      ev && UI.rewards ? UI.rewards.feedbackLines(ev) : null,
      opts.extra ? h('div.fb-extra', opts.extra) : null,
      revealBlock(w, { full: !opts.right }),
      h('div.row.center', next),
      opts.canUndo ? h('div.row.center', h('button.btn.ghost', { type: 'button', onclick: opts.onUndo }, '↩ Undo last answer')) : null);
    window.App.keyHandler = function (e) {
      var k = e.key;
      if (k === 'Enter') { opts.onNext(); return true; }
      if (k === ' ') { sayWord(w); return true; }
      if ((k === 'u' || k === 'U') && opts.canUndo) { opts.onUndo(); return true; }
      return false;
    };
    setTimeout(function () { try { next.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return root;
  }

  UI.card = { question: question, feedback: feedback, revealBlock: revealBlock, sayWord: sayWord, spellIt: spellIt };
})();
