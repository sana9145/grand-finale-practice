// A tiny Chrome DevTools Protocol client (no dependencies), shared by the browser checks.
// Uses the built-in WebSocket on Node 22+, and a pipe to the browser on older Node.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function findBrowser(preferred) {
  return [preferred,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].filter(Boolean).find((p) => existsSync(p));
}

export async function launch(exe) {
  const profile = mkdtempSync(join(tmpdir(), 'gfp-profile-'));
  const usePipe = typeof WebSocket === 'undefined';
  const flags = ['--headless=new', usePipe ? '--remote-debugging-pipe' : '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900', 'about:blank'];
  const proc = spawn(exe, flags, { stdio: usePipe ? ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'] });
  let nextId = 1;
  const pending = new Map();
  const handlers = [];
  const onMessage = (text) => {
    const msg = JSON.parse(text);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
    else if (msg.method) handlers.forEach((h) => h(msg));
  };
  let write, closeTransport;
  if (usePipe) {
    let buf = '';
    proc.stdio[4].on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\0')) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 1); if (m) onMessage(m); }
    });
    write = (s) => proc.stdio[3].write(s + '\0');
    closeTransport = () => { try { proc.stdio[3].end(); } catch (e) { /* ignore */ } };
  } else {
    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      const t = setTimeout(() => rej(new Error('Browser did not start')), 20000);
      proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (ev) => onMessage(ev.data));
    write = (s) => ws.send(s);
    closeTransport = () => ws.close();
  }
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    write(JSON.stringify({ id, method, params, sessionId }));
  });
  const close = async () => {
    closeTransport();
    proc.kill();
    await new Promise((r) => setTimeout(r, 500));
    try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* the browser may still hold a file */ }
  };
  return { send, handlers, close };
}
