/* The app background: the board theme she picked in the sticker book, with gentle floating emoji. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});
  var layer = null, current = null;

  // Spread positions (percent) for the floating emoji, so they don't bunch up.
  var SPOTS = [[6, 8], [28, 4], [54, 10], [80, 6], [94, 22], [14, 30], [42, 26], [70, 32], [88, 46], [4, 54],
    [30, 50], [58, 56], [80, 66], [12, 76], [40, 72], [66, 82], [92, 88], [22, 92], [50, 94], [76, 98]];

  // theme: {id, milestones, goal} from GF.stickers; on: false hides it.
  function apply(theme, on) {
    var id = on && theme && theme.id !== 'classic' ? theme.id : null;
    if (id === current) return;
    current = id;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'bg-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(layer, document.body.firstChild);
    }
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.className = 'bg-layer' + (id ? ' on bg-' + id : '');
    document.documentElement.classList.toggle('has-bg', !!id);
    if (!id) return;
    var marks = theme.milestones.concat([theme.goal]);
    SPOTS.forEach(function (p, i) {
      var s = document.createElement('span');
      s.textContent = UI.glyph ? UI.glyph(marks[i % marks.length], '⭐') : marks[i % marks.length];
      s.style.left = p[0] + '%';
      s.style.top = p[1] + '%';
      s.style.fontSize = (26 + (i * 7) % 22) + 'px';
      s.style.animationDelay = (-(i * 1.7) % 9) + 's';
      layer.appendChild(s);
    });
  }

  UI.backdrop = { apply: apply };
})();
