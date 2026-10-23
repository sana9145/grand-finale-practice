const test = require('node:test');
const assert = require('node:assert');
const { GF } = require('./_load.js');
const St = GF.storage;

function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

// What the previous version (schemaVersion 1) saved after a few weeks of use.
function oldState() {
  return {
    schemaVersion: 1,
    createdAt: Date.parse('2026-10-01T09:00:00'),
    profile: { name: 'Zara', avatar: '🦄', stickers: 23 },
    settings: {
      finalDate: '2026-10-28', dailyGoal: 60, judge: 'self', timer: '30', timerCustom: 45, timeUp: 'wrong', mockUses: 'all',
      boardLength: 30, boardWrong: 'stay', showText: false, soundAlike: false, zName: 'zee', voiceURI: 'Google UK English Female',
      rate: 0.9, pitch: 1.1, sfx: false, speech: 'auto'
    },
    plan: { geography: ['easy', 'medium', 'hard'], animals: ['easy'], silent_letter: ['medium'], round2: { levels: ['medium', 'hard'], focus_only: false } },
    progress: {
      horse: { box: 5, seen: 7, right: 7, wrong: 0, streak: 7, lastSeen: 1760000000000, lastDay: '2026-10-19', lastResult: 'right', days: ['2026-10-12', '2026-10-19'] },
      knife: { box: 1, seen: 3, right: 1, wrong: 2, streak: 0, lastSeen: 1760100000000, lastDay: '2026-10-20', lastResult: 'wrong', days: ['2026-10-11'] }
    },
    log: [{ id: 'horse', right: true, t: 1760000000000 }, { id: 'knife', right: false, t: 1760100000000 }],
    activity: { '2026-10-19': { all: 30, today: 25 }, '2026-10-20': { all: 41, today: 40 } },
    mockHistory: [
      { id: 'mock-1', date: '2026-10-15', total: 95, r1Score: 30, r2Score: 65, round1: [{ choice: 'animals', id: 'horse', word: 'horse', right: true, points: 10 }], round2: [] },
      { id: 'mock-2', date: '2026-10-20', total: 135, r1Score: 50, r2Score: 85, round1: [], round2: [] }
    ],
    legacyHistory: [{ date: '2026-10-18', finalist: 'Finalist B', r1: 40, r2: 90, total: 130 }],
    overlay: {
      added: [{ id: 'zibber', word: 'zibber', display: 'zibber', meaning: 'A made-up word.', sources: ['added'], difficulty: 2, level: 'medium', themes: [], theme_tier: {} }],
      edited: { tiger: { id: 'tiger', word: 'tiger', meaning: 'A big striped cat.', difficulty: 2, level: 'medium', sources: ['official_2026'], themes: ['animals'], theme_tier: { animals: 'easy' } } },
      hidden: ['camel']
    },
    backup: { lastAt: 1760000000000, answersSince: 12, remindAfter: 1760000000000 },
    sessions: { today: { kind: 'today', day: '2026-10-20', count: 40, card: { id: 'horse', revealed: false, spoken: true, asked: {} }, board: { pos: 3 }, undo: [] } },
    ui: { screen: 'today', params: {} }
  };
}

test('an old saved state migrates with nothing lost, and the new fields get defaults', () => {
  const old = oldState();
  const storage = fakeStorage({ [St.KEY]: JSON.stringify(old) });
  const r = St.load(storage, Date.parse('2026-10-22T08:00:00'));
  assert.strictEqual(r.notice, null);
  assert.strictEqual(r.corruptKey, null, 'not treated as corrupt');
  const s = r.state;
  assert.strictEqual(s.schemaVersion, 2);

  // everything she had is still there, unchanged
  for (const k of ['createdAt', 'progress', 'log', 'activity', 'mockHistory', 'legacyHistory', 'backup', 'sessions', 'ui']) {
    assert.deepStrictEqual(s[k], old[k], k);
  }
  assert.deepStrictEqual(s.profile, old.profile);
  for (const k of Object.keys(old.settings)) assert.deepStrictEqual(s.settings[k], old.settings[k], 'setting ' + k);
  for (const k of Object.keys(old.plan)) assert.deepStrictEqual(s.plan[k], old.plan[k], 'plan ' + k);
  assert.deepStrictEqual(s.overlay, old.overlay);

  // new fields
  assert.deepStrictEqual(s.plan.list_9_11, ['easy', 'medium', 'hard']);
  assert.deepStrictEqual(s.az, { filter: { list: 'both', extreme: true }, shuffle: false, w: {}, last: null });
  assert.strictEqual(s.settings.mockR2, 'focus911');
  assert.strictEqual(s.rewards.stars, 0);
  assert.deepStrictEqual(s.rewards.badges, { letters: {}, trophies: {} });

  // her 23 stickers are in the sticker book
  assert.strictEqual(GF.stickers.total(s.rewards), 23);
  assert.strictEqual(s.rewards.owned.butterfly, 2);
  assert.strictEqual(s.rewards.legacy, 23);
  assert.strictEqual(s.profile.stickers, 23);

  // and it saves and loads again as version 2 without changes
  assert.ok(St.save(storage, s));
  const again = St.load(storage, Date.now()).state;
  assert.deepStrictEqual(again, s);
});

test('an old state with no plan yet gets the default plan (including the 9-11 row)', () => {
  const old = oldState();
  old.plan = null;
  const s = St.load(fakeStorage({ [St.KEY]: JSON.stringify(old) }), 1).state;
  assert.strictEqual(s.plan, null);
  const { bank } = require('./_load.js');
  assert.deepStrictEqual(GF.plan.normalize(s.plan, bank).list_9_11, ['easy', 'medium', 'hard']);
});

test('the merged word list still applies her word changes after the update', () => {
  const { bank } = require('./_load.js');
  const s = St.load(fakeStorage({ [St.KEY]: JSON.stringify(oldState()) }), 1).state;
  const m = GF.overlay.merge(bank.words, s.overlay, bank.finale_format.round2.levels);
  assert.strictEqual(m.byId.tiger.meaning, 'A big striped cat.');
  assert.strictEqual(m.byId.tiger.origin, 'edited');
  assert.strictEqual(m.byId.camel.hidden, true);
  assert.strictEqual(m.byId.zibber.origin, 'added');
  // an edit made before the update can't take a word off the 9-11 list
  const both = bank.words.find((w) => w.sources.includes('official_2026') && w.sources.includes('official_2026_9_11'));
  const o = GF.overlay.saveWord(s.overlay, Object.assign({}, both, { meaning: 'x', sources: ['official_2026'] }), true);
  const m2 = GF.overlay.merge(bank.words, o, bank.finale_format.round2.levels);
  assert.deepStrictEqual(m2.byId[both.id].sources, both.sources);
  assert.strictEqual(m2.byId[both.id].in_az, true);
  assert.strictEqual(m2.byId[both.id].band_9_11, both.band_9_11);
});

test('an old backup file restores into the new version', () => {
  const old = oldState();
  const b = {
    app: 'grandFinalePractice', backupVersion: 1, savedAt: '2026-10-20T18:00:00.000Z', schemaVersion: 1,
    settings: old.settings, plan: old.plan, profile: old.profile, progress: old.progress, mockHistory: old.mockHistory,
    overlay: old.overlay, log: old.log, activity: old.activity, legacyHistory: old.legacyHistory
  };
  const r = St.readBackup(JSON.stringify(b), 5);
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.state.schemaVersion, 2);
  assert.deepStrictEqual(r.state.progress, old.progress);
  assert.strictEqual(GF.stickers.total(r.state.rewards), 23);
  assert.strictEqual(r.summary.stickers, GF.stickers.unique(r.state.rewards));
  // a new backup carries the A-Z progress and the sticker book
  r.state.az.w.horse = 'd';
  r.state.rewards.stars = 7;
  const back = St.readBackup(JSON.stringify(St.makeBackup(r.state, 9)), 9);
  assert.ok(back.ok);
  assert.strictEqual(back.state.az.w.horse, 'd');
  assert.strictEqual(back.state.rewards.stars, 7);
  assert.strictEqual(back.summary.azDone, 1);
});

test('a state saved by a newer version is not overwritten', () => {
  const storage = fakeStorage({ [St.KEY]: JSON.stringify({ schemaVersion: 99 }) });
  const r = St.load(storage, 42);
  assert.ok(r.corruptKey, 'kept aside');
  assert.strictEqual(storage.getItem(r.corruptKey), JSON.stringify({ schemaVersion: 99 }));
});
