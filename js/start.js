/* Starts the app once every script has loaded. */
(function () {
  'use strict';
  try { window.App.init(); }
  catch (e) {
    var p = document.createElement('p');
    p.className = 'panel';
    p.textContent = 'Sorry, the app could not start: ' + (e && e.message ? e.message : e) + '. Try reloading the page.';
    document.getElementById('app').appendChild(p);
    if (window.console) console.error(e);
  }
  // Opened from a web address: keep a copy on the device so it also works offline.
  try {
    if (/^https?:$/.test(location.protocol)) {
      // The home-screen app details (browsers refuse to read them from a file opened on the computer).
      var link = document.createElement('link');
      link.rel = 'manifest'; link.href = 'manifest.webmanifest';
      document.head.appendChild(link);
    }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(window.App && window.App.embedded)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* fine without it */ }); });
    }
  } catch (e) { /* fine without it */ }
})();
