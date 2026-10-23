/* Draws the winding board: Start, numbered squares, a milestone every 5th square, a trophy at the end.
   The board theme (unlocked in the sticker book) changes the colours and the emoji. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});
  var h = UI.h;

  // board: {length, pos, maxPos}; token: emoji; opts: {bounce, theme: {id, milestones, goal}}
  function view(board, token, opts) {
    opts = opts || {};
    var theme = opts.theme || { id: 'classic', milestones: ['⭐'], goal: '🏆' };
    var n = board.length + 1;
    // Phones/tablets: a compact strip above the card. Wide screens: a taller board beside it.
    var narrow = (window.innerWidth || 1024) < 900;
    var cols = narrow ? Math.min(11, n) : 6;
    var rows = Math.ceil(n / cols);
    var grid = h('div.board.theme-' + theme.id + (narrow ? '.compact' : ''), { role: 'img', 'aria-label': 'Board: square ' + board.pos + ' of ' + board.length });
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', auto)';
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      if (r % 2 === 1) c = cols - 1 - c; // snake back and forth
      var milestone = i > 0 && i % 5 === 0 && i < board.length;
      var cls = 'div.sq' + (i === 0 ? '.start' : '') + (i === board.length ? '.goal' : '') +
        (milestone ? '.st' : '') + (i <= board.maxPos && i > 0 ? '.done' : '');
      var label = i === 0 ? 'Start' : i === board.length ? UI.glyph(theme.goal, '🏆') : milestone ? UI.glyph(theme.milestones[(i / 5 - 1) % theme.milestones.length], '⭐') : String(i);
      var sq = h(cls, h('span.sq-label', label));
      if (i === board.pos) sq.appendChild(h('span.token' + (opts.bounce ? '.bounce' : ''), token));
      sq.style.gridRow = String(r + 1);
      sq.style.gridColumn = String(c + 1);
      grid.appendChild(sq);
    }
    return grid;
  }

  UI.board = { view: view };
})();
