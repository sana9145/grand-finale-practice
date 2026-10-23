/* The pronouncer. Uses speechSynthesis carefully, and falls back to "Parent reads" mode
   when there is no voice or speech keeps failing. Never fails silently. */
(function () {
  'use strict';
  var UI = (window.UI = window.UI || {});

  var synth = null;
  try { synth = window.speechSynthesis || null; } catch (e) { synth = null; }
  var supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';

  var S = {
    supported: supported, voices: [], voice: null, ready: false, failed: false, failReason: '',
    speaking: false, settings: { rate: 0.85, pitch: 1, voiceURI: null, speech: 'auto' }
  };
  var listeners = [], failListeners = [];
  var seq = 0, errorsInARow = 0;

  function setSpeaking(on) {
    if (S.speaking === on) return;
    S.speaking = on;
    listeners.forEach(function (fn) { try { fn(on); } catch (e) { /* ignore */ } });
  }

  function fail(reason) {
    if (S.failed) return;
    S.failed = true;
    S.failReason = reason;
    setSpeaking(false);
    failListeners.forEach(function (fn) { try { fn(reason); } catch (e) { /* ignore */ } });
  }

  function lang(v) { return String(v.lang || '').replace('_', '-').toLowerCase(); }

  function pick() {
    var vs = S.voices;
    if (!vs.length) { S.voice = null; return null; }
    var saved = S.settings.voiceURI && vs.filter(function (v) { return v.voiceURI === S.settings.voiceURI; })[0];
    var by = function (code) { return vs.filter(function (v) { return lang(v) === code; })[0]; };
    S.voice = saved || by('en-gb') || by('en-in') || by('en-us') ||
      vs.filter(function (v) { return lang(v).indexOf('en') === 0; })[0] || null;
    return S.voice;
  }

  function loadVoices() {
    try { S.voices = (synth.getVoices() || []).slice(); } catch (e) { S.voices = []; }
    pick();
    return S.voices.length;
  }

  // Wait for voices: voiceschanged, with a 1.5-second fallback.
  function init(settings) {
    configure(settings);
    return new Promise(function (resolve) {
      if (!supported) { S.ready = true; fail('This browser has no speech voice.'); resolve(false); return; }
      if (loadVoices()) { S.ready = true; resolve(true); return; }
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        loadVoices();
        S.ready = true;
        if (!S.voices.length) fail('No speech voice was found on this device.');
        else if (!S.voice) fail('No English voice was found on this device.');
        resolve(!!S.voice);
      };
      try { synth.addEventListener('voiceschanged', function () { if (loadVoices()) finish(); }); }
      catch (e) { try { synth.onvoiceschanged = function () { if (loadVoices()) finish(); }; } catch (x) { /* ignore */ } }
      setTimeout(finish, 1500);
    });
  }

  function configure(settings) {
    settings = settings || {};
    S.settings.rate = Math.max(0.6, Math.min(1.2, Number(settings.rate) || 0.85));
    S.settings.pitch = Math.max(0.5, Math.min(1.5, Number(settings.pitch) || 1));
    S.settings.voiceURI = settings.voiceURI || null;
    S.settings.speech = settings.speech || 'auto';
    if (S.voices.length) pick();
  }

  function mode() {
    if (S.settings.speech === 'parent' || !supported || S.failed || (S.ready && !S.voice)) return 'parent';
    return 'voice';
  }

  // Split at sentence ends (and long clauses) to avoid Chrome's ~15-second cut-off.
  function split(text) {
    var parts = String(text || '').match(/[^.!?]+[.!?]*\s*/g) || [];
    var out = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      while (p.length > 160) {
        var cut = p.lastIndexOf(',', 160);
        if (cut < 40) cut = p.lastIndexOf(' ', 160);
        if (cut < 40) cut = 160;
        out.push(p.slice(0, cut + 1).trim());
        p = p.slice(cut + 1).trim();
      }
      if (p) out.push(p);
    });
    return out;
  }

  function speakOne(text, done) {
    try { synth.cancel(); } catch (e) { /* ignore */ }
    var u;
    try { u = new window.SpeechSynthesisUtterance(text); }
    catch (e) { fail('Speech could not start.'); done(); return; }
    if (S.voice) { u.voice = S.voice; u.lang = S.voice.lang; } else u.lang = 'en-GB';
    u.rate = S.settings.rate;
    u.pitch = S.settings.pitch;
    var finished = false;
    var finish = function () { if (finished) return; finished = true; clearTimeout(watchdog); done(); };
    u.onstart = function () { errorsInARow = 0; };
    u.onend = function () { errorsInARow = 0; finish(); };
    u.onerror = function (e) {
      var err = e && e.error;
      if (err !== 'interrupted' && err !== 'canceled') {
        errorsInARow++;
        if (errorsInARow >= 3) fail('Speech keeps failing (' + err + ').');
      }
      finish();
    };
    // If "end" never fires, recover quietly.
    var watchdog = setTimeout(function () { try { synth.cancel(); } catch (e) { /* ignore */ } finish(); }, 8000 + text.length * 60);
    try { synth.resume(); synth.speak(u); }
    catch (e) { errorsInARow++; finish(); }
  }

  // Speak text (split into sentences). opts: {onend, gap (ms between parts), list (array instead of text)}
  function say(text, opts) {
    opts = opts || {};
    var chunks = opts.list ? opts.list.slice() : split(text);
    if (mode() === 'parent' || !chunks.length) { if (opts.onend) opts.onend(); return false; }
    var my = ++seq;
    var i = 0;
    setSpeaking(true);
    (function next() {
      if (my !== seq) return;
      if (i >= chunks.length) { setSpeaking(false); if (opts.onend) opts.onend(); return; }
      var c = chunks[i++];
      speakOne(c, function () {
        if (my !== seq) return;
        if (opts.gap && i < chunks.length) setTimeout(next, opts.gap); else next();
      });
    })();
    return true;
  }

  function stop() {
    seq++;
    try { if (synth) synth.cancel(); } catch (e) { /* ignore */ }
    setSpeaking(false);
  }

  function englishVoices() {
    return S.voices.filter(function (v) { return lang(v).indexOf('en') === 0; });
  }

  // Reset a failure (e.g. after the parent picks another voice or turns voice back on).
  function retry() { S.failed = false; S.failReason = ''; errorsInARow = 0; pick(); }

  // Stop speaking when the page is hidden (the timer pauses too).
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

  S.init = init; S.configure = configure; S.mode = mode; S.say = say; S.stop = stop; S.split = split;
  S.englishVoices = englishVoices; S.retry = retry;
  S.onSpeaking = function (fn) { listeners.push(fn); };
  S.onFail = function (fn) { failListeners.push(fn); };
  UI.speech = S;
})();
