/* The sticker book: 8 packs of 12 emoji stickers, rarity, stars and the shop, golden letter
   badges, trophies, and the board themes and tokens they unlock. No DOM.
   rewards = {owned:{id:count}, stars, starsEarned, last, run, bestRun, badges:{letters:{L:day}, trophies:{id:day}},
              pending:[{id, type:'pack'|'box', reason, stickers:[ids], opened}], boardTheme, token, practiceMs, lastAnswerAt,
              breakDue, legacy} */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.stickers = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.stickers;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // [id, emoji, name, rarity]  c = common, r = rare, l = legendary. 8 common, 3 rare, 1 legendary per pack.
  var PACKS = [
    { id: 'crafts', label: 'Cosy crafts', emoji: '🧶', theme: 'crafts', stickers: [
      ['yarn', '🧶', 'Yarn ball', 'c'], ['thread', '🧵', 'Spool of thread', 'c'], ['needle', '🪡', 'Sewing needle', 'c'],
      ['palette', '🎨', 'Paint palette', 'r'], ['crayon', '🖍️', 'Crayon', 'c'], ['scissors', '✂️', 'Scissors', 'c'],
      ['ribbon', '🎀', 'Pretty ribbon', 'r'], ['teddy', '🧸', 'Teddy bear', 'l'], ['kite', '🪁', 'Kite', 'r'],
      ['puzzle', '🧩', 'Puzzle piece', 'c'], ['brush', '🖌️', 'Paintbrush', 'c'], ['notebook', '📒', 'Notebook', 'c']] },
    { id: 'treats', label: 'Sweet treats', emoji: '🍭', theme: 'candy', stickers: [
      ['lollipop', '🍭', 'Lollipop', 'c'], ['cupcake', '🧁', 'Cupcake', 'r'], ['doughnut', '🍩', 'Doughnut', 'c'],
      ['cookie', '🍪', 'Cookie', 'c'], ['icecream', '🍦', 'Ice cream', 'c'], ['cake', '🎂', 'Birthday cake', 'l'],
      ['chocolate', '🍫', 'Chocolate bar', 'c'], ['sweetie', '🍬', 'Sweetie', 'c'], ['strawberry', '🍓', 'Strawberry', 'c'],
      ['watermelon', '🍉', 'Watermelon', 'r'], ['mango', '🥭', 'Mango', 'r'], ['cherries', '🍒', 'Cherries', 'c']] },
    { id: 'animals', label: 'Animal friends', emoji: '🦋', theme: 'park', stickers: [
      ['butterfly', '🦋', 'Butterfly', 'c'], ['kitten', '🐱', 'Kitten', 'c'], ['puppy', '🐶', 'Puppy', 'c'],
      ['unicorn', '🦄', 'Unicorn', 'l'], ['panda', '🐼', 'Panda', 'r'], ['fox', '🦊', 'Little fox', 'c'],
      ['turtle', '🐢', 'Turtle', 'c'], ['dolphin', '🐬', 'Dolphin', 'r'], ['parrot', '🦜', 'Parrot', 'r'],
      ['bee', '🐝', 'Bumblebee', 'c'], ['koala', '🐨', 'Koala', 'c'], ['giraffe', '🦒', 'Giraffe', 'c']] },
    { id: 'ocean', label: 'Ocean', emoji: '🐠', theme: 'ocean', stickers: [
      ['fish', '🐠', 'Tropical fish', 'c'], ['octopus', '🐙', 'Octopus', 'r'], ['whale', '🐳', 'Splashy whale', 'c'],
      ['crab', '🦀', 'Crab', 'c'], ['shell', '🐚', 'Seashell', 'c'], ['coral', '🪸', 'Coral', 'r'],
      ['shark', '🦈', 'Shark', 'r'], ['puffer', '🐡', 'Pufferfish', 'c'], ['seal', '🦭', 'Seal', 'c'],
      ['bluewhale', '🐋', 'Blue whale', 'l'], ['wave', '🌊', 'Big wave', 'c'], ['anchor', '⚓', 'Anchor', 'c']] },
    { id: 'garden', label: 'Garden', emoji: '🌸', theme: 'garden', stickers: [
      ['rainbow', '🌈', 'Rainbow', 'l'], ['blossom', '🌸', 'Cherry blossom', 'c'], ['sunflower', '🌻', 'Sunflower', 'r'],
      ['tulip', '🌷', 'Tulip', 'c'], ['clover', '🍀', 'Lucky clover', 'r'], ['daisy', '🌼', 'Daisy', 'c'],
      ['mushroom', '🍄', 'Mushroom', 'c'], ['cactus', '🌵', 'Cactus', 'c'], ['rose', '🌹', 'Rose', 'r'],
      ['plant', '🪴', 'Pot plant', 'c'], ['ladybird', '🐞', 'Ladybird', 'c'], ['snail', '🐌', 'Snail', 'c']] },
    { id: 'space', label: 'Space', emoji: '🚀', theme: 'space', stickers: [
      ['rocket', '🚀', 'Little rocket', 'c'], ['planet', '🪐', 'Ringed planet', 'r'], ['moon', '🌙', 'Crescent moon', 'c'],
      ['star', '⭐', 'Star', 'c'], ['sun', '☀️', 'Sunshine', 'c'], ['earth', '🌍', 'Planet Earth', 'c'],
      ['ufo', '🛸', 'Flying saucer', 'r'], ['shooting', '🌠', 'Shooting star', 'r'], ['astronaut', '👩‍🚀', 'Astronaut', 'l'],
      ['telescope', '🔭', 'Telescope', 'c'], ['comet', '☄️', 'Comet', 'c'], ['galaxy', '🌌', 'Milky Way', 'c']] },
    { id: 'magic', label: 'Magic', emoji: '🔮', theme: 'magic', stickers: [
      ['diamond', '💎', 'Diamond', 'r'], ['crown', '👑', 'Crown', 'l'], ['crystal', '🔮', 'Crystal ball', 'c'],
      ['wand', '🪄', 'Magic wand', 'c'], ['fairy', '🧚', 'Fairy', 'r'], ['castle', '🏰', 'Castle', 'c'],
      ['sparkles', '✨', 'Sparkles', 'c'], ['dragon', '🐉', 'Dragon', 'r'], ['bubbles', '🫧', 'Bubbles', 'c'],
      ['tophat', '🎩', 'Magic hat', 'c'], ['glowstar', '🌟', 'Glowing star', 'c'], ['mermaid', '🧜‍♀️', 'Mermaid', 'c']] },
    { id: 'fun', label: 'Fun and games', emoji: '🎈', theme: 'funfair', stickers: [
      ['balloon', '🎈', 'Balloon', 'c'], ['present', '🎁', 'Present', 'c'], ['carousel', '🎠', 'Carousel', 'r'],
      ['ferris', '🎡', 'Big wheel', 'r'], ['skate', '🛼', 'Roller skate', 'c'], ['yoyo', '🪀', 'Yo-yo', 'c'],
      ['controller', '🎮', 'Game controller', 'c'], ['microphone', '🎤', 'Microphone', 'c'], ['drum', '🥁', 'Drum', 'c'],
      ['circus', '🎪', 'Circus tent', 'r'], ['trophy', '🏆', 'Shiny trophy', 'l'], ['bullseye', '🎯', 'Bullseye', 'c']] }
  ];

  var RARITY = { c: 'common', r: 'rare', l: 'legendary' };
  var RARITY_WEIGHTS = [['common', 70], ['rare', 25], ['legendary', 5]];
  var SHOP_PRICE = 15;
  var PACK_SIZE = 3;

  // Newer emoji that older devices (e.g. Windows 10) can't draw. The screen shows the stand-in only
  // when the real one would come out as an empty box.
  var ALT = { needle: '🧷', coral: '🌿', seal: '🐟', plant: '🌱', wand: '🎇', bubbles: '💧', skate: '⛸️', yoyo: '🥏', kite: '🎏', planet: '🌕' };

  var ALL = [], BY_ID = {};
  PACKS.forEach(function (p) {
    p.stickers.forEach(function (s) {
      var rec = { id: s[0], emoji: s[1], name: s[2], rarity: RARITY[s[3]], pack: p.id, alt: ALT[s[0]] || null };
      ALL.push(rec); BY_ID[rec.id] = rec;
    });
  });

  // Board themes, one unlocked by each completed pack.
  var THEMES = [
    { id: 'classic', label: 'Classic', milestones: ['⭐'], goal: '🏆' },
    { id: 'crafts', label: 'Cosy crafts', milestones: ['🧶', '🎀', '🧵', '🧸'], goal: '🧺' },
    { id: 'candy', label: 'Candy land', milestones: ['🍭', '🧁', '🍬', '🍩'], goal: '🍰' },
    { id: 'park', label: 'Animal park', milestones: ['🐾', '🦋', '🐶', '🐱'], goal: '🦁' },
    { id: 'ocean', label: 'Ocean', milestones: ['🐠', '🐚', '🐙', '🦀'], goal: '🐳' },
    { id: 'garden', label: 'Garden', milestones: ['🌸', '🌻', '🌷', '🍀'], goal: '🌈' },
    { id: 'space', label: 'Space', milestones: ['🪐', '🌙', '⭐', '☄️'], goal: '🚀' },
    { id: 'magic', label: 'Magic castle', milestones: ['✨', '🔮', '💎', '🪄'], goal: '🏰' },
    { id: 'funfair', label: 'Funfair', milestones: ['🎈', '🎠', '🎯', '🎪'], goal: '🎡' }
  ];

  // One new board token for every 10 different stickers collected.
  var TOKENS = ['🦊', '🐼', '🦄', '🚀', '🐢', '🐙', '🐉', '🧚', '👑'];

  var TROPHIES = [
    { id: 'firstMock', emoji: '🎖️', label: 'First Mock Final' },
    { id: 'mock130', emoji: '🥉', label: 'Scored 130 in a Mock Final' },
    { id: 'mock140', emoji: '🥈', label: 'Scored 140 in a Mock Final' },
    { id: 'mock150', emoji: '🥇', label: 'Perfect 150 in a Mock Final' },
    { id: 'personalBest', emoji: '📈', label: 'New personal best' },
    { id: 'streak3', emoji: '🔥', label: 'Practised 3 days in a row' },
    { id: 'azChampion', emoji: '🏆', label: 'A to Z Champion' }
  ];

  // The old app showed one of these for its n-th sticker (n mod 20). Kept so old stickers move into the book.
  var LEGACY = ['butterfly', 'rainbow', 'lollipop', 'rocket', 'unicorn', 'sunflower', 'dolphin', 'watermelon', 'balloon', 'ladybird',
    'glowstar', 'fox', 'doughnut', 'turtle', 'palette', 'bee', 'strawberry', 'panda', 'moon', 'microphone'];

  function blank() {
    return {
      owned: {}, stars: 0, starsEarned: 0, last: null, run: 0, bestRun: 0,
      badges: { letters: {}, trophies: {} }, pending: [], boardTheme: 'classic', token: null,
      practiceMs: 0, lastAnswerAt: 0, breakDue: false, legacy: 0, seq: 0
    };
  }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  function normalize(r) {
    var d = blank();
    if (!isObj(r)) return d;
    var out = Object.assign(d, r);
    out.owned = {};
    if (isObj(r.owned)) Object.keys(r.owned).forEach(function (id) { var n = Math.floor(+r.owned[id]); if (BY_ID[id] && n > 0) out.owned[id] = n; });
    out.badges = { letters: isObj(r.badges && r.badges.letters) ? r.badges.letters : {}, trophies: isObj(r.badges && r.badges.trophies) ? r.badges.trophies : {} };
    out.pending = Array.isArray(r.pending) ? r.pending.filter(function (p) { return isObj(p) && Array.isArray(p.stickers); }) : [];
    ['stars', 'starsEarned', 'run', 'bestRun', 'practiceMs', 'lastAnswerAt', 'legacy', 'seq'].forEach(function (k) { out[k] = Math.max(0, +out[k] || 0); });
    return out;
  }

  // The n stickers earned in the old app, moved into the new book.
  function fromLegacy(count) {
    var r = blank();
    var n = Math.max(0, Math.floor(+count || 0));
    for (var i = 0; i < n; i++) give(r, LEGACY[i % LEGACY.length]);
    r.last = null;
    r.legacy = n;
    return r;
  }

  function rollRarity(rand) {
    var x = rand() * 100;
    for (var i = 0; i < RARITY_WEIGHTS.length; i++) { x -= RARITY_WEIGHTS[i][1]; if (x < 0) return RARITY_WEIGHTS[i][0]; }
    return 'common';
  }

  // Pick one sticker: roll the rarity, prefer ones not owned yet, never the one given last.
  function draw(r, rand) {
    var rarity = rollRarity(rand);
    var pool = ALL.filter(function (s) { return s.rarity === rarity && s.id !== r.last; });
    var fresh = pool.filter(function (s) { return !r.owned[s.id]; });
    var list = fresh.length ? fresh : pool;
    return list[Math.floor(rand() * list.length)].id;
  }

  function give(r, id) {
    r.owned[id] = (r.owned[id] || 0) + 1;
    r.last = id;
    return id;
  }

  // Draw and give n stickers (a pack opening or a surprise box). -> [ids]
  function drawMany(r, rand, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(give(r, draw(r, rand)));
    return out;
  }

  // Adds a pack or a box to open. The stickers are already in the book; opening only shows them.
  function addPending(r, type, reason, stickers, isNew) {
    r.seq = (r.seq || 0) + 1;
    var item = { id: 'p' + r.seq, type: type, reason: reason, stickers: stickers, fresh: isNew || [], opened: false };
    r.pending.push(item);
    return item;
  }

  // n stickers in one go, remembering which were new to the book.
  function award(r, rand, n, type, reason) {
    var before = Object.assign({}, r.owned);
    var ids = drawMany(r, rand, n);
    var seen = {};
    var fresh = ids.map(function (id) { var isNew = !before[id] && !seen[id]; seen[id] = 1; return isNew; });
    return addPending(r, type, reason, ids, fresh);
  }

  function open(r, pendingId) {
    r.pending = r.pending.filter(function (p) { return p.id !== pendingId; });
  }

  function canBuy(r, id) { return !!BY_ID[id] && !r.owned[id] && r.stars >= SHOP_PRICE; }

  // -> {ok, error?}
  function buy(r, id) {
    if (!BY_ID[id]) return { ok: false, error: 'There is no such sticker.' };
    if (r.owned[id]) return { ok: false, error: 'You already have this sticker.' };
    if (r.stars < SHOP_PRICE) return { ok: false, error: 'You need ' + SHOP_PRICE + ' stars.' };
    r.stars -= SHOP_PRICE;
    give(r, id);
    return { ok: true };
  }

  function unique(r) { return Object.keys(r.owned).length; }
  function total(r) { return Object.keys(r.owned).reduce(function (s, id) { return s + r.owned[id]; }, 0); }

  function packProgress(r, packId) {
    var p = PACKS.filter(function (x) { return x.id === packId; })[0];
    var have = p.stickers.filter(function (s) { return r.owned[s[0]]; }).length;
    return { have: have, total: p.stickers.length, complete: have === p.stickers.length };
  }

  function unlockedThemes(r) {
    var ids = ['classic'];
    PACKS.forEach(function (p) { if (packProgress(r, p.id).complete) ids.push(p.theme); });
    return THEMES.filter(function (t) { return ids.indexOf(t.id) >= 0; });
  }

  function theme(r) {
    var on = unlockedThemes(r).map(function (t) { return t.id; });
    var id = on.indexOf(r.boardTheme) >= 0 ? r.boardTheme : 'classic';
    return THEMES.filter(function (t) { return t.id === id; })[0];
  }

  function unlockedTokens(r) { return TOKENS.slice(0, Math.min(TOKENS.length, Math.floor(unique(r) / 10))); }

  // -> true if newly awarded
  function awardTrophy(r, id, day) {
    if (r.badges.trophies[id]) return false;
    r.badges.trophies[id] = day || true;
    return true;
  }
  function awardLetter(r, letter, day) {
    if (r.badges.letters[letter]) return false;
    r.badges.letters[letter] = day || true;
    return true;
  }

  // Every answer: a star for a right one, a sticker every 3 right in a row, a surprise box
  // every 20 answers in a session. -> {star, run, sticker, isNew, box, cheerAt}
  function onAnswer(r, right, rand, sessionCount) {
    var ev = { star: 0, run: 0, sticker: null, isNew: false, box: null, cheerAt: 0 };
    if (right) {
      r.stars += 1; r.starsEarned += 1; ev.star = 1;
      r.run += 1;
      if (r.run > r.bestRun) r.bestRun = r.run;
      if (r.run % 3 === 0) { var id = draw(r, rand); ev.isNew = !r.owned[id]; ev.sticker = give(r, id); }
      if (r.run === 3 || r.run === 5 || r.run === 10) ev.cheerAt = r.run;
    } else {
      r.run = 0;
    }
    ev.run = r.run;
    if (sessionCount > 0 && sessionCount % 20 === 0) ev.box = award(r, rand, 1 + Math.floor(rand() * 2), 'box', '20 answers in a row of practice').id;
    return ev;
  }

  return {
    PACKS: PACKS, ALL: ALL, BY_ID: BY_ID, THEMES: THEMES, TOKENS: TOKENS, TROPHIES: TROPHIES, LEGACY: LEGACY,
    SHOP_PRICE: SHOP_PRICE, PACK_SIZE: PACK_SIZE, RARITY_WEIGHTS: RARITY_WEIGHTS,
    blank: blank, normalize: normalize, fromLegacy: fromLegacy, rollRarity: rollRarity, draw: draw, give: give, drawMany: drawMany,
    award: award, open: open, canBuy: canBuy, buy: buy, unique: unique, total: total, packProgress: packProgress,
    unlockedThemes: unlockedThemes, theme: theme, unlockedTokens: unlockedTokens, awardTrophy: awardTrophy, awardLetter: awardLetter,
    onAnswer: onAnswer
  };
});
