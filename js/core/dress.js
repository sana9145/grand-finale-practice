/* The dress-up studio: a doll with clothes, makeup and accessories bought with stars or won as gifts. No DOM.
   dress = {owned:{itemId:1}, look:{slot:itemId}, looks:[{look, at}], name}
   Items with price 0 are always available. */
(function (root, factory) {
  var GF = (root.GF = root.GF || {});
  GF.dress = factory(GF);
  if (typeof module === 'object' && module.exports) module.exports = GF.dress;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Tabs in the studio, in order. kind: 'color' items show a swatch; the rest show the doll wearing them.
  var SLOTS = [
    { id: 'outfit', label: 'Outfits', icon: '👗' },
    { id: 'outfitColor', label: 'Colours', icon: '🎨', kind: 'color' },
    { id: 'pattern', label: 'Patterns', icon: '🔷' },
    { id: 'hair', label: 'Hair', icon: '💇' },
    { id: 'hairColor', label: 'Hair colour', icon: '🖍️', kind: 'color' },
    { id: 'shoes', label: 'Shoes', icon: '👟' },
    { id: 'head', label: 'Head', icon: '👑' },
    { id: 'eyes', label: 'Eyes', icon: '👀' },
    { id: 'shadow', label: 'Eyeshadow', icon: '✨', kind: 'color' },
    { id: 'lips', label: 'Lips', icon: '💄', kind: 'color' },
    { id: 'cheeks', label: 'Cheeks', icon: '😊' },
    { id: 'paint', label: 'Face paint', icon: '🎭' },
    { id: 'glasses', label: 'Glasses', icon: '🕶️' },
    { id: 'neck', label: 'Necklace', icon: '📿' },
    { id: 'hand', label: 'In her hand', icon: '👜' },
    { id: 'back', label: 'Wings & capes', icon: '🧚' },
    { id: 'pet', label: 'Pets', icon: '🐾' },
    { id: 'backdrop', label: 'Backdrop', icon: '🏞️' },
    { id: 'skin', label: 'Skin', icon: '🙂', kind: 'color' }
  ];

  // [id, slot, name, price, value]   value: a colour, or a style key the doll drawing understands.
  var RAW = [
    ['skin1', 'skin', 'Fair', 0, '#fbe0cc'], ['skin2', 'skin', 'Light', 0, '#f3c79f'], ['skin3', 'skin', 'Medium', 0, '#d9a066'],
    ['skin4', 'skin', 'Brown', 0, '#a86b3c'], ['skin5', 'skin', 'Dark', 0, '#6b4226'],

    ['hair-long', 'hair', 'Long hair', 0, 'long'], ['hair-bob', 'hair', 'Bob', 0, 'bob'], ['hair-ponytail', 'hair', 'Ponytail', 10, 'ponytail'],
    ['hair-pigtails', 'hair', 'Pigtails', 10, 'pigtails'], ['hair-bun', 'hair', 'Top bun', 10, 'bun'], ['hair-braids', 'hair', 'Two braids', 15, 'braids'],
    ['hair-puffs', 'hair', 'Space puffs', 15, 'puffs'], ['hair-curly', 'hair', 'Big curls', 15, 'curly'], ['hair-wavy', 'hair', 'Princess waves', 20, 'wavy'],

    ['hc-brown', 'hairColor', 'Dark brown', 0, '#4a2c1a'], ['hc-black', 'hairColor', 'Black', 0, '#1f1a1a'], ['hc-chestnut', 'hairColor', 'Chestnut', 5, '#8b4a2b'],
    ['hc-blonde', 'hairColor', 'Golden', 10, '#e8c15a'], ['hc-ginger', 'hairColor', 'Ginger', 10, '#d4651f'], ['hc-pink', 'hairColor', 'Candy pink', 15, '#ff7fbf'],
    ['hc-purple', 'hairColor', 'Purple', 15, '#9b5de5'], ['hc-blue', 'hairColor', 'Ocean blue', 15, '#3a86ff'], ['hc-rainbow', 'hairColor', 'Rainbow', 30, 'rainbow'],

    ['out-dress', 'outfit', 'Sundress', 0, 'dress'], ['out-teeskirt', 'outfit', 'Top and skirt', 0, 'teeskirt'], ['out-sporty', 'outfit', 'Sporty', 10, 'sporty'],
    ['out-shalwar', 'outfit', 'Shalwar kameez', 15, 'shalwar'], ['out-jumpsuit', 'outfit', 'Jumpsuit', 15, 'jumpsuit'], ['out-party', 'outfit', 'Party dress', 20, 'party'],
    ['out-tutu', 'outfit', 'Ballet tutu', 20, 'tutu'], ['out-gown', 'outfit', 'Ball gown', 30, 'gown'], ['out-lehenga', 'outfit', 'Lehenga', 40, 'lehenga'],

    ['oc-pink', 'outfitColor', 'Pink', 0, '#ff8fab'], ['oc-blue', 'outfitColor', 'Sky blue', 0, '#5aa9e6'], ['oc-yellow', 'outfitColor', 'Sunny yellow', 5, '#ffd166'],
    ['oc-green', 'outfitColor', 'Mint green', 5, '#7bd389'], ['oc-purple', 'outfitColor', 'Lilac', 10, '#a78bfa'], ['oc-red', 'outfitColor', 'Ruby red', 10, '#ef476f'],
    ['oc-orange', 'outfitColor', 'Orange', 10, '#ff9f45'], ['oc-teal', 'outfitColor', 'Teal', 10, '#2ec4b6'], ['oc-white', 'outfitColor', 'Snow white', 15, '#f7f7fb'],
    ['oc-black', 'outfitColor', 'Midnight', 15, '#2b2b3a'], ['oc-gold', 'outfitColor', 'Gold', 30, '#e9b949'],

    ['pat-plain', 'pattern', 'Plain', 0, 'plain'], ['pat-dots', 'pattern', 'Polka dots', 10, 'dots'], ['pat-stripes', 'pattern', 'Stripes', 10, 'stripes'],
    ['pat-hearts', 'pattern', 'Hearts', 15, 'hearts'], ['pat-stars', 'pattern', 'Stars', 15, 'stars'], ['pat-flowers', 'pattern', 'Flowers', 20, 'flowers'],
    ['pat-sparkle', 'pattern', 'Glitter', 25, 'sparkle'],

    ['sh-trainers', 'shoes', 'Trainers', 0, 'trainers'], ['sh-flats', 'shoes', 'Ballet flats', 5, 'flats'], ['sh-boots', 'shoes', 'Boots', 10, 'boots'],
    ['sh-wellies', 'shoes', 'Wellies', 10, 'wellies'], ['sh-sandals', 'shoes', 'Sandals', 10, 'sandals'], ['sh-party', 'shoes', 'Party shoes', 15, 'party'],
    ['sh-glass', 'shoes', 'Glass slippers', 25, 'glass'],

    ['eye-round', 'eyes', 'Bright eyes', 0, 'round'], ['eye-lashes', 'eyes', 'Long lashes', 5, 'lashes'], ['eye-sparkle', 'eyes', 'Sparkly eyes', 10, 'sparkle'],
    ['eye-wink', 'eyes', 'Wink', 10, 'wink'], ['eye-happy', 'eyes', 'Happy eyes', 10, 'happy'], ['eye-hearts', 'eyes', 'Heart eyes', 25, 'hearts'],

    ['sha-none', 'shadow', 'No eyeshadow', 0, 'none'], ['sha-blue', 'shadow', 'Blue', 10, '#5aa9e6'], ['sha-purple', 'shadow', 'Purple', 10, '#a78bfa'],
    ['sha-pink', 'shadow', 'Pink', 10, '#ff8fab'], ['sha-gold', 'shadow', 'Gold shimmer', 20, '#e9b949'], ['sha-rainbow', 'shadow', 'Rainbow', 30, 'rainbow'],

    ['lip-natural', 'lips', 'Natural', 0, 'none'], ['lip-pink', 'lips', 'Pink', 5, '#ff6fa3'], ['lip-coral', 'lips', 'Coral', 10, '#ff7f6b'],
    ['lip-red', 'lips', 'Red', 10, '#e63946'], ['lip-purple', 'lips', 'Berry', 15, '#9d4edd'], ['lip-glitter', 'lips', 'Glitter gloss', 25, 'glitter'],

    ['chk-none', 'cheeks', 'No blush', 0, 'none'], ['chk-rosy', 'cheeks', 'Rosy cheeks', 0, 'rosy'], ['chk-freckles', 'cheeks', 'Freckles', 10, 'freckles'],
    ['chk-hearts', 'cheeks', 'Heart cheeks', 15, 'hearts'], ['chk-stars', 'cheeks', 'Star cheeks', 15, 'stars'],

    ['fp-none', 'paint', 'No face paint', 0, 'none'], ['fp-star', 'paint', 'Star', 15, '⭐'], ['fp-heart', 'paint', 'Heart', 15, '❤️'],
    ['fp-flower', 'paint', 'Flower', 15, '🌸'], ['fp-butterfly', 'paint', 'Butterfly', 20, '🦋'], ['fp-rainbow', 'paint', 'Rainbow', 20, '🌈'],

    ['hd-none', 'head', 'Nothing', 0, 'none'], ['hd-scarf', 'head', 'Headscarf', 0, 'scarf'], ['hd-bow', 'head', 'Big bow', 5, 'bow'],
    ['hd-headband', 'head', 'Headband', 5, 'headband'], ['hd-flowers', 'head', 'Flower crown', 15, 'flowers'], ['hd-sunhat', 'head', 'Sun hat', 15, 'sunhat'],
    ['hd-catears', 'head', 'Cat ears', 20, 'catears'], ['hd-bunny', 'head', 'Bunny ears', 20, 'bunny'], ['hd-tiara', 'head', 'Tiara', 25, 'tiara'],
    ['hd-unicorn', 'head', 'Unicorn horn', 30, 'unicorn'], ['hd-crown', 'head', 'Golden crown', 40, 'crown'],

    ['gl-none', 'glasses', 'No glasses', 0, 'none'], ['gl-round', 'glasses', 'Round glasses', 10, 'round'], ['gl-sun', 'glasses', 'Sunglasses', 15, 'sun'],
    ['gl-heart', 'glasses', 'Heart glasses', 15, 'heart'], ['gl-star', 'glasses', 'Star glasses', 20, 'star'],

    ['nk-none', 'neck', 'Nothing', 0, 'none'], ['nk-bowtie', 'neck', 'Bow tie', 10, 'bowtie'], ['nk-scarf', 'neck', 'Cosy scarf', 10, 'scarf'],
    ['nk-pearls', 'neck', 'Pearls', 15, 'pearls'], ['nk-locket', 'neck', 'Heart locket', 15, 'locket'], ['nk-medal', 'neck', 'Spelling medal', 30, 'medal'],

    ['hn-none', 'hand', 'Nothing', 0, 'none'], ['hn-balloon', 'hand', 'Balloon', 10, '🎈'], ['hn-flowers', 'hand', 'Flowers', 10, '💐'],
    ['hn-icecream', 'hand', 'Ice cream', 10, '🍦'], ['hn-book', 'hand', 'Books', 10, '📚'], ['hn-bag', 'hand', 'Handbag', 10, '👜'],
    ['hn-umbrella', 'hand', 'Umbrella', 15, '☂️'], ['hn-wand', 'hand', 'Magic wand', 20, 'wand'], ['hn-trophy', 'hand', 'Trophy', 40, '🏆'],

    ['bk-none', 'back', 'Nothing', 0, 'none'], ['bk-cape', 'back', 'Super cape', 20, 'cape'], ['bk-fairy', 'back', 'Fairy wings', 30, 'fairy'],
    ['bk-butterfly', 'back', 'Butterfly wings', 30, 'butterfly'],

    ['pet-none', 'pet', 'No pet', 0, 'none'], ['pet-kitten', 'pet', 'Kitten', 15, '🐱'], ['pet-puppy', 'pet', 'Puppy', 15, '🐶'],
    ['pet-bunny', 'pet', 'Bunny', 15, '🐰'], ['pet-panda', 'pet', 'Panda', 20, '🐼'], ['pet-parrot', 'pet', 'Parrot', 20, '🦜'],
    ['pet-unicorn', 'pet', 'Unicorn', 40, '🦄'], ['pet-dragon', 'pet', 'Baby dragon', 40, '🐉'],

    ['bd-plain', 'backdrop', 'Studio', 0, 'plain'], ['bd-garden', 'backdrop', 'Garden', 10, 'garden'], ['bd-snow', 'backdrop', 'Snowy day', 15, 'snow'],
    ['bd-beach', 'backdrop', 'Beach', 15, 'beach'], ['bd-mountains', 'backdrop', 'Hunza mountains', 20, 'mountains'], ['bd-candy', 'backdrop', 'Candy land', 20, 'candy'],
    ['bd-castle', 'backdrop', 'Castle', 20, 'castle'], ['bd-stage', 'backdrop', 'Fashion stage', 20, 'stage'], ['bd-space', 'backdrop', 'Outer space', 25, 'space']
  ];

  var ITEMS = RAW.map(function (r) { return { id: r[0], slot: r[1], name: r[2], price: r[3], value: r[4] }; });
  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  var SLOT_IDS = SLOTS.map(function (s) { return s.id; });

  var DEFAULT_LOOK = {
    skin: 'skin2', hair: 'hair-long', hairColor: 'hc-brown', outfit: 'out-dress', outfitColor: 'oc-pink', pattern: 'pat-plain',
    shoes: 'sh-trainers', eyes: 'eye-round', shadow: 'sha-none', lips: 'lip-natural', cheeks: 'chk-rosy', paint: 'fp-none',
    head: 'hd-none', glasses: 'gl-none', neck: 'nk-none', hand: 'hn-none', back: 'bk-none', pet: 'pet-none', backdrop: 'bd-plain'
  };
  var MAX_LOOKS = 6;

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function itemsFor(slot) { return ITEMS.filter(function (it) { return it.slot === slot; }); }
  function paidItems() { return ITEMS.filter(function (it) { return it.price > 0; }); }

  function blank() { return { owned: {}, look: clone(DEFAULT_LOOK), looks: [], name: 'Dolly' }; }

  function isOwned(d, id) { var it = BY_ID[id]; return !!it && (it.price === 0 || !!(d && d.owned && d.owned[id])); }

  // A look with every slot filled by a real item she has (anything else goes back to the default).
  function cleanLook(look, d) {
    var out = {};
    SLOT_IDS.forEach(function (slot) {
      var id = isObj(look) ? look[slot] : null;
      var it = BY_ID[id];
      out[slot] = it && it.slot === slot && isOwned(d, id) ? id : DEFAULT_LOOK[slot];
    });
    return out;
  }

  function normalize(x) {
    var d = blank();
    if (!isObj(x)) return d;
    if (isObj(x.owned)) Object.keys(x.owned).forEach(function (id) { if (BY_ID[id] && BY_ID[id].price > 0 && x.owned[id]) d.owned[id] = 1; });
    d.look = cleanLook(x.look, d);
    if (Array.isArray(x.looks)) {
      d.looks = x.looks.filter(function (l) { return isObj(l) && isObj(l.look); }).slice(0, MAX_LOOKS)
        .map(function (l) { return { look: cleanLook(l.look, d), at: typeof l.at === 'number' ? l.at : 0 }; });
    }
    if (typeof x.name === 'string' && x.name.trim()) d.name = x.name.trim().slice(0, 20);
    return d;
  }

  // Put on something she has. -> true if worn
  function wear(d, id) {
    if (!isOwned(d, id)) return false;
    d.look[BY_ID[id].slot] = id;
    return true;
  }

  // Spend stars on an item and put it on. rewards.stars pays. -> {ok, error?, need?}
  function buy(d, rewards, id) {
    var it = BY_ID[id];
    if (!it) return { ok: false, error: 'There is no such item.' };
    if (isOwned(d, id)) { wear(d, id); return { ok: true }; }
    var stars = rewards && typeof rewards.stars === 'number' ? rewards.stars : 0;
    if (stars < it.price) return { ok: false, need: it.price - stars, error: 'You need ' + (it.price - stars) + ' more stars.' };
    rewards.stars = stars - it.price;
    d.owned[id] = 1;
    wear(d, id);
    return { ok: true };
  }

  // A surprise item for the wardrobe: one she doesn't have, cheaper items more likely. -> id or null
  function gift(d, rand) {
    var left = paidItems().filter(function (it) { return !d.owned[it.id]; });
    if (!left.length) return null;
    var weights = left.map(function (it) { return 1 / it.price; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var x = rand() * total;
    for (var i = 0; i < left.length; i++) { x -= weights[i]; if (x <= 0) { d.owned[left[i].id] = 1; return left[i].id; } }
    d.owned[left[left.length - 1].id] = 1;
    return left[left.length - 1].id;
  }

  // A random outfit from what she has (skin and backdrop stay).
  function surprise(d, rand) {
    SLOT_IDS.forEach(function (slot) {
      if (slot === 'skin' || slot === 'backdrop') return;
      var mine = itemsFor(slot).filter(function (it) { return isOwned(d, it.id); });
      d.look[slot] = mine[Math.floor(rand() * mine.length)].id;
    });
    return d.look;
  }

  // -> false when there are already 6 saved looks
  function saveLook(d, now) {
    if (d.looks.length >= MAX_LOOKS) return false;
    d.looks.push({ look: clone(d.look), at: now || 0 });
    return true;
  }
  function wearLook(d, i) { if (!d.looks[i]) return false; d.look = cleanLook(d.looks[i].look, d); return true; }
  function deleteLook(d, i) { d.looks.splice(i, 1); }

  // A look with one item swapped in (for trying on before buying).
  function tryOn(look, id) { var l = clone(look); if (BY_ID[id]) l[BY_ID[id].slot] = id; return l; }

  function counts(d) {
    var paid = paidItems();
    return { owned: paid.filter(function (it) { return d.owned[it.id]; }).length, total: paid.length };
  }

  return {
    SLOTS: SLOTS, ITEMS: ITEMS, BY_ID: BY_ID, DEFAULT_LOOK: DEFAULT_LOOK, MAX_LOOKS: MAX_LOOKS,
    itemsFor: itemsFor, blank: blank, normalize: normalize, isOwned: isOwned, cleanLook: cleanLook, wear: wear, buy: buy,
    gift: gift, surprise: surprise, saveLook: saveLook, wearLook: wearLook, deleteLook: deleteLook, tryOn: tryOn, counts: counts
  };
});
