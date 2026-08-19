# Plan — extract `E().openRoundOnCard(...)` (a skin-side consolidation)

## Context

The round-first probe (`game-hub/games/connections.js`, findings in
`docs/round-first-probe.md`) confirmed a round can be its own game, and exposed one clear,
earned cleanup: **opening a round on the shared clue card is a ~12-step hand-ordered
sequence now copied in three places** — `jeopardy.js` `jShowClue`, `blockbusters.js`
`openBlockbustersClue`, and the probe's `openConnectionsClue`. Divergence between such
copies is exactly what caused the `onCard` bug during the Jeopardy extraction. Three real
callers is well past the two-caller bar, so the sequence earns a home on the shelf.

**This is a skin-side (host-side) plumbing consolidation — DRY, not a feature.** It does
NOT change how a round is constructed, the round contract, or any round file. No lesson
plays differently the day it lands; it makes writing the *next* card-hosting skin cheap and
kills a drift-bug class. It also auto-fixes the `K.round.fields()` copy footgun (finding
#3-adjacent): that copy becomes the helper's job, not a per-clue line each host can forget.

**Starting state.** Work from branch `claude/jeopardy-extraction-3g5gqa` (HEAD `22edf7d`),
which carries the probe + findings and is one commit ahead of `main`. (Optionally land that
commit on `main` first — it's lab-only and safe — so the probe is a permanent canary.)

## Explicit non-goals (do NOT do these here)

- **#2 advance seam** — a sequence host wiring "next question" in `win()` + `onClueClose()`.
  Leave as-is; it's a different concern (closing/advancing, not opening).
- **#3 modalMode typing** — leave `modalMode` a free string for now.
- **#4 round-owned buttons** — the "derive the button set from what the round declares"
  idea. Deliberately deferred to its own probe/decision; not earned until a second
  self-judging round-first game exists.
- **#5 grouping content channel.** Out of scope.

Keep this change to the open-card sequence only.

## The design

Add one shared function, exposed on `HubEnv` beside the other clue-card members
(`hub-engine.js` ~line 5459, near `openClueCard, closeModal, hideAllActionButtons`). It
performs the **invariant core** every card host repeats, in the load-bearing order; each
host keeps its own pre-work (before the call) and post-work (after, using the return value).

```js
// in hub-engine.js, exposed as E().openRoundOnCard
function openRoundOnCard(o){
  // o = { game, mode, origin, item, source, topline, section,
  //       ask=true, buttons={reveal:true,close:true,skip:false}, skipText }
  currentTile = o.origin || null; modalMode = o.mode;
  document.getElementById('clue-topline').textContent = o.topline || '';
  document.getElementById('clue-section').textContent = o.section || '';
  // THE FIELD-COPY FIX: carry the round's authored fields across automatically
  if(o.source) Kit.round.fields().forEach(f => { if(o.source[f] !== undefined) o.item[f] = o.source[f]; });
  currentClueItem = o.item;
  const rnd = roundOf(o.item, o.game);           // names the host; scopes setup's ctx
  if(rnd) o.item.answer = rnd.state.answer;       // answer derived from the round
  drawPrompt(document.getElementById('clue-text'), o.item, o.game);
  roundEnd();                                     // previous handsets stand down
  const opened = rnd ? roundOpen(rnd) : null;     // opening a round arms the room
  if(!opened && o.ask !== false) askPhones(o.item.text, o.game);
  const ans = document.getElementById('clue-answer');
  ans.textContent = o.item.answer || ''; ans.style.display = 'none';
  hideAllActionButtons();
  const b = o.buttons || { reveal:true, close:true };
  if(b.reveal) document.getElementById('reveal-btn').style.display = 'inline-block';
  if(b.close)  document.getElementById('close-btn').style.display  = 'inline-block';
  if(b.skip){ const s=document.getElementById('skip-btn'); s.textContent=o.skipText||'Skip'; s.style.display='inline-block'; }
  renderRoundButton();                            // AFTER hideAllActionButtons — mints Check
  openClueCard(o.origin || null);
  return rnd;                                     // host does its own post-work with this
}
```

Then add `openRoundOnCard` to the `window.HubEnv` object literal.

### Rewire the three call sites onto it

Each host builds its `item` from its own bank shape (unchanged), computes its `topline`/
`section` strings, then calls `E().openRoundOnCard(...)` for the core and keeps its
specifics around it:

- **`connections.js` `openConnectionsClue`** — the plain case. Replace the whole body with
  one call: `{ game:'connections', mode:'connections', origin:null, item, source:bankItem,
  topline:'CONNECTIONS', section:bankItem.section, buttons:{reveal:true, close:true} }`.
- **`blockbusters.js` `openBlockbustersClue`** — pre-work stays *before* the call (the
  `bbWon`/claimed guards, and closing the hex vote: `bbVoting=false; bbVote=null;
  renderBBVote()`). Call with `{ game:'blockbusters', mode:'blockbusters', origin:hex,
  item, source:clueObj, topline:clueObj.letter, section:clueObj.section,
  buttons:{reveal:true, skip:true}, skipText:'No claim / close' }`. Post-work stays *after*,
  using the returned `rnd`: `if(!rnd) E().clueClaimShow(teams, allTeams)` and `bbTension(true)`.
- **`jeopardy.js` `jShowClue`** — the Daily Double orchestration in `openJeopardyClue`
  (the wager) is unchanged and still calls `jShowClue`. In `jShowClue`, build `item`
  (including `reveal:clue.reveal`), then call with `ask:(!review && !dd)`,
  `topline:` the `$value`/DD string, `buttons:{reveal:!review, close:true}`. Post-work stays
  after: the **review** answer-reveal (`ans.style.display = K.prompt.reveal(...) ? 'none':'block'`),
  `jTension(...)`, `jHintsUsed=0`, `renderHintButton()`. Review is the one genuine wrinkle —
  it reveals the answer immediately; keep those 2 lines in jeopardy after the call.

The helper covers both round and non-round clues (a Blockbusters ordinary letter clue has
`rnd === null` → no `roundOpen`, `askPhones` fires, host shows its chooser). Do not try to
fold the DD wager, the review answer-reveal, the hex chooser, tension or hints into the
helper — those are genuinely game-specific and stay with their game.

## Verification (end-to-end)

This is a shared-surface change touching the open path of two live games, so it earns the
card smoke set. Per `ship-it`: redirect to a file, never `tail`.

1. `node tools/check-syntax.js` — always.
2. Targeted suite (all three hosts + the card + the round + the registry/fit/phone the
   probe registers into):
   ```
   NODE_PATH=$(npm root -g) node tools/smoke-test.js \
     --only=jeopardy,gsjeopardy,jfinish,classic,together,jclock,blockbusters,gsblockbusters,grouping,card,registry,fit,phone > /tmp/run.txt 2>&1
   ```
   Known pre-existing reds (NOT this change): the ordering-726px card, and the gsjeopardy
   "dealt inside a second" timing check — both fail identically on the base commit.
3. Drive the probe in the lab board (the third caller):
   `NODE_PATH=$(npm root -g) node <the drive-connections.js used for the probe>` — the full
   loop must still run (open on card, no board, Check judges, hold, Close pays, next, ending).
4. Bump the cache stamp (`game-hub/` changed) and check-syntax again.
5. Commit; the reasoning goes in the commit body. `CLAUDE.md`: the "layering leaks" note
   should gain a line that a card host opens its round via `E().openRoundOnCard`.

## Files

- `game-hub/hub-engine.js` — add `openRoundOnCard` (near the clue-card helpers) + expose on
  `HubEnv`.
- `game-hub/games/jeopardy.js`, `game-hub/games/blockbusters.js`,
  `game-hub/games/connections.js` — rewire the three open functions onto it.
- Cache stamp across the shells; `CLAUDE.md` one line.
