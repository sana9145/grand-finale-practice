const test = require('node:test');
const assert = require('node:assert');
const { GF, bank } = require('./_load.js');
const mask = GF.mask.mask;

test('masks word forms', () => {
  const cases = [
    ['The chef sharpened all the knives.', 'knife', 'knives'],
    ['She carried the bag. He carries it.', 'carry', 'carri'],
    ['The dog is running fast.', 'run', 'running'],
    ['Be careful near the road.', 'care', 'careful'],
    ['We are hoping for rain.', 'hope', 'hoping'],
    ['Use your toothbrush twice a day.', 'brush', 'toothbrush'],
    ['The doctor took an x-ray of my arm.', 'x-ray', 'ray'],
    ['Sri Lanka is famous for its tea.', 'sri lanka', 'lanka'],
    ['The snow leopard lives in the snow.', 'snow leopard', 'leopard'],
    ['Relating to Africa or its people.', 'african', 'africa'],
    ['August is a hot month.', 'august', 'august'],
    ['The bigger boxes were the biggest.', 'big', 'bigg'],
    ['She walked slowly.', 'slow', 'slowly'],
    ['The babies cried.', 'baby', 'babies'],
    ['He jumped and was jumping.', 'jump', 'jump'],
  ];
  for (const [text, word, gone] of cases) {
    const m = mask(text, word);
    assert.ok(!m.toLowerCase().includes(gone), `${word}: "${m}" still shows "${gone}"`);
    assert.ok(m.includes('_____'), `${word}: nothing masked in "${m}"`);
  }
});

test('capitalised words are masked', () => {
  assert.strictEqual(mask('AUGUST and August and august.', 'august'), '_____ and _____ and _____.');
});

test('multi-word entries become a single blank (does not give away "two words")', () => {
  assert.strictEqual(mask('Sri Lanka is an island.', 'sri lanka'), '_____ is an island.');
  assert.strictEqual(mask('An x-ray photo.', 'x-ray'), 'An _____ photo.');
});

test('every word in the bank is masked in its own meaning and sentence', () => {
  const bad = [];
  for (const w of bank.words) {
    const parts = w.word.split(/[ -]/).concat([w.id]).filter(Boolean);
    for (const field of ['meaning', 'sentence']) {
      const m = mask(w[field], w.word).toLowerCase();
      for (const t of m.match(/[a-z']+/g) || []) {
        for (const p of parts) if (t.replace(/'/g, '').startsWith(p)) bad.push(`${w.word} (${field}): ${m}`);
      }
    }
  }
  assert.deepStrictEqual(bad.slice(0, 10), []);
});
