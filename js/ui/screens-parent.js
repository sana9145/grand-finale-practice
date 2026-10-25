/* Parent area (behind the 3-second hold): plan, settings, strategy, words, import, backup, print, history, reset. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App;
  var P = GF.plan, S = GF.scheduler;

  var AVATARS = ['🦉', '🐱', '🐶', '🦊', '🐼', '🐯', '🦄', '🐸', '🐵', '🐧', '🐰', '🐨', '🦁', '🐢', '🦋', '🐬'];

  function back(to) {
    return h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go(to || 'parent'); } }, '← Back');
  }
  function saved() { App.save(); UI.toast('Saved ✓'); }
  function pct(x) { return x == null ? '–' : Math.round(x * 100) + '%'; }
  function themeLabel(id) { var t = App.bank.themes.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function rowLabel(row) { return row === 'list_9_11' ? '9–11 list' : themeLabel(row); }

  function field(label, control, hint) {
    return h('label.field', h('span.field-label', label), control, hint ? h('span.hint', hint) : null);
  }

  function select(options, value, onchange) {
    var sel = h('select', { onchange: function () { onchange(sel.value); } },
      options.map(function (o) { return h('option', { value: String(o[0]) }, o[1]); }));
    sel.value = String(value);
    return sel;
  }

  // ---------- menu ----------
  App.screens.parent = function (root) {
    root.appendChild(h('h1', '🔓 Parent area'));
    var items = [
      ['plan', '🗺️ Study plan', 'Which tiers and levels to learn'],
      ['strategy', '🧠 Strategy tips', 'Best theme and level to pick in the final'],
      ['settings', '⚙️ Settings', 'Name, voice, timer, daily goal…'],
      ['editor', '✏️ Word editor', 'Search, fix, add or hide words'],
      ['import', '📥 Import words', 'From a CSV file, pasted text or JSON'],
      ['backup', '💾 Export and backup', 'Download or restore'],
      ['print', '🖨 Print lists', 'Word lists on paper'],
      ['history', '📜 Mock history', 'Every Mock Final played'],
      ['reset', '🧹 Reset', 'Clear progress or start over']
    ];
    root.appendChild(h('div.menu', items.map(function (it) {
      return h('button.menu-item', { type: 'button', onclick: function () { App.go(it[0]); } }, h('span.menu-name', it[1]), h('span.menu-sub', it[2]));
    })));
    root.appendChild(h('div.row.center', h('button.btn', { type: 'button', onclick: function () { App.go('home'); } }, '🔒 Lock and go home')));
  };

  // ---------- study plan ----------
  App.screens.plan = function (root) {
    var bank = App.bank;
    var plan = App.plan();
    root.appendChild(back());
    root.appendChild(h('h1', '🗺️ Study plan'));
    root.appendChild(h('p', 'Tick what she should learn before the final. Today\'s practice and the Mock Final follow this plan.'));
    var totalLine = h('p.plan-total', { 'aria-live': 'polite' });
    var fitBox = h('div.fit', { 'aria-live': 'polite' });

    function update() {
      App.state.plan = plan;
      App.replanToday();
      App.save();
      var stt = P.stats(App.words, bank, plan, App.state.progress);
      totalLine.textContent = 'Plan: ' + stt.total + ' words · ' + stt.mastered + ' mastered';
      drawFit(stt.total);
    }

    // Plan size warning and the "Make it fit" suggestion (the parent decides; nothing changes by itself).
    function drawFit(size) {
      UI.clear(fitBox);
      var days = App.daysToFinal(), goal = App.state.settings.dailyGoal;
      if (days <= 0) return;
      var cover = days * goal;
      fitBox.appendChild(h('p' + (cover < size ? '.warn-line' : ''), 'At ' + goal + ' words a day you can cover about ' + cover.toLocaleString('en-GB') +
        ' of ' + size.toLocaleString('en-GB') + ' words before the final.'));
      if (cover >= size) return;
      var fit = P.fitPlan(App.words, bank, plan, cover);
      if (!fit.steps.length) return;
      var names = fit.steps.map(function (st) { return rowLabel(st.row) + ' ' + (st.tier === 'extreme' ? 'Extremely hard' : cap(st.tier)); });
      fitBox.appendChild(h('button.btn', { type: 'button', onclick: function () {
        UI.confirm('Make the plan fit?', ['This unticks: ' + names.join(', ') + '.',
          'The plan goes from ' + size + ' to ' + fit.size + ' words.' + (fit.fits ? '' : ' (Even then it is more than ' + cover + ', but it is the closest with only hard tiers unticked.)'),
          'Progress is kept. You can tick them again any time.'], 'Untick them').then(function (ok) {
          if (!ok) return;
          plan = fit.plan; update(); App.rerender(); UI.toast('Plan updated');
        });
      } }, '✂️ Make it fit: untick ' + names.join(', ')));
    }

    var box = function (checked, onchange, label) {
      var cb = h('input', { type: 'checkbox', 'aria-label': label });
      cb.checked = checked;
      cb.addEventListener('change', function () { onchange(cb.checked); update(); });
      return cb;
    };
    var cell = function (cb, ids) {
      return h('td', h('label.tick', cb, h('span.count', S.countMastered(ids, App.state.progress) + '/' + ids.length)));
    };

    var rows = bank.themes.map(function (t) {
      return h('tr', h('th', t.emoji + ' ' + t.label), P.TIERS.map(function (tier) {
        var ids = P.themePool(App.words, bank, t.id, tier);
        return cell(box(plan[t.id].indexOf(tier) >= 0, function (on) {
          plan[t.id] = P.TIERS.filter(function (x) { return x === tier ? on : plan[t.id].indexOf(x) >= 0; });
        }, t.label + ' ' + tier), ids);
      }));
    });
    var r2cells = P.TIERS.map(function (l) {
      var ids = P.round2Pool(App.words, bank, l, plan.round2.focus_only);
      return cell(box(plan.round2.levels.indexOf(l) >= 0, function (on) {
        plan.round2.levels = P.TIERS.filter(function (x) { return x === l ? on : plan.round2.levels.indexOf(x) >= 0; });
      }, 'Round 2 ' + l), ids);
    });
    rows.push(h('tr', h('th', '📈 Round 2'), r2cells));
    rows.forEach(function (r) { r.appendChild(h('td.na', '')); });
    rows.push(h('tr', h('th', '📚 9–11 list'), P.BANDS.map(function (b) {
      var ids = P.bandPool(App.words, bank, b);
      return cell(box(plan.list_9_11.indexOf(b) >= 0, function (on) {
        plan.list_9_11 = P.BANDS.filter(function (x) { return x === b ? on : plan.list_9_11.indexOf(x) >= 0; });
      }, '9–11 list ' + b), ids);
    })));
    root.appendChild(h('div.table-wrap', h('table.grid.plan-grid',
      h('thead', h('tr', h('th', ''), h('th', 'Easy'), h('th', 'Medium'), h('th', 'Hard'), h('th', 'Extremely hard'))), h('tbody', rows))));
    root.appendChild(h('p.hint', 'Tick Hard for the one or two themes she is strongest in. (Numbers show mastered / total.) Extremely hard 9–11 words are off by default; they also have their own tab.'));

    var focus = h('input', { type: 'checkbox' });
    focus.checked = plan.round2.focus_only;
    focus.addEventListener('change', function () { plan.round2.focus_only = focus.checked; update(); App.rerender(); });
    root.appendChild(h('label.tick.big-tick', focus, h('span', ' Round 2: focus words only (recommended)')));
    root.appendChild(totalLine);
    root.appendChild(fitBox);
    root.appendChild(h('div.row',
      h('button.btn', { type: 'button', onclick: function () { plan = P.defaultPlan(bank); update(); App.rerender(); UI.toast('Default plan restored'); } }, 'Use the default plan')));
    root.appendChild(h('div.panel.small-text',
      h('p', h('b', 'Tiers: '), 'Easy = ' + bank.theme_tiers.easy + ' Medium = ' + bank.theme_tiers.medium + ' Hard = ' + bank.theme_tiers.hard),
      h('p', h('b', 'Round 2: '), bank.round2_focus_about),
      h('p', h('b', '9–11 list: '), P.BANDS.map(function (b) { return cap(b) + ' = ' + (bank.bands_9_11 || {})[b]; }).join(' '))));
    update();
  };

  // ---------- settings ----------
  App.screens.settings = function (root) {
    var st = App.state, s = st.settings, p = st.profile;
    root.appendChild(back());
    root.appendChild(h('h1', '⚙️ Settings'));
    var set = function (k, v) { s[k] = v; saved(); };

    var name = h('input', { type: 'text', maxlength: '30', value: p.name, autocomplete: 'off' });
    name.addEventListener('change', function () { p.name = name.value.trim() || 'Speller'; saved(); });
    var avatars = h('div.avatars', AVATARS.map(function (a) {
      return h('button.avatar-btn' + (a === p.avatar ? '.on' : ''), { type: 'button', 'aria-label': 'Avatar ' + a, 'aria-pressed': String(a === p.avatar), onclick: function () { p.avatar = a; saved(); App.rerender(); } }, a);
    }));
    root.appendChild(h('section.panel', h('h2', 'Player'), field('Name', name), h('div.field', h('span.field-label', 'Avatar'), avatars)));

    var date = h('input', { type: 'date', value: App.finalDate() });
    date.addEventListener('change', function () { if (/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { s.finalDate = date.value; saved(); } });
    root.appendChild(h('section.panel', h('h2', 'Practice'),
      field('Final date', date, 'From the data: ' + App.bank.finale_format.final_date),
      field('Daily goal (answers)', select([[20, '20'], [30, '30'], [40, '40'], [60, '60']], s.dailyGoal, function (v) { set('dailyGoal', +v); })),
      field('Who judges', select([['parent', 'Parent judges'], ['self', 'Self-check']], s.judge, function (v) { set('judge', v); })),
      field('Mock uses', select([['plan', 'My plan'], ['all', 'Everything']], s.mockUses, function (v) { set('mockUses', v); })),
      field('Mock round 2 uses', select([['focus', 'Focus only'], ['focus911', 'Focus + 9–11 (default)'], ['all', 'Everything']], s.mockR2, function (v) { set('mockR2', v); }),
        'Focus + 9–11 adds the plan\'s 9–11 words of the chosen level. Extremely hard words only come in if the plan has them.'),
      field('Board length', select([[10, '10 squares'], [20, '20 squares'], [30, '30 squares']], s.boardLength, function (v) { set('boardLength', +v); }), 'Applies to new boards.'),
      field('Wrong answer on boards', select([['back', 'Back 1'], ['stay', 'Stay']], s.boardWrong, function (v) { set('boardWrong', v); }), 'Applies to new boards.'),
      field('Show meaning and sentence text', select([['true', 'On'], ['false', 'Off']], String(s.showText), function (v) { set('showText', v === 'true'); }), 'The word is always hidden in the text.'),
      field('Sound-alike badge', select([['true', 'On'], ['false', 'Off']], String(s.soundAlike), function (v) { set('soundAlike', v === 'true'); })),
      field('Sound effects', select([['true', 'On'], ['false', 'Off']], String(s.sfx), function (v) { set('sfx', v === 'true'); UI.sounds.setEnabled(s.sfx); })),
      field('Brain break after 20 minutes', select([['true', 'On'], ['false', 'Off']], String(s.brainBreak), function (v) { set('brainBreak', v === 'true'); }), 'A one-minute stretch. You can always skip it.'),
      field('Theme background', select([['true', 'On'], ['false', 'Off']], String(s.themeBg !== false), function (v) { set('themeBg', v === 'true'); App.rerender(); }),
        'Shows the board theme she picked in the sticker book behind the whole app.'),
      field('The owl says a cheer', select([['true', 'Every few right answers'], ['false', 'Off']], String(s.cheerVoice), function (v) { set('cheerVoice', v === 'true'); }))));

    var a = st.az;
    root.appendChild(h('section.panel', h('h2', '🔤 A–Z tab'),
      field('List', select([['both', 'Both lists'], ['68', '6–8 list'], ['911', '9–11 list']], a.filter.list, function (v) { a.filter.list = v; saved(); })),
      field('Include extremely hard words', select([['true', 'On'], ['false', 'Off']], String(a.filter.extreme), function (v) { a.filter.extreme = v === 'true'; saved(); }),
        'When off, each letter shows how many are hidden.'),
      field('Shuffle within each part', select([['false', 'Off (ABC order)'], ['true', 'On']], String(a.shuffle), function (v) { a.shuffle = v === 'true'; saved(); }), 'Applies to the next part she starts.')));

    var custom = h('input', { type: 'number', min: '5', max: '300', value: String(s.timerCustom), 'aria-label': 'Custom seconds' });
    custom.addEventListener('change', function () { var n = Math.max(5, Math.min(300, parseInt(custom.value, 10) || 30)); custom.value = String(n); set('timerCustom', n); });
    root.appendChild(h('section.panel', h('h2', 'Timer'),
      field('Timer', select([['off', 'Off'], ['rules', '20 s + 20 s (rules)'], ['30', '30 s'], ['custom', 'Custom']], s.timer, function (v) { set('timer', v); }),
        '20 s + 20 s: 20 seconds to ask questions, then 20 seconds to spell (the question buttons lock).'),
      field('Custom seconds', custom),
      field('When time runs out', select([['show', 'Just show "Time!"'], ['wrong', 'Count as wrong']], s.timeUp, function (v) { set('timeUp', v); }))));

    // voice
    var sp = UI.speech;
    var voices = sp.englishVoices();
    var vsel = select([['', 'Automatic (best English voice)']].concat(voices.map(function (v) { return [v.voiceURI, v.name + ' (' + v.lang + ')']; })),
      s.voiceURI || '', function (v) { s.voiceURI = v || null; sp.configure(s); sp.retry(); saved(); });
    var rate = h('input', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.rate) });
    var rateVal = h('span.range-val', String(s.rate));
    rate.addEventListener('input', function () { rateVal.textContent = rate.value; });
    rate.addEventListener('change', function () { s.rate = +rate.value; sp.configure(s); saved(); });
    var pitch = h('input', { type: 'range', min: '0.5', max: '1.5', step: '0.05', value: String(s.pitch) });
    var pitchVal = h('span.range-val', String(s.pitch));
    pitch.addEventListener('input', function () { pitchVal.textContent = pitch.value; });
    pitch.addEventListener('change', function () { s.pitch = +pitch.value; sp.configure(s); saved(); });
    var status = sp.mode() === 'parent'
      ? (s.speech === 'parent' ? 'Parent reads mode is on.' : 'No working voice: Parent reads mode is on. ' + (sp.failReason || ''))
      : 'Voice: ' + (sp.voice ? sp.voice.name + ' (' + sp.voice.lang + ')' : 'default');
    root.appendChild(h('section.panel', h('h2', 'Pronouncer voice'),
      h('p.muted', status),
      field('Pronouncer', select([['auto', 'Device voice (automatic)'], ['parent', 'Parent reads the words']], s.speech, function (v) { s.speech = v; sp.configure(s); sp.retry(); saved(); App.rerender(); })),
      voices.length ? field('Voice', vsel) : h('p.muted', 'No English voices were found on this device.'),
      field('Speed', h('span.range', rate, rateVal), '0.85 is a calm, clear speed.'),
      field('Pitch', h('span.range', pitch, pitchVal)),
      field('Letter name for z', select([['zed', 'zed'], ['zee', 'zee']], s.zName, function (v) { set('zName', v); })),
      h('div.row', h('button.btn', { type: 'button', onclick: function () { sp.retry(); sp.say('Hello! Your word is: elephant. Elephant.'); } }, '🔊 Test the voice'),
        h('button.btn', { type: 'button', onclick: function () { sp.say(null, { list: GF.letterNames.spellOut('zebra', s.zName), gap: 220 }); } }, '🔤 Test spelling'))));
  };

  // ---------- strategy tips ----------
  App.screens.strategy = function (root) {
    var st = App.state, bank = App.bank, fmt = bank.finale_format, St = GF.strategy;
    root.appendChild(back());
    root.appendChild(h('h1', '🧠 Strategy tips'));
    var tt = St.themeTip(st.log, App.byId, bank.themes);
    var best = tt.best ? bank.themes.filter(function (t) { return t.id === tt.best; })[0] : null;
    root.appendChild(h('section.panel', h('h2', 'Round 1: which theme?'),
      h('p.tip', best ? 'Pick ' + best.emoji + ' ' + best.label + ': her best accuracy lately.' : 'Not enough practice yet (each theme needs 10 answers).'),
      h('div.table-wrap', h('table.grid', h('thead', h('tr', h('th', 'Theme'), h('th', 'Answers'), h('th', 'Right'))),
        h('tbody', tt.rows.map(function (r) {
          return h('tr' + (r.theme === tt.best ? '.best' : ''), h('td', r.emoji + ' ' + r.label), h('td', String(r.answers)), h('td', r.enough ? pct(r.accuracy) : 'not enough practice yet'));
        })))),
      h('p.muted.small', 'Based on her last ' + St.WINDOW + ' answers in each theme.')));

    var lt = St.levelTip(st.log, App.byId, fmt);
    var bestL = lt.rows.filter(function (r) { return r.level === lt.best; })[0];
    root.appendChild(h('section.panel', h('h2', 'Round 2: which level?'),
      h('p.tip', bestL ? 'Pick ' + bestL.label + ': about ' + bestL.expected.toFixed(1) + ' points per word.' : 'Not enough practice yet (each level needs 10 answers).'),
      h('div.table-wrap', h('table.grid', h('thead', h('tr', h('th', 'Level'), h('th', 'Answers'), h('th', 'Right'), h('th', 'Points per word'))),
        h('tbody', lt.rows.map(function (r) {
          return h('tr' + (r.level === lt.best ? '.best' : ''), h('td', r.label + ' (+' + r.points + ')'), h('td', String(r.answers)),
            h('td', r.enough ? pct(r.accuracy) : 'not enough practice yet'), h('td', r.enough ? r.expected.toFixed(1) : '–'));
        })))),
      h('p.muted.small', 'Points per word = right% × points − wrong% × ' + Math.abs(fmt.round2.points_wrong) + '. Example: Hard at 70% = 0.7 × 20 − 0.3 × 5 = 12.5, which beats Medium at 100% = 10.')));

    var mm = St.mostMissed(st.progress, App.byId, 15);
    root.appendChild(h('section.panel', h('h2', 'Most missed words'),
      mm.length ? h('ul.wordlist', mm.map(function (m) {
        var w = App.byId[m.id];
        return h('li', h('button.btn.icon.small', { type: 'button', 'aria-label': 'Say ' + w.display, onclick: function () { UI.card.sayWord(w); } }, '🔊'),
          h('span.w', w.display), h('span.muted', ' missed ' + m.wrong + '×, right ' + m.right + '×'));
      })) : h('p.muted', 'No missed words yet.')));
  };

  // ---------- word editor ----------
  var editorState = { q: '', source: '', band: '', theme: '', tier: '', pattern: '', level: '', focus: '', review: '', hidden: '', page: 0 };

  App.screens.editor = function (root) {
    var es = editorState, bank = App.bank;
    root.appendChild(back());
    root.appendChild(h('h1', '✏️ Word editor'));
    root.appendChild(h('div.row', h('button.btn.primary', { type: 'button', onclick: function () { App.go('wordForm', { id: null }); } }, '➕ Add a word'),
      h('button.btn', { type: 'button', onclick: function () { App.go('import'); } }, '📥 Import words')));

    var q = h('input', { type: 'search', placeholder: 'Search words, meanings…', value: es.q, 'aria-label': 'Search' });
    var list = h('div.word-rows');
    var pager = h('div.row.center');
    var countLine = h('p.muted');
    var f = function (key, opts) {
      return select([['', opts[0]]].concat(opts.slice(1)), es[key], function (v) { es[key] = v; es.page = 0; draw(); });
    };
    var filters = h('div.filters',
      f('source', ['Any source', ['official_2026', 'Official 2026 (6–8)'], ['official_2026_9_11', 'Official 2026 (9–11)'], ['asked_2025', 'Asked 2025'], ['finale_theme_extra', 'Theme extra'], ['added', 'Added by you']]),
      f('band', ['Any 9–11 band', ['easy', '9–11 easy'], ['medium', '9–11 medium'], ['hard', '9–11 hard'], ['extreme', '9–11 extremely hard']]),
      f('theme', ['Any theme'].concat(bank.themes.map(function (t) { return [t.id, t.label]; })).concat([['none', 'No theme']])),
      f('tier', ['Any tier', ['easy', 'Easy tier'], ['medium', 'Medium tier'], ['hard', 'Hard tier']]),
      f('pattern', ['Any pattern'].concat((bank.silent_patterns || []).map(function (p) { return [p.id, p.label]; }))),
      f('level', ['Any level', ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]),
      f('focus', ['Focus: any', ['yes', 'Round-2 focus'], ['no', 'Not focus']]),
      f('review', ['Review: any', ['yes', 'Needs review']]),
      f('hidden', ['Shown + hidden', ['shown', 'Shown only'], ['hidden', 'Hidden only']]));
    var timer = null;
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { es.q = q.value; es.page = 0; draw(); }, 200); });
    root.appendChild(h('div.panel', q, filters));
    root.appendChild(countLine);
    root.appendChild(list);
    root.appendChild(pager);

    function matches(w) {
      var s = es.q.trim().toLowerCase();
      if (s && w.word.indexOf(s) < 0 && (w.meaning || '').toLowerCase().indexOf(s) < 0 && (w.notes || '').toLowerCase().indexOf(s) < 0) return false;
      if (es.source && (w.sources || []).indexOf(es.source) < 0) return false;
      if (es.band && w.band_9_11 !== es.band) return false;
      if (es.theme === 'none' ? (w.themes || []).length : es.theme && (w.themes || []).indexOf(es.theme) < 0) return false;
      if (es.tier && !Object.keys(w.theme_tier || {}).some(function (t) { return (!es.theme || es.theme === t) && w.theme_tier[t] === es.tier; })) return false;
      if (es.pattern && w.silent_pattern !== es.pattern) return false;
      if (es.level && w.level !== es.level) return false;
      if (es.focus === 'yes' && !w.round2_focus) return false;
      if (es.focus === 'no' && w.round2_focus) return false;
      if (es.review === 'yes' && !w.needs_review) return false;
      if (es.hidden === 'shown' && w.hidden) return false;
      if (es.hidden === 'hidden' && !w.hidden) return false;
      return true;
    }

    function draw() {
      var all = App.words.filter(matches).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var pages = Math.max(1, Math.ceil(all.length / 50));
      if (es.page >= pages) es.page = pages - 1;
      var shown = all.slice(es.page * 50, es.page * 50 + 50);
      countLine.textContent = all.length + ' word' + (all.length === 1 ? '' : 's');
      UI.clear(list);
      shown.forEach(function (w) {
        var meta = [cap(w.level), (w.themes || []).map(function (t) { return themeLabel(t) + ' ' + w.theme_tier[t]; }).join(', ')];
        if (w.round2_focus) meta.push('focus');
        if (w.band_9_11) meta.push('9–11 ' + (w.band_9_11 === 'extreme' ? 'extremely hard' : w.band_9_11));
        if (w.hidden) meta.push('HIDDEN');
        if (w.needs_review) meta.push('needs review');
        if (w.origin !== 'base') meta.push(w.origin === 'added' ? 'added' : 'edited');
        list.appendChild(h('div.word-row' + (w.hidden ? '.is-hidden' : ''),
          h('button.btn.icon.small', { type: 'button', 'aria-label': 'Say ' + w.display, onclick: function () { UI.card.sayWord(w); } }, '🔊'),
          h('button.word-open', { type: 'button', onclick: function () { App.go('wordForm', { id: w.id }); } },
            h('span.w', w.display), h('span.muted.small', meta.filter(Boolean).join(' · ')))));
      });
      UI.clear(pager);
      if (pages > 1) {
        pager.appendChild(h('button.btn', { type: 'button', disabled: es.page === 0, onclick: function () { es.page--; draw(); window.scrollTo(0, 0); } }, '← Previous'));
        pager.appendChild(h('span', ' Page ' + (es.page + 1) + ' of ' + pages + ' '));
        pager.appendChild(h('button.btn', { type: 'button', disabled: es.page >= pages - 1, onclick: function () { es.page++; draw(); window.scrollTo(0, 0); } }, 'Next →'));
      }
    }
    draw();
  };

  // ---------- word form ----------
  App.screens.wordForm = function (root, params) {
    var bank = App.bank, st = App.state;
    var existing = params.id ? App.byId[params.id] : null;
    var isNew = !existing;
    var rec = existing ? GF.util.clone(GF.overlay.strip(existing)) : GF.overlay.complete({ word: '', difficulty: 2 }, App.levels());
    var touched = { silent: false, difficulty: false };
    root.appendChild(back('editor'));
    root.appendChild(h('h1', isNew ? '➕ Add a word' : '✏️ ' + existing.display));

    var word = h('input', { type: 'text', value: existing ? existing.display : '', maxlength: '40', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    if (!isNew) word.disabled = true;
    var display = h('input', { type: 'text', value: rec.display || '', maxlength: '40' });
    var pos = h('input', { type: 'text', value: rec.pos || '', list: 'pos-list', placeholder: 'noun, verb, noun/verb…' });
    var posList = h('datalist', { id: 'pos-list' }, ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'determiner', 'number', 'noun/verb', 'noun/adjective'].map(function (x) { return h('option', { value: x }); }));
    var meaning = h('textarea', { rows: 2, value: rec.meaning || '' });
    var sentence = h('textarea', { rows: 2, value: rec.sentence || '' });
    var sayAs = h('input', { type: 'text', value: rec.say_as || '', placeholder: 'Optional: how the voice should say it' });
    var notes = h('input', { type: 'text', value: rec.notes || '' });
    var spellNote = h('input', { type: 'text', value: rec.spelling_note || '', placeholder: 'e.g. British spelling. American spelling: color.' });
    // Which official list (puts the word in the A-Z tab). Fixed for words from the word list.
    var listsEditable = isNew || existing.origin === 'added';
    var on68 = h('input', { type: 'checkbox' }); on68.checked = (rec.sources || []).indexOf('official_2026') >= 0;
    var on911 = h('input', { type: 'checkbox' }); on911.checked = (rec.sources || []).indexOf('official_2026_9_11') >= 0;
    var band = select([['', 'Guess from difficulty'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['extreme', 'Extremely hard']], rec.band_9_11 || '', function () {});
    [on68, on911, band].forEach(function (el) { el.disabled = !listsEditable; });
    band.disabled = !listsEditable || !on911.checked;
    on911.addEventListener('change', function () { band.disabled = !on911.checked; });
    var diff = select([[1, '1 · easy'], [2, '2 · medium'], [3, '3 · tricky'], [4, '4 · hard'], [5, '5 · hardest']], rec.difficulty, function () { touched.difficulty = true; showLevel(); });
    var levelOut = h('span.hint');
    var focus = h('input', { type: 'checkbox' }); focus.checked = !!rec.round2_focus;
    var silent = h('input', { type: 'text', value: (rec.silent_letters || []).join('; '), placeholder: 'e.g. k   or   k; gh' });
    silent.addEventListener('input', function () { touched.silent = true; });
    var pattern = select([['', '(none)']].concat((bank.silent_patterns || []).map(function (p) { return [p.id, p.label]; })), rec.silent_pattern || '', function () { touched.silent = true; });
    var warn = h('div.warnings', { 'aria-live': 'polite' });

    function showLevel() { levelOut.textContent = '→ Level: ' + cap(GF.difficulty.levelFor(+diff.value, App.levels())); }
    showLevel();

    // themes + tiers
    var themeBoxes = {};
    var themeRows = bank.themes.map(function (t) {
      var cb = h('input', { type: 'checkbox' }); cb.checked = (rec.themes || []).indexOf(t.id) >= 0;
      var tier = select([['', 'Pick a tier…'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], (rec.theme_tier || {})[t.id] || '', function () {});
      tier.disabled = !cb.checked;
      cb.addEventListener('change', function () { tier.disabled = !cb.checked; if (!cb.checked) tier.value = ''; });
      themeBoxes[t.id] = { cb: cb, tier: tier };
      return h('div.theme-row', h('label.tick', cb, h('span', ' ' + t.emoji + ' ' + t.label)), tier);
    });

    // For new words: suggest silent letters, pattern and difficulty from the rules.
    word.addEventListener('input', function () {
      var w = word.value.trim().toLowerCase();
      display.value = word.value.trim();
      if (!touched.silent) {
        var sl = GF.silentRules.suggest(w, bank.silent_letter_rules, bank.silent_letter_exceptions);
        silent.value = sl.join('; ');
        pattern.value = GF.silentRules.suggestPattern(sl, bank.silent_patterns) || '';
      }
      if (!touched.difficulty && w) { diff.value = String(GF.difficulty.estimate(w, bank.silent_letter_rules, bank.silent_letter_exceptions)); showLevel(); }
    });

    root.appendChild(posList);
    root.appendChild(h('section.panel',
      field('Word (exact spelling)', word, isNew ? 'Letters a–z, spaces, hyphens or apostrophes. American spelling, like the official list.' : 'The spelling of an existing word can\'t change. Hide it and add a new one instead.'),
      field('Display (with capitals for names)', display),
      field('Part of speech', pos),
      field('Meaning', meaning, 'If empty, the word is marked "needs review".'),
      field('Sentence', sentence, 'Should use the word.'),
      field('Say as (optional)', sayAs),
      h('div.field', h('span.field-label', 'Difficulty'), diff, levelOut),
      h('label.tick', focus, h('span', ' Round-2 focus word')),
      h('div.field', h('span.field-label', 'Themes (tick, then pick a tier)'), themeRows),
      field('Silent letters', silent, 'Highlighted when the word is revealed.'),
      field('Silent pattern (needed for the Silent letters theme)', pattern),
      field('Notes', notes),
      field('Spelling note (shown after Check)', spellNote),
      h('div.field', h('span.field-label', 'Official list (A–Z tab)'),
        h('label.tick', on68, h('span', ' On the 6–8 list')), h('label.tick', on911, h('span', ' On the 9–11 list')),
        field('9–11 band', band), listsEditable ? null : h('span.hint', 'Fixed for words from the official word list.')),
      existing ? h('p.muted.small', 'Text source: ' + (existing.text_source || '–') + ' · Sources: ' + (existing.sources || []).join(', ') + (existing.page ? ' · PDF page ' + existing.page : '')) : null,
      warn));

    function collect() {
      var errs = [], warns = [];
      var typed = word.value.trim().replace(/\s+/g, ' ');
      var w = (existing ? existing.word : typed.toLowerCase());
      if (!w) errs.push('Type the word.');
      else if (!/^[a-z' -]{1,40}$/.test(w)) errs.push('The word can only use letters a–z, spaces, hyphens or apostrophes (up to 40).');
      var themes = [], tiers = {};
      bank.themes.forEach(function (t) {
        var b = themeBoxes[t.id];
        if (b.cb.checked) {
          themes.push(t.id);
          if (!b.tier.value) errs.push('Pick a tier for ' + t.label + '.');
          else tiers[t.id] = b.tier.value;
        }
      });
      if (themes.indexOf('silent_letter') >= 0 && !pattern.value) errs.push('Pick a silent pattern for a Silent letters word.');
      var disp = display.value.trim() || typed || w;
      if (disp.toLowerCase() !== w) disp = w;
      var r = Object.assign({}, rec, {
        word: w, id: GF.util.idOf(w), display: disp, pos: pos.value.trim().toLowerCase(), meaning: meaning.value.trim(),
        sentence: sentence.value.trim(), say_as: sayAs.value.trim(), notes: notes.value.trim(), difficulty: +diff.value,
        round2_focus: focus.checked, themes: themes, theme_tier: tiers,
        silent_letters: silent.value.split(/[;,\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean),
        silent_pattern: pattern.value || null, spelling_note: spellNote.value.trim()
      });
      if (listsEditable) {
        r.sources = (on68.checked ? ['official_2026'] : []).concat(on911.checked ? ['official_2026_9_11'] : [])
          .concat((rec.sources || []).filter(function (x) { return x !== 'official_2026' && x !== 'official_2026_9_11' && x !== 'added'; }), ['added']);
        r.band_9_11 = on911.checked ? (band.value || null) : null;
      }
      r.level = GF.difficulty.levelFor(r.difficulty, App.levels());
      r.needs_review = !r.meaning;
      if (!r.meaning) warns.push('No meaning yet: the word will be marked "needs review".');
      if (r.sentence && w && !GF.mask.leaks(r.sentence, w)) warns.push('The sentence doesn\'t seem to contain the word.');
      return { rec: r, errs: errs, warns: warns };
    }

    function showWarnings(c) {
      UI.clear(warn);
      c.errs.forEach(function (e) { warn.appendChild(h('p.err', '⚠️ ' + e)); });
      c.warns.forEach(function (e) { warn.appendChild(h('p.warn', 'ℹ️ ' + e)); });
    }
    [sentence, meaning].forEach(function (el) { el.addEventListener('change', function () { showWarnings(collect()); }); });

    function save() {
      var c = collect();
      showWarnings(c);
      if (c.errs.length) return;
      if (isNew && App.byId[c.rec.id]) {
        UI.modal({ title: 'This word is already in the bank', body: '"' + App.byId[c.rec.id].display + '" already exists.', dismissValue: false,
          buttons: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Edit the existing word', value: true, cls: 'primary' }] })
          .then(function (yes) { if (yes) App.go('wordForm', { id: c.rec.id }); });
        return;
      }
      var r = c.rec;
      if (isNew) { r.text_source = 'added_by_parent'; r.page = null; r.final_2025 = null; r.sound_alike_with = []; }
      st.overlay = GF.overlay.saveWord(st.overlay, GF.overlay.complete(r, App.levels()), !isNew && existing.origin !== 'added');
      App.refreshWords();
      App.save();
      UI.toast(isNew ? 'Word added ✓' : 'Changes saved ✓');
      App.go('editor');
    }

    var actions = h('div.row', h('button.btn.primary.big', { type: 'button', onclick: save }, isNew ? '➕ Add word' : '💾 Save changes'));
    if (existing && existing.origin !== 'added') {
      actions.appendChild(h('button.btn', { type: 'button', onclick: function () {
        var hide = !existing.hidden;
        UI.confirm(hide ? 'Hide this word?' : 'Show this word again?',
          hide ? '"' + existing.display + '" will stop appearing in practice, boards, the Mock Final and print lists. Its progress is kept. You can show it again any time.'
            : '"' + existing.display + '" will appear in practice again.', hide ? 'Hide it' : 'Show it').then(function (ok) {
          if (!ok) return;
          st.overlay = GF.overlay.setHidden(st.overlay, existing.id, hide);
          App.refreshWords(); App.save(); App.go('editor');
        });
      } }, existing.hidden ? '👁 Show this word' : '🙈 Hide this word'));
      if (existing.origin === 'edited') {
        actions.appendChild(h('button.btn', { type: 'button', onclick: function () {
          UI.confirm('Undo your changes?', 'Your edits to "' + existing.display + '" will be removed and the original from the word list comes back.', 'Undo my changes').then(function (ok) {
            if (!ok) return;
            st.overlay = GF.overlay.revert(st.overlay, existing.id);
            App.refreshWords(); App.save(); App.go('editor');
          });
        } }, '↩ Undo my changes'));
      }
    }
    if (existing && existing.origin === 'added') {
      actions.appendChild(h('button.btn.danger', { type: 'button', onclick: function () {
        UI.confirm('Delete this word?', '"' + existing.display + '" (a word you added) will be deleted from the word list. Its practice progress is kept in case you add it again.', 'Delete', true).then(function (ok) {
          if (!ok) return;
          st.overlay = GF.overlay.deleteAdded(st.overlay, existing.id);
          App.refreshWords(); App.save(); App.go('editor');
        });
      } }, '🗑 Delete word'));
    }
    root.appendChild(actions);
  };

  // ---------- import ----------
  var importState = { kind: 'csv', text: '', fileName: '', theme: '', tier: 'easy', list: '', band: '', preview: null };

  App.screens.import = function (root) {
    var is = importState, bank = App.bank;
    root.appendChild(back());
    root.appendChild(h('h1', '📥 Import words'));
    root.appendChild(h('p', 'Add words from a CSV file (like add-words-template.csv or words.csv), from typed or pasted text, or from a JSON word list. Nothing is saved until you tap Import.'));

    var tabs = h('div.tabs', [['csv', '📄 CSV file'], ['text', '📋 Paste words'], ['json', '🧾 JSON file']].map(function (t) {
      return h('button.tab' + (is.kind === t[0] ? '.on' : ''), { type: 'button', 'aria-pressed': String(is.kind === t[0]), onclick: function () { is.kind = t[0]; is.text = ''; is.fileName = ''; is.preview = null; App.rerender(); } }, t[1]);
    }));
    root.appendChild(tabs);

    var input;
    if (is.kind === 'text') {
      input = h('textarea', { rows: 6, placeholder: 'One word per line, or separated by commas', value: is.text });
      input.addEventListener('input', function () { is.text = input.value; is.preview = null; });
    } else {
      input = h('input', { type: 'file', accept: is.kind === 'csv' ? '.csv,text/csv' : '.json,application/json' });
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        UI.readFile(f).then(function (t) { is.text = t; is.fileName = f.name; is.preview = null; UI.toast('Loaded ' + f.name); App.rerender(); },
          function (e) { UI.alert('Could not read the file', String(e.message || e)); });
      });
    }
    root.appendChild(h('section.panel',
      is.kind === 'text' ? input : field(is.fileName ? 'Loaded: ' + is.fileName + ' (choose another?)' : 'Choose a file', input),
      h('div.row',
        field('Put new words in theme', select([['', '(none)']].concat(bank.themes.map(function (t) { return [t.id, t.label]; })), is.theme, function (v) { is.theme = v; is.preview = null; })),
        field('Tier', select([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], is.tier, function (v) { is.tier = v; is.preview = null; }))),
      h('div.row',
        field('New words are on', select([['', 'No official list'], ['911', 'The 9–11 list'], ['68', 'The 6–8 list']], is.list, function (v) { is.list = v; is.preview = null; App.rerender(); }),
          'Words on an official list go into the A–Z tab.'),
        is.list === '911' ? field('9–11 band', select([['', 'Guess from the word'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['extreme', 'Extremely hard']], is.band, function (v) { is.band = v; is.preview = null; })) : null),
      h('p.hint', 'The theme, tier, list and band fill in anything the file leaves empty (a file can have sources and band_9_11 columns).'),
      h('button.btn.primary', { type: 'button', onclick: function () {
        if (!is.text.trim()) { UI.toast(is.kind === 'text' ? 'Type or paste some words first' : 'Choose a file first'); return; }
        is.preview = GF.importMerge.preview(is.text, is.kind, { bank: bank, defaultTheme: is.theme || null, defaultTier: is.tier, defaultList: is.list, defaultBand: is.band }, App.byId);
        App.rerender();
      } }, '👀 Preview')));

    if (is.preview) renderPreview(root, is);
  };

  function renderPreview(root, is) {
    var pv = is.preview;
    var importBtn = h('button.btn.big.primary', { type: 'button' });
    function refreshCount() {
      var n = GF.importMerge.countToImport(pv);
      importBtn.textContent = 'Import ' + n + ' word' + (n === 1 ? '' : 's');
      importBtn.disabled = n === 0;
    }
    var group = function (title, items, render, open) {
      var d = h('details.group', { open: !!open }, h('summary', title + ' (' + items.length + ')'));
      if (items.length) d.appendChild(h('ul.plain', items.slice(0, 300).map(render)));
      if (items.length > 300) d.appendChild(h('p.muted', '…and ' + (items.length - 300) + ' more'));
      return d;
    };
    var sec = h('section.panel', h('h2', 'Preview'));
    sec.appendChild(group('🆕 New', pv.fresh, function (r) {
      return h('li', h('b', r.display), ' · ' + cap(r.level) + (r.themes.length ? ' · ' + r.themes.map(function (t) { return themeLabel(t) + ' ' + r.theme_tier[t]; }).join(', ') : '') +
        (r._lists.indexOf('official_2026') >= 0 ? ' · 6–8 list' : '') + (r.band_9_11 ? ' · 9–11 ' + r.band_9_11 : '') + (r.needs_review ? ' · needs review' : ''));
    }, true));
    sec.appendChild(group('✔️ Same as the bank (skipped)', pv.same, function (d) { return h('li', d.rec.display); }, false));
    var diffBox = group('✳️ Different from the bank', pv.different, function (d) {
      var mine = h('input', { type: 'radio', name: 'd-' + d.rec.id }); mine.checked = d.choice !== 'imported';
      var imp = h('input', { type: 'radio', name: 'd-' + d.rec.id }); imp.checked = d.choice === 'imported';
      mine.addEventListener('change', function () { d.choice = 'mine'; refreshCount(); });
      imp.addEventListener('change', function () { d.choice = 'imported'; refreshCount(); });
      return h('li.diff', h('b', d.rec.display), h('span.muted', ' changes: ' + d.fields.join(', ')),
        h('div.small', d.fields.slice(0, 3).map(function (f) {
          var a = d.existing[f], b = d.rec[f];
          var show = function (v) { return Array.isArray(v) ? v.join('; ') : v && typeof v === 'object' ? Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join('; ') : String(v === undefined || v === null || v === '' ? '(empty)' : v); };
          return h('div', f + ': ', h('span.old', show(a)), ' → ', h('span.new', show(b)));
        })),
        h('div.row', h('label.tick', mine, ' Keep mine'), h('label.tick', imp, ' Use imported')));
    }, true);
    if (pv.different.length) {
      diffBox.insertBefore(h('div.row',
        h('button.btn.small', { type: 'button', onclick: function () { GF.importMerge.setAll(pv, 'mine'); App.rerender(); } }, 'Keep mine for all'),
        h('button.btn.small', { type: 'button', onclick: function () { GF.importMerge.setAll(pv, 'imported'); App.rerender(); } }, 'Use imported for all')), diffBox.childNodes[1] || null);
    }
    sec.appendChild(diffBox);
    sec.appendChild(group('⚠️ Problems', pv.problems, function (p) { return h('li', 'Row ' + p.row + (p.word ? ' (' + p.word + ')' : '') + ': ' + p.reason); }, pv.problems.length > 0));
    importBtn.addEventListener('click', function () {
      var r = GF.importMerge.apply(App.state.overlay, pv, App.levels());
      App.state.overlay = r.overlay;
      App.refreshWords();
      App.save();
      is.preview = null; is.text = ''; is.fileName = '';
      var s = r.summary;
      UI.alert('Import done', [s.added + ' new word' + (s.added === 1 ? '' : 's') + ' added.', s.updated + ' word' + (s.updated === 1 ? '' : 's') + ' updated.',
        s.kept + ' kept as they were.', s.skipped + ' already the same (skipped).', s.problems + ' row' + (s.problems === 1 ? '' : 's') + ' with problems (not imported).']).then(function () { App.rerender(); });
    });
    refreshCount();
    sec.appendChild(h('div.row.center', importBtn));
    root.appendChild(sec);
  }

  // ---------- export and backup ----------
  App.screens.backup = function (root) {
    var st = App.state, bank = App.bank, day = App.today();
    root.appendChild(back());
    root.appendChild(h('h1', '💾 Export and backup'));
    var last = st.backup.lastAt ? new Date(st.backup.lastAt).toLocaleString() : 'never';
    root.appendChild(h('section.panel', h('h2', 'Backup (progress, plan, settings, your words)'),
      h('p', 'Last backup: ' + last + '. Keep the file somewhere safe (email it to yourself, or save it to Google Drive / iCloud).'),
      h('div.row',
        h('button.btn.primary', { type: 'button', onclick: function () { App.doBackupDownload(); UI.toast('Backup downloaded'); App.rerender(); } }, '⬇️ Download backup'),
        h('button.btn.ghost.small', { type: 'button', onclick: function () { UI.showText('spelling-backup-' + day + '.json', JSON.stringify(GF.storage.makeBackup(st, Date.now()), null, 1)); } }, 'Download didn\'t work? Show the text')),
      App.embedded ? h('p.gentle', 'In this hosted version the backup is shown as text to copy. The progress on this device is separate from any other device; a backup moves it across.') : null));

    var file = h('input', { type: 'file', accept: '.json,application/json' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      UI.readFile(f).then(restoreFrom, function (e) { UI.alert('Could not read the file', String(e.message || e)); });
    });
    function restoreFrom(text) {
      (function () {
        var r = GF.storage.readBackup(text, Date.now());
        if (!r.ok) { UI.alert('This backup can\'t be used', r.error); return; }
        var s = r.summary;
        UI.confirm('Restore this backup?', [
          'Saved: ' + (s.savedAt ? new Date(s.savedAt).toLocaleString() : 'unknown'),
          'Player: ' + s.avatar + ' ' + s.name,
          'Progress for ' + s.words + ' words · ' + s.mocks + ' Mock Finals · ' + s.added + ' added, ' + s.edited + ' edited, ' + s.hidden + ' hidden words.',
          s.stickers + ' different stickers · ' + s.azDone + ' words done in A–Z · ' + (s.dressItems || 0) + ' dress-up items.',
          'This REPLACES everything in this browser now (progress, plan, settings, word changes and mock history) with the backup. A copy of the current data is kept in this browser first.'
        ], 'Replace with backup', true).then(function (ok) {
          if (!ok) return;
          try { App.storage.setItem('spellingWhizz.beforeRestore.' + Date.now(), JSON.stringify(App.state)); } catch (e) { /* ignore */ }
          App.state = r.state;
          App.state.overlay = GF.overlay.adoptOrphans(App.bank.words, App.state.overlay);
          App.refreshWords();
          UI.sounds.setEnabled(App.state.settings.sfx);
          UI.speech.configure(App.state.settings);
          App.save();
          UI.toast('Backup restored ✓');
          App.go('parent');
        });
      })();
    }
    var pasted = h('textarea', { rows: 4, placeholder: 'Or paste the backup text here', 'aria-label': 'Backup text' });
    root.appendChild(h('section.panel', h('h2', 'Restore a backup'), field('Choose a backup file (.json)', file),
      field('…or paste the backup text', pasted),
      h('button.btn', { type: 'button', onclick: function () {
        if (!pasted.value.trim()) { UI.toast('Paste the backup text first'); return; }
        restoreFrom(pasted.value);
      } }, '📋 Restore from pasted text')));

    var bankText = function () { return JSON.stringify(GF.exporter.bankJSON(bank, App.words, day), null, 1); };
    var csvText = function () { return GF.exporter.bankCSV(App.words); };
    root.appendChild(h('section.panel', h('h2', 'Word bank'),
      h('p', 'The full word list including your changes, in the same format as words.json / words.csv. Hidden words are left out.'),
      h('div.row',
        h('button.btn', { type: 'button', onclick: function () { UI.download('words-' + day + '.json', bankText(), 'application/json'); } }, '⬇️ Download word bank (JSON)'),
        h('button.btn', { type: 'button', onclick: function () { UI.download('words-' + day + '.csv', csvText(), 'text/csv'); } }, '⬇️ Download CSV')),
      h('div.row',
        h('button.btn.ghost.small', { type: 'button', onclick: function () { UI.showText('words-' + day + '.json', bankText()); } }, 'Show JSON as text'),
        h('button.btn.ghost.small', { type: 'button', onclick: function () { UI.showText('words-' + day + '.csv', csvText()); } }, 'Show CSV as text'))));
  };

  // ---------- print lists ----------
  var printState = { kind: 'theme', theme: 'geography', tier: 'easy', pattern: 'k', level: 'easy', focus: 'true', band: 'easy', letter: 'A' };

  App.screens.print = function (root) {
    var ps = printState, bank = App.bank;
    root.appendChild(h('div.no-print', back(), h('h1', '🖨 Print lists')));
    var opts = h('div.row.no-print');
    var kind = select([['theme', 'Theme + tier'], ['pattern', 'Silent-letter pattern'], ['round2', 'Round 2 level'], ['band', '9–11 band'], ['letter', 'A–Z letter'],
      ['missed', 'Missed words'], ['plan', 'Whole study plan']], ps.kind, function (v) { ps.kind = v; App.rerender(); });
    opts.appendChild(field('List', kind));
    if (ps.kind === 'theme') {
      opts.appendChild(field('Theme', select(bank.themes.map(function (t) { return [t.id, t.label]; }), ps.theme, function (v) { ps.theme = v; App.rerender(); })));
      opts.appendChild(field('Tier', select([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['all', 'All']], ps.tier, function (v) { ps.tier = v; App.rerender(); })));
    }
    if (ps.kind === 'band') opts.appendChild(field('Band', select([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['extreme', 'Extremely hard']], ps.band, function (v) { ps.band = v; App.rerender(); })));
    if (ps.kind === 'letter') opts.appendChild(field('Letter', select(GF.az.LETTERS.map(function (L) { return [L, L]; }), ps.letter, function (v) { ps.letter = v; App.rerender(); })));
    if (ps.kind === 'pattern') opts.appendChild(field('Pattern', select((bank.silent_patterns || []).map(function (p) { return [p.id, p.label]; }), ps.pattern, function (v) { ps.pattern = v; App.rerender(); })));
    if (ps.kind === 'round2') {
      opts.appendChild(field('Level', select([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], ps.level, function (v) { ps.level = v; App.rerender(); })));
      opts.appendChild(field('Words', select([['true', 'Focus words'], ['false', 'All words']], ps.focus, function (v) { ps.focus = v; App.rerender(); })));
    }
    root.appendChild(opts);

    var ids, title;
    if (ps.kind === 'theme') { ids = P.themePool(App.words, bank, ps.theme, ps.tier); title = themeLabel(ps.theme) + ' · ' + cap(ps.tier); }
    else if (ps.kind === 'pattern') { ids = P.patternPool(App.words, bank, ps.pattern); title = (bank.silent_patterns.filter(function (p) { return p.id === ps.pattern; })[0] || {}).label; }
    else if (ps.kind === 'round2') { ids = P.round2Pool(App.words, bank, ps.level, ps.focus === 'true'); title = 'Round 2 · ' + cap(ps.level) + (ps.focus === 'true' ? ' · focus words' : ' · all words'); }
    else if (ps.kind === 'band') { ids = P.bandPool(App.words, bank, ps.band); title = '9–11 list · ' + (ps.band === 'extreme' ? 'Extremely hard' : cap(ps.band)); }
    else if (ps.kind === 'letter') { ids = GF.az.letterIds(App.words, ps.letter, App.state.az.filter); title = 'A–Z · ' + ps.letter; }
    else if (ps.kind === 'missed') { ids = App.words.filter(function (w) { return !w.hidden && S.isMissed(App.state.progress[w.id]); }).map(function (w) { return w.id; }); title = 'Words to fix'; }
    else { ids = P.planIds(App.words, bank, App.plan()); title = 'Study plan'; }
    var words = ids.map(function (id) { return App.byId[id]; }).filter(Boolean).sort(GF.az.compare);

    root.appendChild(h('div.row.no-print', h('button.btn.primary.print-btn', { type: 'button', onclick: function () { window.print(); } }, '🖨 Print this list (' + words.length + ' words)')));
    if (App.embedded) root.appendChild(h('p.gentle.no-print', 'Printing is not available in this hosted version. Open index.html from the app folder on a laptop to print. The list is below.'));
    root.appendChild(h('div.print-sheet',
      h('h2.print-title', 'Grand Finale Practice · ' + title + ' (' + words.length + ' words)'),
      words.length ? h('ol.plist', words.map(function (w) {
        return h('li', h('span.pw', w.display), w.pos ? h('span.pp', ' (' + w.pos + ')') : null,
          w.meaning ? h('span.pm', w.meaning) : null, w.sentence ? h('span.ps', w.sentence) : null);
      })) : h('p', 'No words in this list.')));
  };

  // ---------- mock history ----------
  App.screens.history = function (root) {
    var st = App.state;
    root.appendChild(back());
    root.appendChild(h('h1', '📜 Mock history'));
    var list = st.mockHistory.slice().reverse();
    if (!list.length) root.appendChild(h('p.muted', 'No Mock Finals yet.'));
    root.appendChild(h('div.menu', list.map(function (m) {
      return h('button.menu-item', { type: 'button', onclick: function () { App.go('historyItem', { id: m.id }); } },
        h('span.menu-name', m.date + ' · ' + m.total + ' points'), h('span.menu-sub', 'Round 1: ' + m.r1Score + ' · Round 2: ' + m.r2Score));
    })));
    if (st.legacyHistory.length) {
      root.appendChild(h('h2', "Last year's final replays"));
      root.appendChild(h('ul.plain', st.legacyHistory.slice().reverse().map(function (x) {
        return h('li', x.date + ' · ' + x.finalist + ' words: ' + x.total + ' points');
      })));
    }
  };

  App.screens.historyItem = function (root, params) {
    var m = App.state.mockHistory.filter(function (x) { return x.id === params.id; })[0];
    root.appendChild(h('div.no-print', back('history')));
    if (!m) { root.appendChild(h('p', 'Not found.')); return; }
    var sheet = h('div.print-sheet', h('h1', 'Mock Final · ' + m.date), h('p.bigscore', m.total + ' / ' + App.bank.finale_format.max_total),
      h('p', 'Round 1: ' + m.r1Score + ' · Round 2: ' + m.r2Score));
    [['Round 1: Themes', m.round1], ['Round 2: Difficulty', m.round2]].forEach(function (pair) {
      sheet.appendChild(h('h2', pair[0]));
      sheet.appendChild(h('ul.wordlist', (pair[1] || []).map(function (e) {
        var w = App.byId[e.id];
        return h('li.' + (e.right ? 'ok' : 'miss'), h('span.mark', e.right ? '✓' : '✗'),
          w ? h('button.btn.icon.small.no-print', { type: 'button', 'aria-label': 'Say it', onclick: function () { UI.card.sayWord(w); } }, '🔊') : null,
          h('span.w', e.word), h('span.muted', ' ' + (pair[0].indexOf('1') >= 0 ? themeLabel(e.choice) : cap(e.choice)) + ' · ' + (e.points > 0 ? '+' : '') + e.points));
      })));
    });
    root.appendChild(sheet);
    root.appendChild(h('div.row.no-print', h('button.btn.print-btn', { type: 'button', onclick: function () { window.print(); } }, '🖨 Print')));
  };

  // ---------- reset ----------
  App.screens.reset = function (root) {
    var st = App.state;
    root.appendChild(back());
    root.appendChild(h('h1', '🧹 Reset'));
    root.appendChild(h('p', 'Tip: download a backup first, so you can undo a reset.'));
    root.appendChild(h('div.row', h('button.btn', { type: 'button', onclick: function () { App.doBackupDownload(); UI.toast('Backup downloaded'); } }, '⬇️ Download backup first')));

    var nWords = Object.keys(st.progress).length;
    var opts = [
      {
        label: 'Clear practice progress', title: 'Clear practice progress?',
        lines: ['This deletes: progress for ' + nWords + ' words (mastered, missed, reviews), the answer log for strategy tips, the day streak, the A–Z progress, the sticker book (' +
          GF.stickers.total(st.rewards) + ' stickers, ' + st.rewards.stars + ' stars, badges and trophies), the dress-up wardrobe (' + GF.dress.counts(st.dress).owned + ' items), and any game in progress.',
          'This keeps: the study plan, settings, your word changes, and the Mock history.'],
        run: function () {
          st.progress = {}; st.log = []; st.activity = {}; st.profile.stickers = 0; st.sessions = {};
          st.rewards = GF.stickers.blank(); st.az.w = {}; st.az.last = null; st.dress = GF.dress.blank();
        }
      },
      {
        label: 'Reset A–Z progress', title: 'Reset the A–Z progress?',
        lines: ['This clears which words are done or need practice in the A–Z tab (' + Object.keys(st.az.w).length + ' words) and the part in progress.',
          'Nothing else changes: practice progress, stickers, golden letters, the plan and settings are kept.'],
        run: function () { st.az.w = {}; st.az.last = null; st.sessions.az = null; }
      },
      {
        label: 'Clear Mock history', title: 'Clear the Mock history?',
        lines: ['This deletes ' + st.mockHistory.length + ' saved Mock Finals and ' + st.legacyHistory.length + " Last year's final replays (and the personal best).", 'Everything else is kept.'],
        run: function () { st.mockHistory = []; st.legacyHistory = []; if (st.sessions.mock) st.sessions.mock = null; }
      },
      {
        label: 'Reset everything', title: 'Reset EVERYTHING?',
        lines: ['This deletes all progress, stickers, Mock history, the study plan, all settings (name, avatar, voice, timer…) and all your word changes (' +
          st.overlay.added.length + ' added, ' + Object.keys(st.overlay.edited).length + ' edited, ' + st.overlay.hidden.length + ' hidden).',
          'The app goes back to how it was the first time it was opened. The original word list is not affected.'],
        run: function () { var fresh = GF.storage.defaultState(Date.now()); Object.keys(st).forEach(function (k) { delete st[k]; }); Object.assign(st, fresh); }
      }
    ];
    root.appendChild(h('div.menu', opts.map(function (o) {
      return h('button.menu-item.danger-item', { type: 'button', onclick: function () {
        UI.confirm(o.title, o.lines, o.label, true).then(function (ok) {
          if (!ok) return;
          o.run();
          App.refreshWords();
          UI.sounds.setEnabled(st.settings.sfx);
          UI.speech.configure(st.settings);
          App.save();
          UI.toast('Done');
          App.rerender();
        });
      } }, h('span.menu-name', o.label), h('span.menu-sub', o.lines[0]));
    })));
  };
})();
