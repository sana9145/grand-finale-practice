/* Stickers on screen: the streak meter, reward lines after an answer, pack openings and surprise
   boxes, brain breaks, the sticker book and the sticker shop. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App;
  var K = GF.stickers;

  function R() { return App.state.rewards; }
  function sticker(id) { return K.BY_ID[id]; }
  function face(s) { return UI.glyph(s.emoji, s.alt); }
  function dollView(slot, size) { return { size: size, view: UI.dollView(slot), backdrop: slot === 'backdrop' }; }
  function rarityLabel(r) { return r === 'legendary' ? '🌟 Legendary' : r === 'rare' ? '✨ Rare' : 'Common'; }
  function canSpeak() { return UI.speech.mode() !== 'parent'; }

  // Says a sticker's name (not in Parent reads mode). -> true if it spoke.
  function sayName(id) {
    var s = sticker(id);
    if (!s || !canSpeak()) return false;
    UI.speech.say(s.name + '!');
    return true;
  }

  function chip(id, opts) {
    opts = opts || {};
    var s = sticker(id);
    return h('span.stk.r-' + s.rarity + (opts.small ? '.small' : ''), { title: s.name },
      h('span.stk-emoji', face(s)), opts.isNew ? h('span.new-ribbon', 'NEW!') : null);
  }

  // 🔥 run of right answers and ⭐ stars, for the top of play screens.
  function meter() {
    var r = R();
    return h('p.meter', { 'aria-label': r.run + ' right in a row, ' + r.stars + ' stars' },
      h('span.run' + (r.run >= 3 ? '.hot' : ''), '🔥 ' + r.run), h('span.stars', '⭐ ' + r.stars));
  }

  // Lines under the owl after an answer: star, streak cheer, new sticker, surprise box.
  function feedbackLines(ev) {
    var box = h('div.reward-lines');
    if (ev.star) box.appendChild(h('p.reward', '⭐ +1 star · ' + R().stars + (R().stars === 1 ? ' star' : ' stars')));
    var cheer = GF.mascot.runCheer(ev.cheerAt);
    if (cheer) box.appendChild(h('p.reward.cheer', cheer));
    if (ev.sticker && sticker(ev.sticker)) {
      var s = sticker(ev.sticker);
      box.appendChild(h('p.reward.won', 'New sticker: ', chip(ev.sticker, { small: true, isNew: ev.isNew }), ' ' + s.name));
    }
    if (ev.trophy) {
      var t = K.TROPHIES.filter(function (x) { return x.id === ev.trophy; })[0];
      if (t) box.appendChild(h('p.reward.won', 'New trophy: ' + t.emoji + ' ' + t.label + '!'));
    }
    var item = ev.box && R().pending.filter(function (p) { return p.id === ev.box; })[0];
    if (item) box.appendChild(h('div.row.center', h('button.btn.big.surprise', { type: 'button', onclick: function () { openPending(item); } }, '🎁 Surprise box! Tap to open')));
    return box.childNodes.length ? box : null;
  }

  // ---------- pack opening / surprise box ----------
  var overlay = null;
  function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  // An overlay that is no longer on the page (closed some other way) doesn't count as open.
  function overlayOpen() { if (overlay && !overlay.isConnected) overlay = null; return !!overlay; }

  function openPending(item) {
    if (overlayOpen() || document.querySelector('.modal-back')) return;
    var reduced = UI.reducedMotion();
    var cards = item.stickers.map(function (id, i) {
      var s = sticker(id);
      if (!s) return null;
      var card = h('div.flip' + (reduced ? '.flipped' : ''),
        h('div.flip-inner',
          h('div.flip-face.flip-back', { 'aria-hidden': 'true' }, item.type === 'box' ? '🎁' : '❓'),
          h('div.flip-face.flip-front.r-' + s.rarity,
            item.fresh && item.fresh[i] ? h('span.new-ribbon', 'NEW!') : null,
            h('span.flip-emoji', face(s)), h('span.flip-name', s.name), h('span.flip-rarity', rarityLabel(s.rarity)))));
      return card;
    }).filter(Boolean);
    // A wardrobe gift for the dress-up doll comes with packs.
    var gift = item.dress && GF.dress.BY_ID[item.dress];
    if (gift) {
      cards.push(h('div.flip.gift' + (reduced ? '.flipped' : ''),
        h('div.flip-inner',
          h('div.flip-face.flip-back', { 'aria-hidden': 'true' }, '👗'),
          h('div.flip-face.flip-front.r-rare',
            h('span.new-ribbon', 'NEW!'),
            h('span.flip-doll', UI.doll.svg(GF.dress.tryOn(App.state.dress.look, gift.id), dollView(gift.slot, 'tile'))),
            h('span.flip-name', gift.name), h('span.flip-rarity', 'For your doll')))));
    }
    var done = h('button.btn.big' + (gift ? '' : '.primary'), { type: 'button' }, gift ? 'Keep them' : 'Put them in my book 📒');
    var wearNow = gift ? h('button.btn.big.primary', { type: 'button' }, 'Wear it now 👗') : null;
    var box = h('div.modal.pack-modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': item.type === 'box' ? 'Surprise box' : 'Sticker pack' },
      h('h2.center', item.type === 'box' ? '🎁 Surprise box!' : '🎉 Sticker pack!'),
      item.reason ? h('p.center.muted', 'For ' + item.reason + '.') : null,
      h('div.pack-cards', cards),
      h('div.row.center', done, wearNow));
    overlay = h('div.modal-back.pack-back', box);
    document.body.appendChild(overlay);
    UI.sounds.sticker();
    // Flip the cards one by one with a little sound, saying each name.
    if (!reduced) {
      cards.forEach(function (c, i) {
        setTimeout(function () {
          c.classList.add('flipped');
          UI.sounds.tap();
          if (i === cards.length - 1) UI.sounds.sticker();
        }, 500 + i * 750);
      });
    }
    var names = item.stickers.map(function (id) { return sticker(id) ? sticker(id).name : ''; }).filter(Boolean);
    if (gift) names.push('and ' + gift.name + ' for your doll');
    if (canSpeak()) setTimeout(function () { UI.speech.say(names.join('! ') + '!'); }, reduced ? 0 : 500);
    var closed = false;
    var finish = function (wear) {
      if (closed) return;
      closed = true;
      K.open(R(), item.id);
      if (wear && gift) GF.dress.wear(App.state.dress, gift.id);
      App.save();
      closeOverlay();
      document.removeEventListener('keydown', onKey, true);
      if (wear && gift) App.go('dress', { slot: gift.slot });
      else App.rerender();
    };
    var onKey = function (e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(false); } };
    document.addEventListener('keydown', onKey, true);
    done.addEventListener('click', function () { finish(false); });
    if (wearNow) wearNow.addEventListener('click', function () { finish(true); });
    setTimeout(function () { try { (wearNow || done).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  // ---------- brain break ----------
  function endBreak() {
    var r = R();
    r.practiceMs = 0; r.breakDue = false;
    App.save();
  }

  function offerBreak() {
    UI.modal({
      title: '🦉 Brain break time!', dismissValue: 'later',
      body: [h('p', 'You have been practising for 20 minutes. Super work!'), h('p', "Let's stretch for one minute.")],
      buttons: [{ label: 'Parent: skip', value: 'skip', cls: 'ghost' }, { label: "Let's stretch! 🙆", value: 'go', cls: 'primary' }]
    }).then(function (v) {
      if (v === 'go') stretch();
      else endBreak(); // skipping (or closing) counts as a break, so it isn't offered again straight away
    });
  }

  function stretch() {
    if (document.querySelector('.modal-back')) return;
    var lines = GF.util.shuffle(GF.mascot.STRETCHES, GF.util.rng(Date.now())).slice(0, 6);
    var left = 60, step = 0;
    var say = h('p.stretch-line', lines[0]);
    var count = h('p.stretch-count', '60');
    var skip = h('button.btn.ghost', { type: 'button' }, 'Parent: skip');
    var box = h('div.modal.stretch', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Brain break' },
      h('h2.center', '🙆 Brain break'), h('div.stretch-owl', { 'aria-hidden': 'true' }, '🦉'), say, count, h('div.row.center', skip));
    var back = h('div.modal-back.stretch-back', box);
    document.body.appendChild(back);
    if (canSpeak()) UI.speech.say(lines[0]);
    var iv = setInterval(function () {
      left -= 1;
      count.textContent = String(left);
      if (left > 0 && left % 10 === 0) {
        step = (step + 1) % lines.length;
        say.textContent = lines[step];
        if (canSpeak()) UI.speech.say(lines[step]);
      }
      if (left <= 0) finish(true);
    }, 1000);
    function finish(done) {
      clearInterval(iv);
      back.remove();
      endBreak();
      if (done) { UI.sounds.sticker(); UI.toast('⭐ Great stretching! Back to spelling.'); }
      App.rerender();
    }
    skip.addEventListener('click', function () { finish(false); });
  }

  // After every screen draw with no question showing: open a waiting pack, else offer a brain break.
  function afterRender(screen) {
    if (overlayOpen() || document.querySelector('.modal-back')) return;
    var pack = R().pending.filter(function (p) { return p.type === 'pack'; })[0];
    if (pack) { setTimeout(function () { openPending(pack); }, 350); return; }
    var st = App.state;
    if (R().breakDue && st.settings.brainBreak && App.isPlayScreen(screen)) setTimeout(function () { if (!App.hiddenWord && !document.querySelector('.modal-back')) offerBreak(); }, 400);
  }

  // ---------- sticker details ----------
  function showSticker(id) {
    var s = sticker(id), n = R().owned[id] || 0;
    return UI.modal({
      title: s.name, dismissValue: true,
      body: [h('div.big-sticker.r-' + s.rarity, face(s)), h('p.center', rarityLabel(s.rarity) + (n > 1 ? ' · ×' + n : '')),
        h('p.center.muted', 'From the ' + K.PACKS.filter(function (p) { return p.id === s.pack; })[0].label + ' pack')],
      buttons: [{ label: '🔊 Say it', value: 'say' }, { label: 'OK', value: true, cls: 'primary' }]
    }).then(function (v) { if (v === 'say') { UI.speech.say(s.name); showSticker(id); } });
  }

  // ---------- sticker book ----------
  App.screens.stickers = function (root, params) {
    var r = R();
    var page = params.page || K.PACKS[0].id;
    root.appendChild(h('h1', '📒 My sticker book'));
    root.appendChild(h('p.book-total', K.unique(r) + ' of ' + K.ALL.length + ' collected · ⭐ ' + r.stars + (r.stars === 1 ? ' star' : ' stars')));
    var boxes = r.pending.filter(function (p) { return p.type === 'box'; });
    root.appendChild(h('div.row',
      h('button.btn.primary', { type: 'button', onclick: function () { App.go('shop'); } }, '🛒 Sticker shop (' + K.SHOP_PRICE + ' ⭐ each)'),
      boxes.length ? h('button.btn.surprise', { type: 'button', onclick: function () { openPending(boxes[0]); } }, '🎁 Open your surprise box' + (boxes.length > 1 ? 'es (' + boxes.length + ')' : '')) : null));

    var tabs = K.PACKS.map(function (p) {
      var pr = K.packProgress(r, p.id);
      return h('button.tab' + (page === p.id ? '.on' : ''), { type: 'button', 'aria-pressed': String(page === p.id), onclick: function () { App.go('stickers', { page: p.id }, { keepScroll: true }); } },
        p.emoji + ' ' + p.label + ' ' + pr.have + '/' + pr.total + (pr.complete ? ' ✓' : ''));
    }).concat([
      h('button.tab' + (page === 'badges' ? '.on' : ''), { type: 'button', onclick: function () { App.go('stickers', { page: 'badges' }, { keepScroll: true }); } }, '🏅 Badges'),
      h('button.tab' + (page === 'board' ? '.on' : ''), { type: 'button', onclick: function () { App.go('stickers', { page: 'board' }, { keepScroll: true }); } }, '🎲 My board')
    ]);
    root.appendChild(h('div.tabs.book-tabs', tabs));

    var pack = K.PACKS.filter(function (p) { return p.id === page; })[0];
    if (pack) {
      var pr = K.packProgress(r, pack.id);
      var themeOf = K.THEMES.filter(function (t) { return t.id === pack.theme; })[0];
      root.appendChild(h('section.panel',
        h('h2', pack.emoji + ' ' + pack.label + ' · ' + pr.have + ' of ' + pr.total),
        h('div.book-grid', pack.stickers.map(function (row) {
          var id = row[0], s = sticker(id), n = r.owned[id] || 0;
          if (!n) return h('div.slot.missing', { 'aria-label': 'Not collected yet' }, '?');
          return h('button.slot.r-' + s.rarity, { type: 'button', 'aria-label': s.name, onclick: function () { showSticker(id); } },
            h('span.slot-emoji', face(s)), h('span.slot-name', s.name), n > 1 ? h('span.slot-count', '×' + n) : null);
        })),
        h('p.muted', pr.complete ? '🎉 Pack complete! You unlocked the ' + themeOf.label + ' board.' : 'Complete this pack to unlock the ' + themeOf.label + ' board.')));
    } else if (page === 'badges') {
      root.appendChild(h('section.panel', h('h2', '🔤 Golden letters (A–Z tab)'),
        h('div.letter-badges', GF.az.LETTERS.map(function (L) {
          var got = r.badges.letters[L];
          return h('span.gold-letter' + (got ? '.got' : ''), { 'aria-label': got ? 'Golden ' + L : L + ' not done yet' }, L);
        })),
        h('p.muted', 'Finish every word of a letter in the A–Z tab to win its golden letter.')));
      root.appendChild(h('section.panel', h('h2', '🏆 Trophies'),
        h('div.trophies', K.TROPHIES.map(function (t) {
          var got = r.badges.trophies[t.id];
          return h('div.trophy' + (got ? '.got' : ''), h('span.trophy-emoji', got ? t.emoji : '🔒'), h('span', t.label));
        }))));
    } else {
      boardPage(root, r);
    }
  };

  function boardPage(root, r) {
    var themes = K.unlockedThemes(r), cur = K.theme(r);
    root.appendChild(h('section.panel', h('h2', '🎨 Board theme'),
      h('p.muted', 'Your theme becomes the background of the whole app and the colours of the board game.' + (App.state.settings.themeBg === false ? ' (A grown-up has turned the background off in Settings.)' : '')),
      h('div.choices', K.THEMES.map(function (t) {
        var open = themes.indexOf(t) >= 0;
        return h('button.choice.theme-pick' + (t.id === cur.id ? '.on' : ''), {
          type: 'button', disabled: !open, 'aria-pressed': String(t.id === cur.id),
          onclick: function () {
            r.boardTheme = t.id; App.save(); App.rerender();
            UI.toast(t.id === 'classic' ? 'Classic look: plain background' : t.label + ' is now your background and your board!');
          }
        }, h('span.choice-emoji', open ? t.goal : '🔒'), h('span.choice-name', t.label),
          h('span.choice-sub', open ? (t.id === cur.id ? 'In use' : 'Tap to use') : 'Complete a pack to unlock'));
      }))));
    var tokens = K.unlockedTokens(r), token = App.token();
    var all = [App.state.profile.avatar].concat(K.TOKENS);
    root.appendChild(h('section.panel', h('h2', '♟️ Board token'),
      h('div.avatars', all.map(function (t, i) {
        var open = i === 0 || tokens.indexOf(t) >= 0;
        return h('button.avatar-btn' + (t === token ? '.on' : ''), {
          type: 'button', disabled: !open, 'aria-pressed': String(t === token),
          'aria-label': open ? 'Token ' + t : 'Locked: collect ' + (i * 10) + ' stickers',
          onclick: function () { r.token = i === 0 ? null : t; App.save(); App.rerender(); }
        }, open ? t : '🔒');
      })),
      h('p.muted', 'A new token every 10 different stickers. You have ' + K.unique(r) + '.')));
  }

  // ---------- sticker shop ----------
  App.screens.shop = function (root) {
    var r = R();
    root.appendChild(h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go('stickers'); } }, '← Sticker book'));
    root.appendChild(h('h1', '🛒 Sticker shop'));
    root.appendChild(h('p.book-total', 'You have ⭐ ' + r.stars + ' stars. Choose any sticker you don\'t have yet for ' + K.SHOP_PRICE + ' stars.'));
    if (r.stars < K.SHOP_PRICE) root.appendChild(h('p.gentle', 'Every right answer gives you a star. ' + (K.SHOP_PRICE - r.stars) + ' more to go!'));
    K.PACKS.forEach(function (p) {
      var missing = p.stickers.filter(function (row) { return !r.owned[row[0]]; });
      if (!missing.length) return;
      root.appendChild(h('section.panel', h('h2', p.emoji + ' ' + p.label),
        h('div.book-grid', missing.map(function (row) {
          var s = sticker(row[0]);
          return h('button.slot.shop.r-' + s.rarity, {
            type: 'button', disabled: !K.canBuy(r, s.id), 'aria-label': 'Buy ' + s.name + ' for ' + K.SHOP_PRICE + ' stars',
            onclick: function () { buy(s); }
          }, h('span.slot-emoji', face(s)), h('span.slot-name', s.name), h('span.slot-count', K.SHOP_PRICE + ' ⭐'));
        }))));
    });
    if (K.unique(r) === K.ALL.length) {
      root.appendChild(h('p.sticker-won', 'You have every sticker! 🎉'));
      root.appendChild(h('div.row.center', h('button.btn.big.primary', { type: 'button', onclick: function () { App.go('dress'); } }, '👗 Spend your stars in the Dress-up studio')));
    }
  };

  function buy(s) {
    UI.confirm('Get the ' + s.name + '?', [h('div.big-sticker.r-' + s.rarity, face(s)), 'This uses ' + K.SHOP_PRICE + ' of your ' + R().stars + ' stars.'], 'Yes, get it!').then(function (ok) {
      if (!ok) return;
      var res = K.buy(R(), s.id);
      if (!res.ok) { UI.alert('Not yet', res.error); return; }
      App.syncStickers();
      App.save();
      UI.sounds.sticker();
      sayName(s.id);
      UI.toast('🎉 ' + s.name + ' is in your sticker book!');
      App.rerender();
    });
  }

  UI.rewards = { meter: meter, feedbackLines: feedbackLines, sayName: sayName, openPending: openPending, afterRender: afterRender, chip: chip, showSticker: showSticker, stretch: stretch, offerBreak: offerBreak };
})();
