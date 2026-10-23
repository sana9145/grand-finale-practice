/* Ollie the owl: cheers and kind "try again" lines, never the same line twice in a row,
   and brain-break stretches. No DOM. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.mascot = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.mascot;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var CHEERS = ['Brilliant!', 'Super spelling!', 'You got it!', 'Fantastic!', 'Well done!', 'Spot on!', 'Amazing!',
    'Hoot hoot, hooray!', 'Spelling star!', 'You are on fire!', 'Wow, perfect!', 'Clever you!', 'Nailed it!',
    'Owl-standing!', 'Marvellous!', 'Top of the class!', 'That was tricky, and you did it!', 'Ace speller!',
    'Bravo!', 'Every letter right!', 'Woo-hoo!', 'You make it look easy!', 'High five!', 'Superb!',
    'Your brain is buzzing!', 'Champion spelling!', 'Hooray for you!', 'Letter perfect!', 'Keep shining!', 'Magnificent!'];

  var KIND = ['So close! Let\'s look at it together.', 'Nearly! Let\'s look at it together.', 'Good try! Let\'s look at it together.',
    'That one is tricky. Look at the letters.', 'Mistakes help us learn. Let\'s see it.', 'Almost there! Take a good look.',
    'Hoot! Even owls get it wrong sometimes.', 'Good effort! You\'ll get it next time.', 'Tricky word! Let\'s learn it now.',
    'Nice try! Spot the tricky part.', 'Keep going, you\'re doing great.', 'Brave try! Let\'s look closely.',
    'Not quite, but you\'re learning!', 'That word is a sneaky one.', 'Look again, then you\'ll know it.',
    'Every try makes you stronger.', 'Let\'s check the letters together.', 'Ooh, so nearly! Have a look.',
    'You\'re getting closer every time.', 'It\'s okay! Let\'s learn this one.'];

  var STRETCHES = ['Reach up high!', 'Touch your toes!', 'Wiggle your fingers!', 'Roll your shoulders!',
    'Jump like a frog!', 'Stretch like a cat!', 'Spin round slowly!', 'Big deep breath!'];

  // last: the previous line (or null). rand: random function.
  function pick(list, last, rand) {
    var opts = list.filter(function (x) { return x !== last; });
    return opts[Math.floor((rand ? rand() : Math.random()) * opts.length)];
  }

  function cheer(last, rand) { return pick(CHEERS, last, rand); }
  function kind(last, rand) { return pick(KIND, last, rand); }

  // Streak meter cheers.
  function runCheer(n) {
    if (n === 3) return '🔥 3 in a row!';
    if (n === 5) return '🔥🔥 5 in a row! Amazing!';
    if (n === 10) return '🔥🔥🔥 10 in a row! Super speller!';
    return '';
  }

  return { CHEERS: CHEERS, KIND: KIND, STRETCHES: STRETCHES, pick: pick, cheer: cheer, kind: kind, runCheer: runCheer };
});
