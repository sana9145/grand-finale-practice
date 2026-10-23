/* Little sound effects made with the Web Audio API (no files). Gentle, never a harsh buzzer. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});
  var ctx = null;
  var enabled = true;

  function ac() {
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(freq, at, dur, type, vol) {
    var c = ac();
    if (!c) return;
    var t0 = c.currentTime + at;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function play(notes) {
    if (!enabled) return;
    try { notes.forEach(function (n) { tone(n[0], n[1], n[2], n[3], n[4]); }); } catch (e) { /* ignore */ }
  }

  UI.sounds = {
    setEnabled: function (on) { enabled = !!on; },
    unlock: function () { if (enabled) ac(); },
    right: function () { play([[659, 0, 0.18, 'sine'], [880, 0.12, 0.3, 'sine']]); },
    wrong: function () { play([[392, 0, 0.22, 'triangle', 0.1], [330, 0.16, 0.32, 'triangle', 0.1]]); },
    sticker: function () { play([[784, 0, 0.15], [988, 0.1, 0.15], [1175, 0.2, 0.3]]); },
    trophy: function () { play([[523, 0, 0.18, 'triangle'], [659, 0.15, 0.18, 'triangle'], [784, 0.3, 0.18, 'triangle'], [1047, 0.45, 0.5, 'triangle']]); },
    tap: function () { play([[600, 0, 0.06, 'sine', 0.05]]); },
    time: function () { play([[523, 0, 0.2, 'sine', 0.12], [523, 0.3, 0.2, 'sine', 0.12]]); }
  };
})();
