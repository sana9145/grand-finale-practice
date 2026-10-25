/* The 👗 Dress-up studio: dress the doll with things bought with stars or won as gifts. */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, GF = window.GF, App = window.App, D = GF.dress;

  function dress() { return App.state.dress; }
  function R() { return App.state.rewards; }
  function slotInfo(id) { return D.SLOTS.filter(function (s) { return s.id === id; })[0] || D.SLOTS[0]; }
  function canSpeak() { return UI.speech.mode() !== 'parent'; }

  function swatch(it) {
    var val = it.value;
    var css = val === 'rainbow' ? 'linear-gradient(180deg,#ff595e,#ffca3a,#8ac926,#1982c4,#6a4c93)'
      : val === 'glitter' ? 'radial-gradient(circle at 30% 30%,#fff 0 8%,transparent 9%),radial-gradient(circle at 70% 60%,#fff 0 7%,transparent 8%),#ff6fa3'
        : val === 'none' ? 'repeating-linear-gradient(45deg,var(--bg2) 0 6px,var(--card) 6px 12px)' : val;
    return h('span.swatch', { 'aria-hidden': 'true', style: { background: css } });
  }

  function preview(it) {
    if (slotInfo(it.slot).kind === 'color') return swatch(it);
    return UI.doll.svg(D.tryOn(dress().look, it.id), { size: 'tile', view: UI.dollView(it.slot), backdrop: it.slot === 'backdrop', label: it.name });
  }

  function wearIt(it) {
    D.wear(dress(), it.id);
    App.save();
    UI.sounds.tap();
    App.render({ keepScroll: true });
  }

  function offer(it) {
    var d = dress(), stars = R().stars;
    var need = it.price - stars;
    var body = [h('div.offer-doll', UI.doll.svg(D.tryOn(d.look, it.id), { size: 'big', label: d.name + ' trying on ' + it.name })),
      h('p.center', need > 0 ? 'You need ' + need + ' more star' + (need === 1 ? '' : 's') + '. Every right answer gives you a star!'
        : 'This uses ' + it.price + ' of your ' + stars + ' stars.')];
    var buttons = need > 0 ? [{ label: 'OK', value: false, cls: 'primary' }]
      : [{ label: 'Not now', value: false, cls: 'ghost' }, { label: 'Get it for ⭐ ' + it.price, value: true, cls: 'primary' }];
    UI.modal({ title: it.name, body: body, buttons: buttons, dismissValue: false }).then(function (yes) {
      if (!yes) return;
      var res = D.buy(dress(), R(), it.id);
      if (!res.ok) { UI.alert('Not yet', res.error); return; }
      App.save();
      UI.sounds.sticker();
      if (canSpeak()) UI.speech.say(it.name + '!');
      UI.toast('🎉 ' + it.name + ' is yours!');
      App.render({ keepScroll: true });
    });
  }

  App.screens.dress = function (root, params) {
    var d = dress();
    var slot = slotInfo(params.slot || 'outfit').id;
    var c = D.counts(d);
    root.appendChild(h('h1', '👗 Dress-up studio'));
    root.appendChild(h('p.book-total', '⭐ ' + R().stars + ' star' + (R().stars === 1 ? '' : 's') + ' · ' + c.owned + ' of ' + c.total + ' items unlocked'));

    var name = h('input', { id: 'doll-name', type: 'text', maxlength: '20', value: d.name, autocomplete: 'off', 'aria-label': "Your doll's name" });
    name.addEventListener('change', function () { d.name = name.value.trim().slice(0, 20) || 'Dolly'; App.save(); UI.toast('Hello, ' + d.name + '!'); });
    var left = h('div.dress-left',
      h('div.dress-stage', UI.doll.svg(d.look, { size: 'big', label: d.name + ', your doll' })),
      h('label.field.doll-name', h('span.field-label', "Doll's name"), name),
      h('div.row.center',
        h('button.btn', { type: 'button', onclick: function () { D.surprise(d, App.rand('surprise')); App.save(); UI.sounds.tap(); App.render({ keepScroll: true }); } }, '🎲 Surprise me'),
        h('button.btn', { type: 'button', onclick: function () {
          if (!D.saveLook(d, Date.now())) { UI.alert('Your look book is full', 'You can keep ' + D.MAX_LOOKS + ' looks. Open My looks and delete one first.'); return; }
          App.save(); UI.sounds.sticker(); UI.toast('📸 Look saved!'); App.render({ keepScroll: true });
        } }, '📸 Save this look'),
        h('button.btn', { type: 'button', onclick: function () { App.go('dressLooks'); } }, '👛 My looks (' + d.looks.length + ')')));

    var tabs = h('div.tabs.dress-tabs', { role: 'tablist', 'aria-label': 'Wardrobe' }, D.SLOTS.map(function (s) {
      var on = s.id === slot;
      return h('button.tab' + (on ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': String(on), onclick: function () { App.go('dress', { slot: s.id }, { keepScroll: true }); } }, s.icon + ' ' + s.label);
    }));
    var stars = R().stars;
    var grid = h('div.item-grid', D.itemsFor(slot).map(function (it) {
      var owned = D.isOwned(d, it.id), on = d.look[slot] === it.id;
      var state = on ? '✓ Wearing' : owned ? 'Wear' : '🔒 ⭐ ' + it.price;
      return h('button.item-tile' + (on ? '.on' : '') + (owned ? '.owned' : '.locked') + (!owned && stars >= it.price ? '.can-buy' : ''), {
        type: 'button', 'aria-pressed': String(on),
        'aria-label': it.name + (on ? ', wearing' : owned ? ', tap to wear' : ', costs ' + it.price + ' stars'),
        onclick: function () { if (owned) wearIt(it); else offer(it); }
      }, h('span.item-preview', preview(it)), h('span.item-name', it.name), h('span.item-state', state));
    }));
    root.appendChild(h('div.dress-layout', left, h('div.dress-right', tabs, grid,
      h('p.muted', 'Earn stars by spelling: every right answer gives one. Finishing a board, an A–Z part or Today\'s goal also gives a surprise for your doll.'))));
  };

  App.screens.dressLooks = function (root) {
    var d = dress();
    root.appendChild(h('button.btn.ghost.back', { type: 'button', onclick: function () { App.go('dress'); } }, '← Dress-up studio'));
    root.appendChild(h('h1', '👛 My looks'));
    if (!d.looks.length) {
      root.appendChild(h('p.panel', 'No saved looks yet. Dress your doll, then tap 📸 Save this look.'));
      return;
    }
    root.appendChild(h('p.muted', 'Tap a look to wear it again. You can keep ' + D.MAX_LOOKS + '.'));
    root.appendChild(h('div.looks-grid', d.looks.map(function (l, i) {
      return h('div.look-card',
        h('button.look-wear', { type: 'button', 'aria-label': 'Wear look ' + (i + 1), onclick: function () { D.wearLook(d, i); App.save(); UI.toast('👗 Look ' + (i + 1) + ' is on!'); App.go('dress'); } },
          UI.doll.svg(l.look, { size: 'tile', label: 'Saved look ' + (i + 1) })),
        h('button.btn.small', { type: 'button', 'aria-label': 'Delete look ' + (i + 1), onclick: function () {
          UI.confirm('Delete this look?', 'Look ' + (i + 1) + ' will be removed from My looks. The clothes stay in your wardrobe.', 'Delete', true).then(function (ok) {
            if (!ok) return;
            D.deleteLook(d, i); App.save(); App.rerender();
          });
        } }, '🗑 Delete'));
    })));
  };
})();
