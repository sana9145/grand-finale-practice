/* Home and My progress. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App;

  function pct(x) { return x == null ? '–' : Math.round(x * 100) + '%'; }

  function countdown() {
    var d = App.daysToFinal();
    if (d > 1) return d + ' days to the final';
    if (d === 1) return '1 day to the final!';
    if (d === 0) return 'The final is today! You can do it! 🌟';
    return 'The final was on ' + App.finalDate() + '.';
  }

  App.doBackupDownload = function () {
    var st = App.state;
    var text = JSON.stringify(GF.storage.makeBackup(st, Date.now()), null, 1);
    UI.download('spelling-backup-' + App.today() + '.json', text, 'application/json');
    st.backup.lastAt = Date.now();
    st.backup.answersSince = 0;
    st.backup.remindAfter = Date.now();
    App.save();
  };

  App.screens.home = function (root) {
    var st = App.state;
    var stats = GF.plan.stats(App.words, App.bank, App.plan(), st.progress);
    var day = App.today();
    var todayCount = (st.activity[day] && st.activity[day].today) || 0;
    var goal = st.settings.dailyGoal;

    root.appendChild(h('div.hello',
      h('span.avatar', { 'aria-hidden': 'true' }, st.profile.avatar),
      h('div', h('h1', 'Hi, ' + st.profile.name + '!'), h('p.countdown', '📅 ' + countdown()))));

    var frac = stats.total ? stats.mastered / stats.total : 0;
    root.appendChild(h('div.planbar',
      h('div.planbar-text', 'Plan: ' + stats.mastered + ' of ' + stats.total + ' words mastered'),
      h('div.bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(stats.total), 'aria-valuenow': String(stats.mastered) },
        h('span', { style: { width: (frac * 100).toFixed(1) + '%' } }))));

    if (GF.storage.needsBackupReminder(st, Date.now())) {
      root.appendChild(h('div.notice.backup',
        h('span', '💾 Grown-ups: time to save a backup of the practice, in case this browser loses it.'),
        h('div.row',
          h('button.btn.small.primary', { type: 'button', onclick: function () { App.doBackupDownload(); App.rerender(); } }, 'Download backup'),
          h('button.btn.small.ghost', { type: 'button', onclick: function () { st.backup.answersSince = 0; st.backup.remindAfter = Date.now(); App.save(); App.rerender(); } }, 'Not now'))));
    }

    var mock = st.sessions.mock;
    var mockLive = mock && mock.phase !== 'results';
    var missed = App.words.filter(function (w) { return !w.hidden && GF.scheduler.isMissed(st.progress[w.id]); }).length;

    var todayLabel = todayCount >= goal ? 'Done for today! Keep going?' : todayCount + ' / ' + goal + ' today';
    var R = st.rewards, K = GF.stickers;
    var ov = GF.az.overview(App.words, st.az.filter, st.az.w);
    var boxes = R.pending.filter(function (p) { return p.type === 'box'; });
    if (boxes.length) {
      root.appendChild(h('div.notice.surprise-notice', h('span', '🎁 You have a surprise box to open!'),
        h('button.btn.small.primary', { type: 'button', onclick: function () { UI.rewards.openPending(boxes[0]); } }, 'Open it')));
    }
    root.appendChild(h('div.modes',
      h('button.mode.today', { type: 'button', onclick: App.startToday },
        h('span.mode-emoji', '📅'), h('span.mode-name', "Today's practice"), h('span.mode-sub', todayLabel)),
      h('button.mode', { type: 'button', onclick: function () { App.startMock(false); } },
        h('span.mode-emoji', '🏆'), h('span.mode-name', 'Mock Final'), h('span.mode-sub', mockLive ? 'Continue your mock' : 'Just like the real final')),
      h('button.mode', { type: 'button', onclick: function () { App.go('train1'); } },
        h('span.mode-emoji', '🎯'), h('span.mode-name', 'Round 1 training'), h('span.mode-sub', 'Themes board game')),
      h('button.mode', { type: 'button', onclick: function () { App.go('train2'); } },
        h('span.mode-emoji', '📈'), h('span.mode-name', 'Round 2 training'), h('span.mode-sub', 'Easy, Medium, Hard')),
      h('button.mode', { type: 'button', onclick: function () { App.startBoard({ type: 'fix' }); } },
        h('span.mode-emoji', '🔁'), h('span.mode-name', 'Fix my mistakes'), h('span.mode-sub', missed ? missed + ' to fix' : 'Nothing to fix yet')),
      h('button.mode', { type: 'button', onclick: function () { App.go('az'); } },
        h('span.mode-emoji', '🔤'), h('span.mode-name', 'A to Z'), h('span.mode-sub', 'Letters done ' + ov.lettersDone + ' of ' + ov.lettersTotal)),
      h('button.mode', { type: 'button', onclick: function () { App.go('extreme'); } },
        h('span.mode-emoji', '🔥'), h('span.mode-name', 'Extremely hard'), h('span.mode-sub', App.extremeIds().length + ' tricky 9–11 words')),
      h('button.mode', { type: 'button', onclick: function () { App.go('legacyList'); } },
        h('span.mode-emoji', '📼'), h('span.mode-name', "Last year's final"), h('span.mode-sub', 'Play a 2025 finalist\'s words')),
      h('button.mode', { type: 'button', onclick: function () { App.go('stickers'); } },
        h('span.mode-emoji', '📒'), h('span.mode-name', 'Sticker book'), h('span.mode-sub', K.unique(R) + ' of ' + K.ALL.length + ' · ⭐ ' + R.stars)),
      h('button.mode', { type: 'button', onclick: function () { App.go('progress'); } },
        h('span.mode-emoji', '⭐'), h('span.mode-name', 'My progress'), h('span.mode-sub', 'Scores, streak and calendar'))));

    root.appendChild(h('div.gate',
      UI.holdButton('🔒 Parent area: press and hold for 3 seconds', 3000, function () { App.parentUnlocked = true; App.go('parent'); }),
      h('p.muted.small', 'Study plan, settings, words, backups and printing.')));
  };

  // ---------- day streak calendar ----------
  // From two weeks ago (or her first practice day, if earlier) up to the final, a sticker on each practice day.
  function calendar() {
    var st = App.state, today = App.today(), final = App.finalDate(), U = GF.util;
    var days = Object.keys(st.activity || {}).filter(function (d) { return st.activity[d] && st.activity[d].all; }).sort();
    var start = days.length && days[0] < U.addDays(today, -13) ? days[0] : U.addDays(today, -13);
    if (U.daysBetween(start, final) > 70) start = U.addDays(final, -70);
    // start on a Monday so the columns line up
    var dow = (new Date(U.daysBetween('1970-01-01', start) * 86400000).getUTCDay() + 6) % 7;
    start = U.addDays(start, -dow);
    var end = final > today ? final : today;
    var cells = [];
    var all = GF.stickers.ALL;
    for (var d = start; d <= end; d = U.addDays(d, 1)) {
      var did = st.activity[d] && st.activity[d].all;
      var cls = 'div.cal-day' + (did ? '.did' : '') + (d === today ? '.today' : '') + (d === final ? '.final' : '') + (d > today ? '.future' : '');
      var mark = d === final ? '🏆' : did ? UI.glyph(all[U.hashSeed(d) % all.length].emoji, all[U.hashSeed(d) % all.length].alt) : '';
      cells.push(h(cls, { 'aria-label': d + (did ? ': practised' : '') + (d === final ? ': the final' : '') },
        h('span.cal-num', String(+d.slice(8))), h('span.cal-mark', mark)));
    }
    return h('section.panel', h('h2', '📅 Practice calendar'),
      h('p.countdown', countdown() + ' · ' + App.streak() + '-day streak 🔥'),
      h('div.cal-head', ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function (x) { return h('span', x); })),
      h('div.cal', cells));
  }

  // ---------- My progress ----------
  App.screens.progress = function (root) {
    var st = App.state, bank = App.bank, P = GF.plan, S = GF.scheduler;
    root.appendChild(h('h1', '⭐ My progress'));

    var totals = st.mockHistory.map(function (m) { return m.total; });
    var best = totals.length ? Math.max.apply(null, totals) : null;
    var K = GF.stickers, R = st.rewards;
    root.appendChild(h('div.cards3',
      h('div.stat', h('span.stat-num', best == null ? '–' : String(best)), h('span.stat-label', 'Best Mock Final score')),
      h('div.stat', h('span.stat-num', String(App.streak())), h('span.stat-label', 'Day streak 🔥')),
      h('div.stat', h('span.stat-num', K.unique(R) + '/' + K.ALL.length), h('span.stat-label', 'Stickers collected')),
      h('div.stat', h('span.stat-num', String(R.bestRun)), h('span.stat-label', 'Best run of right answers'))));
    root.appendChild(calendar());

    // last 10 mock scores
    var last = st.mockHistory.slice(-10);
    var chart = h('div.chart', { role: 'img', 'aria-label': 'Last mock scores: ' + last.map(function (m) { return m.total; }).join(', ') });
    if (!last.length) chart.appendChild(h('p.muted', 'No Mock Finals yet. Try one from the Home screen!'));
    last.forEach(function (m) {
      var hgt = Math.max(2, Math.round(Math.max(0, m.total) / bank.finale_format.max_total * 100));
      chart.appendChild(h('div.col', h('span.val', String(m.total)), h('span.barv' + (m.total === best ? '.best' : ''), { style: { height: hgt + '%' } }), h('span.lbl', (m.date || '').slice(5))));
    });
    root.appendChild(h('section.panel', h('h2', 'Last 10 Mock Finals'), chart,
      h('p.muted.small', '2025 results: Champion 150 · 1st runner-up 140 · 2nd runner-up 130')));

    // stickers
    var owned = K.ALL.filter(function (s) { return R.owned[s.id]; });
    root.appendChild(h('section.panel', h('h2', 'My stickers'),
      owned.length ? h('div.stickers', owned.map(function (s) { return UI.rewards.chip(s.id, { small: true }); }))
        : h('p.muted', 'Get 3 right in a row for a sticker. Finish a board for a pack of 3!'),
      h('div.row', h('button.btn', { type: 'button', onclick: function () { App.go('stickers'); } }, '📒 Open my sticker book'))));

    // grid of themes x tiers and round-2 focus levels
    var cell = function (ids) {
      var m = S.countMastered(ids, st.progress);
      var a = S.accuracy(ids, st.progress);
      return h('td', h('div.cell-main', m + '/' + ids.length), h('div.cell-sub', a == null ? 'not tried' : pct(a) + ' right'));
    };
    var table = h('table.grid',
      h('thead', h('tr', h('th', ''), h('th', 'Easy'), h('th', 'Medium'), h('th', 'Hard'))),
      h('tbody',
        bank.themes.map(function (t) {
          return h('tr', h('th', t.emoji + ' ' + t.label), P.TIERS.map(function (tier) { return cell(P.themePool(App.words, bank, t.id, tier)); }));
        }),
        h('tr', h('th', '📈 Round 2 focus'), P.TIERS.map(function (l) { return cell(P.round2Pool(App.words, bank, l, true)); })),
        h('tr', h('th', '📚 9–11 list'), P.TIERS.map(function (b) { return cell(P.bandPool(App.words, bank, b)); }))));
    root.appendChild(h('section.panel', h('h2', 'Words mastered'), h('div.table-wrap', table),
      h('p.muted.small', 'Mastered = right 5 times in a row, on at least 2 different days.')));
  };
})();
