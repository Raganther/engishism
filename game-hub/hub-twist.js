/* ================= HubTwist — the comeback arithmetic, on the shelf =================

   **What a twist IS, in one place.** Flip's Steal, Swap, Gift, Bounty and Box — and the
   deal that puts them on the back of a card — were written twice: once in the hub's
   Flip and once in Flip Party, the phones-only twin. Two copies of "a steal closes half
   the closing share of the gap" are two facts that will disagree, so the arithmetic
   lives here and both boards call it. Built the way `Kit.vote` is built (axiom 4): it
   takes what it needs — scores, names, who, a target, the settings — and hands back
   the moves and the sentence to say. **It owns no transport, no screen, no timer and no
   phones.** Which board applies the moves, and how (`E().adjust` on the hub, a plain
   `score +=` on the party page), stays the caller's.

   Everything is by competitor INDEX into the arrays the caller passes. A page that keys
   its players by id maps at the seam and back — the shelf never learns the key.

   A move is `{ who, delta, why }`. A result is `{ moves, said, eyebrow, ... }` plus,
   for a box, what the caller must remember (`hold`) or do next (`chain`).

   Loaded standalone (`window.HubTwist`); attaches itself as `Kit.twist` when the hub's
   kit is on the page, so `node tools/shelf.js` lists it beside the rest. */
(function(){
  'use strict';

  /* ---- the faces of a card ----
     `target` is the only thing a board has to branch on: 'above' and 'below' want a
     chooser, 'box' wants the three boxes, null is arithmetic or nothing. */
  const KINDS = {
    plain:  { label:'',       topline:'',       target:null,
              note:'' },
    double: { label:'DOUBLE', topline:'DOUBLE', target:null,
              note:'This card is worth double.' },
    steal:  { label:'STEAL',  topline:'STEAL',  target:'above',
              note:'Win it and take a bite out of somebody ahead of you.' },
    gift:   { label:'GIFT',   topline:'GIFT',   target:'below',
              note:'Win it and the class votes who else gets the same points.' },
    swap:   { label:'SWAP',   topline:'SWAP',   target:'above',
              note:'Win it and trade scores with anyone ahead of you.' },
    bounty: { label:'BOUNTY', topline:'BOUNTY', target:null,
              note:'Finish ahead of the leader and take a bite out of their lead.' },
    box:    { label:'BOX',    topline:'BOX',    target:'box',
              note:'Win it and drop a chip: the bins hold a prize or a forfeit. The further behind you are, the more prizes on your board.' }
  };

  /* ---- what a box can hold ----
     `prize` is which side of the bag it sits on. */
  const BOX = {
    double: { prize:true,  name:'Double',      short:'Double', blurb:'the card pays again' },
    steal:  { prize:true,  name:'Steal',       short:'Steal',  blurb:'take a bite out of somebody ahead' },
    shield: { prize:true,  name:'Shield',      short:'Shield', blurb:'blocks the next steal, swap or bounty aimed at you' },
    extra:  { prize:true,  name:'Pick again',  short:'Again',  blurb:'you choose the next card too' },
    tithe:  { prize:false, name:'Share',       short:'Share',  blurb:'half this card goes to last place' },
    skip:   { prize:false, name:'Lose a turn', short:'Skip',   blurb:'your next pick is skipped' },
    zero:   { prize:false, name:'Empty',       short:'Empty',  blurb:'this card pays nothing after all' }
  };

  const num  = (v, d) => (v == null || !Number.isFinite(Number(v))) ? d : Number(v);
  const unit = (v, step) => Math.max(step, Math.round(v / step) * step);
  const nameOf = (names, i) => (names && names[i] != null) ? String(names[i]) : ('Team ' + (i + 1));
  const shuffle = a => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  /* ---- where a competitor stands ----
     0 at the top, 1 at the bottom, everyone between on the slope of their gap. The one
     number every catch-up device reads, so they cannot disagree about who is behind. A
     room with no spread (all level, or one competitor) is 0 for everybody. */
  function spread(scores){
    return scores.length > 1 && Math.max.apply(null, scores) > Math.min.apply(null, scores);
  }
  function behind(scores, who){
    if(scores.length < 2 || scores[who] == null) return 0;
    const lead = Math.max.apply(null, scores), low = Math.min.apply(null, scores);
    if(lead === low) return 0;
    return (lead - scores[who]) / (lead - low);
  }
  /* Catch-up worth: the leader earns the base, last place earns it times the multiple,
     the rest on the slope. Rounded to the board's unit, never less than one unit. */
  function worth(base, scores, who, o){
    const c = o || {};
    const catchUp = Math.max(1, num(c.catchUp, 1));
    const step = num(c.step, 10);
    return unit(base * (1 + (catchUp - 1) * behind(scores, who)), step);
  }

  /* ---- the deal ----
     `rows` is each card's row index, in card order. A card's chance of carrying a twist
     rises with its row, squared, so the first row is almost always plain points and
     the last row is where the game turns over. The Swap, when it is in, is forced into
     the deepest slot: the biggest reversal on the board is worth nothing to the design
     if it comes out third. Steal leads the cycle because it is the mechanic the game
     exists for; the Box, when it is in, takes every third place after it. Returns one
     kind per card. */
  function deal(rows, o){
    const c = o || {};
    const n = rows.length;
    const kinds = new Array(n).fill('plain');
    const want = Math.round(n * (num(c.pct, 60) / 100));
    if(!want) return kinds;
    const maxRow = Math.max.apply(null, rows);
    const bag = rows.map((r, i) => ({ i, w: Math.pow(r + 1, 2) }));
    const slots = [];
    while(slots.length < want && bag.length){
      const total = bag.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * total, hit = 0;
      for(; hit < bag.length; hit++){ r -= bag[hit].w; if(r <= 0) break; }
      slots.push(bag.splice(Math.min(hit, bag.length - 1), 1)[0].i);
    }
    const list = [];
    if(c.swap !== false) list.push('swap');
    list.push('gift');
    if(c.bounty !== false) list.push('bounty');
    const cycle = c.boxes !== false ? ['steal', 'double', 'box'] : ['steal', 'double'];
    while(list.length < want) list.push(cycle[list.length % cycle.length]);
    list.length = want;
    if(list[0] === 'swap' && slots.length){
      const deepest = slots.reduce((a, b) => (rows[b] >= rows[a] ? b : a), slots[0]);
      slots.splice(slots.indexOf(deepest), 1); slots.unshift(deepest);
      if(maxRow > 0 && rows[deepest] === 0) list[0] = 'steal';   // nowhere deep to put it
    }
    slots.forEach((idx, k) => { kinds[idx] = list[k] || 'steal'; });
    return kinds;
  }

  /* ---- who a twist may be aimed at ----
     Upward only for a steal and a swap: that single constraint makes the mechanic a
     catch-up device rather than a way for the strong to farm the weak, and it is why
     the leader can never steal. A gift points the other way. A swap that only reaches
     the person directly above (`swapNext`) is a leapfrog, one place at a time. */
  function targets(scores, who, kind, o){
    const c = o || {};
    const dir = (KINDS[kind] || {}).target === 'below' ? 'below' : 'above';
    const mine = scores[who] == null ? 0 : scores[who];
    const all = scores.map((s, i) => i)
                      .filter(i => i !== who && scores[i] != null &&
                                   (dir === 'above' ? scores[i] > mine : scores[i] < mine));
    if(kind === 'swap' && c.swapNext !== false && all.length > 1){
      return [all.reduce((a, b) => (scores[b] < scores[a] ? b : a), all[0])];
    }
    return all;
  }
  /* The sentence for a twist with nobody to aim at — it must SAY so: a Steal won by the
     player already in front is the mechanic working, not a bug. */
  function nothing(kind, who, names){
    const k = KINDS[kind] || KINDS.steal;
    return k.label + ' — ' + (k.target === 'below'
      ? 'nobody is behind ' + nameOf(names, who) + '.'
      : 'nobody is ahead of ' + nameOf(names, who) + '. Nothing to take.');
  }

  /* A shield answers a move aimed at its holder: the move fizzles and the shield is
     spent. The caller lends `shielded(target)` — true consumes — so the shelf never
     learns how shields are kept. */
  function blockedBy(c, target, kind, names){
    if(!(c && typeof c.shielded === 'function' && c.shielded(target))) return null;
    return { moves: [], blocked: true, eyebrow: 'SHIELD',
             said: nameOf(names, target) + "'s shield blocks the " + kind + '. Nothing moves.', who: target };
  }

  /* ---- the arithmetic the whole board is for ----
     A steal moves half the closing amount each way, so the gap shuts by `share` and the
     thief can never overtake on a steal alone — being caught is a thing a class accepts,
     being leapfrogged by a card is not. Rounded to the board's own unit. */
  function steal(scores, who, target, o){
    const c = o || {}, names = c.names;
    const b = blockedBy(c, target, 'steal', names); if(b) return b;
    const step = num(c.step, 10);
    const gap  = scores[target] - scores[who];
    const move = unit(gap * num(c.share, 0.5) / 2, step);
    return { moves: [{ who: target, delta: -move, why: 'stolen by ' + nameOf(names, who) },
                     { who,         delta:  move, why: 'steal from ' + nameOf(names, target) }],
             eyebrow: 'STEAL', said: nameOf(names, who) + ' takes ' + move + ' off ' + nameOf(names, target) + '.', who };
  }
  function swap(scores, who, target, o){
    const c = o || {}, names = c.names;
    const b = blockedBy(c, target, 'swap', names); if(b) return b;
    const a = scores[who], z = scores[target];
    return { moves: [{ who,         delta: z - a, why: 'swap with ' + nameOf(names, target) },
                     { who: target, delta: a - z, why: 'swap with ' + nameOf(names, who) }],
             eyebrow: 'SWAP', said: nameOf(names, who) + ' and ' + nameOf(names, target) + ' have swapped scores.', who };
  }
  /* The one twist that points down: the room voted who RECEIVES. */
  function gift(scores, who, target, o){
    const c = o || {}, names = c.names;
    const w = unit(num(c.worth, 100), num(c.step, 10));
    return { moves: [{ who: target, delta: w, why: 'gift from ' + nameOf(names, who) }],
             eyebrow: 'GIFT', said: nameOf(names, target) + ' gets ' + w + ' as well.', who: target };
  }
  /* The Bounty settles itself. Everyone who finished ahead of the leader — by the
     record, `finished` as [{who, place}] — takes the steal's half-share of the gap off
     them. The leader was fixed as the card opened; a Bounty the leader wins is the
     leader defending their lead, and the sentence says so. */
  function bounty(scores, leader, finished, o){
    const c = o || {}, names = c.names;
    if(leader == null || scores[leader] == null)
      return { moves: [], eyebrow: 'BOUNTY', said: 'Bounty — nobody was clearly in front. Nothing to take.', who: null };
    const rows = finished || [];
    const leaderRow = rows.filter(r => r.who === leader)[0];
    const ahead = rows.filter(r => r.who !== leader && scores[r.who] != null && (!leaderRow || r.place < leaderRow.place));
    if(!ahead.length)
      return { moves: [], eyebrow: 'BOUNTY', said: nameOf(names, leader) + ' held the lead — nobody beat their time.', who: leader };
    const b = blockedBy(c, leader, 'bounty', names); if(b) return b;
    const step = num(c.step, 10), share = num(c.share, 0.5);
    const moves = [], taken = [];
    ahead.forEach(r => {
      const gap = scores[leader] - scores[r.who];
      if(gap <= 0) return;
      const move = unit(gap * share / 2, step);
      moves.push({ who: leader, delta: -move, why: 'bounty claimed by ' + nameOf(names, r.who) });
      moves.push({ who: r.who,  delta:  move, why: 'bounty on ' + nameOf(names, leader) });
      taken.push(nameOf(names, r.who) + ' +' + move);
    });
    if(!taken.length)
      return { moves: [], eyebrow: 'BOUNTY', said: 'Bounty — nobody below ' + nameOf(names, leader) + ' beat their time.', who: leader };
    return { moves, eyebrow: 'BOUNTY', said: 'Bounty on ' + nameOf(names, leader) + ': ' + taken.join(', ') + '.', who: ahead[0].who };
  }

  /* ---- the Box ----
     The bag is loaded by the winner's PLACE: a prize's chance runs from ½ − load/2 for
     the leader to ½ + load/2 for last place, everyone between on the slope. `load` 0
     is a fair box for everybody; 1 a near certainty either way. Three are drawn as the
     boxes appear, so the pick is a real one. */
  function drawBox(scores, who, o){
    const load = Math.max(0, Math.min(1, num((o || {}).load, 0.7)));
    const p = Math.max(0.05, Math.min(0.95, 0.5 + (behind(scores, who) - 0.5) * load));
    const side = Object.keys(BOX).filter(k => BOX[k].prize === (Math.random() < p));
    return side[Math.floor(Math.random() * side.length)];
  }
  function boxes(scores, who, o){
    const n = Math.max(1, Math.round(Number((o || {}).count) || 3));
    const out = []; for(let i = 0; i < n; i++) out.push(drawBox(scores, who, o));
    return out;
  }
  /* What an opened box does. `paid` is what the card actually paid the winner (an
     Empty takes exactly that back; a Share halves it), `worth` what a Double pays
     again (catch-up applied by the caller, since only it knows the base). Besides the
     moves the caller gets `hold` — a flag it must keep ('shield', 'skip', 'extra') —
     or `chain: 'steal'`, meaning open the ordinary steal chooser next. */
  function box(kind, scores, who, o){
    const c = o || {}, names = c.names, me = nameOf(names, who);
    const step = num(c.step, 10);
    const eyebrow = 'BOX · ' + (BOX[kind] ? BOX[kind].name.toUpperCase() : String(kind).toUpperCase());
    const paid = num(c.paid, num(c.worth, 100));
    if(kind === 'steal')  return { moves: [], eyebrow, chain: 'steal', said: '', who };
    if(kind === 'double'){ const more = unit(num(c.worth, 100), step);
                           return { moves: [{ who, delta: more, why: 'box · double' }], eyebrow, said: me + "'s card pays again: +" + more + '.', who }; }
    if(kind === 'shield') return { moves: [], eyebrow, hold: 'shield', said: me + ' is shielded from the next steal, swap or bounty.', who };
    if(kind === 'extra')  return { moves: [], eyebrow, hold: 'extra',  said: me + ' picks the next card too.', who };
    if(kind === 'skip')   return { moves: [], eyebrow, hold: 'skip',   said: me + ' loses their next pick.', who };
    if(kind === 'tithe'){
      const below = scores.map((s, i) => i).filter(i => i !== who && scores[i] != null && scores[i] < scores[who]);
      if(!below.length) return { moves: [], eyebrow, said: me + ' is already last — nothing to share.', who };
      const last = below.reduce((a, b) => (scores[b] < scores[a] ? b : a), below[0]);
      const move = unit(paid / 2, step);
      return { moves: [{ who, delta: -move, why: 'box · shared with ' + nameOf(names, last) },
                       { who: last, delta: move, why: 'box · share from ' + me }],
               eyebrow, said: me + ' shares ' + move + ' with ' + nameOf(names, last) + '.', who: last };
    }
    /* zero, and anything unknown, pays nothing after all */
    return { moves: [{ who, delta: -paid, why: 'box · empty' }], eyebrow: 'BOX · EMPTY', said: 'Empty. ' + me + "'s " + paid + ' is gone.', who };
  }

  /* ---- the rulesets: the three comeback dials, as a named bundle ----
     Measured on the balance bench (tools/party-sim.js), not guessed: under the mixed
     values a 90% player beat two 40%s ten games out of ten; under the runaway values
     they won six or seven, the lead changed hands nine times a game and every game
     finished close. The catch-up multiple is the lever that decided it. `twists` is a
     percentage, as the hub's settings row stores it. The hub's Rules row and the
     party lobby's switch both read this table, so the numbers have one home. */
  const RULESETS = {
    mixed:   { label:'Mixed class — the standard rules',                  catchUp:1,   steal:0.5, twists:60 },
    runaway: { label:'Runaway class — one student far out in front',      catchUp:4,   steal:0.8, twists:80 }
  };

  const HubTwist = { kinds: KINDS, BOX, rulesets: RULESETS, spread, behind, worth, deal, targets, nothing,
                     steal, swap, gift, bounty, boxes, drawBox, box, shuffle };
  window.HubTwist = HubTwist;
  if(window.HubKit) window.HubKit.twist = HubTwist;
})();
