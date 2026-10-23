// Loads every core module (they attach to globalThis.GF) and the word bank.
const CORE = ['util', 'csv', 'mask', 'letter-names', 'silent-rules', 'difficulty', 'overlay', 'import-merge',
  'scheduler', 'plan', 'today', 'board', 'finale-scoring', 'strategy', 'az', 'stickers', 'mascot', 'migrations', 'storage-schema', 'export'];
CORE.forEach((f) => require('../js/core/' + f + '.js'));
const bank = require('../data/words.json');
const GF = globalThis.GF;
const merged = (overlay) => GF.overlay.merge(bank.words, overlay || GF.overlay.empty(), bank.finale_format.round2.levels);
module.exports = { GF, bank, merged };
