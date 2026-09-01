# One dynamic, three hosts — physics games that are a round, a board, and a phone party

**Status: design only. Not built.** Written the day the drag rounds' picker split into
*team rule × input*, when the input axis made plain that "how a thing is played" and
"where a thing is played" are separate questions the framework already half-answers.

## Why this exists

The matter.js dynamics (flick a tile, complete a word, knock a neighbour's tile off) are
turning into small games in their own right. The wish is to build each one **once** and
run it in three places without rewriting it:

1. **A classroom round** — on the projector card, inside a game-hub skin. Teacher drives,
   class watches the TV, phones are advisory.
2. **A standalone board game** — its own playground page, its own rules, still a
   board-plus-phones shape (a computer or a big screen present).
3. **A phone-only party game** — *no computer in the room*. One phone shows a QR, the
   others join that phone's room, and the whole game lives on the handsets — e.g. an
   anagram game with the Battle Scrabble dynamic: build your word while opponents flick
   their spent tiles at you.

The thing that must stay true across all three: **the ability is written once and shared.**
Tune the throw-feel, fix the word-completion logic, add a knock rule — and it lands in the
classroom round, the standalone board, and the phone party at the same time. If a change
has to be made in three places, the design has failed.

This is not a new philosophy. It is the project's first axiom — *solve it once, use it
anywhere* — and its rule that **the round is the thing that travels**, pushed one step
further: a dynamic should travel not just between game shows but off the projector
entirely, onto a ring of phones with no host screen at all.

## The one idea: separate the *dynamic* from the *host*

Everything below is one cut. A physics game is two things that today are tangled:

- **The dynamic** — the tiles, the throwing, the slots, what counts as a completed word,
  who a flung tile travels to, when a knock breaks something. This is the *game*, and it
  knows nothing about who is watching or on what screen.
- **The host** — who runs the room, what surface the "board" is drawn on, whose device
  shows the shared picture, how players join. This is the *staging*, and it changes
  completely between a TV and a ring of phones.

**The dynamic is shared code. The host is a thin adapter.** The three products above are
three hosts over one dynamic. Getting this cut right is the whole task; everything else is
plumbing that already mostly exists.

## The tiers, for this specific thing

The project already has the tiers (container / skin / round / content). This is how a
*physics dynamic* maps onto the two shelves that carry it:

| Layer | What it owns | Where it lives today |
|---|---|---|
| **`Kit.table`** | the physics: bodies, slots, throwing, `openSides`/`onExit` (a tile leaving one screen for a neighbour's), the knock rule, dock-feel, the wall-clock step. **The ability.** | `game-hub/hub-table.js` |
| **The dynamic** | the *rules on top of* the table: what the slots mean, what a valid answer is, what a knock does, when you score. Anagram-complete-a-word is a dynamic; Battle Scrabble's cash-every-word is another; the two share `Kit.table` and differ here. | today: half in `Kit.round` rounds, half in the Battle Scrabble page — **not yet a named shared layer** |
| **The host** | the room, the join path, the shared "board" surface, whose device is authoritative. | `hub-engine.js` (classroom), a playground board page (standalone), `join.html` / a phone game page (phones) |

**The gap this doc is really about is the middle row.** `Kit.table` is already shared and
proven (four callers). The *dynamic* — the layer between the raw physics and the host — is
currently written twice: once as round hooks (`anagram` flick), once inside Battle
Scrabble. That duplication is the thing to extract, and the anagram-battle mini-game is the
second caller that forces it.

## The host contract — what every host must supply

A dynamic should be handed everything it can't know for itself, and reach for nothing.
This mirrors `ctx` in the round tier (read fresh, never stashed). A host supplies:

- **Who is in the room** — the list of players, read live (people join and drop all game).
- **A transport** — "send this arm to the players," "here are the replies," "pulse this
  handset." The dynamic never names the relay; it's handed a `send`/`onReply` pair, the
  way `Kit.vote` takes replies and hands back counts.
- **A board surface** — a place to draw the shared picture (the ring, the scoreboard, the
  grid), or `null` when there is no shared screen and every phone draws its own.
- **Who is authoritative** — which device resolves a throw between two players, judges a
  word, owns the score. On a TV it's the board; phone-to-phone it's the host phone.

Give a dynamic those four and it does not care whether it's on a projector or a phone.
That is the same move `Kit.round` already makes for questions; this generalises it to a
game that isn't a question.

## The three hosts, and what each is

### Host A — the classroom round (exists)
The projector card is the board surface; the hub is authoritative; the phone room is the
transport; players are the class. `anagram` flick already runs here. A physics *game*
(not just a question) would be a round whose "answer" is "you completed your word before
the tiles buried you" — judged by the dynamic, drawn on the card.

### Host B — the standalone board game (exists, as Battle Scrabble)
A playground page is the board surface and the authoritative host; the phone room is the
transport; each phone runs the game page itself (declared via `joinPath` / `HubPhonePage`,
not `join.html`). This is already how Battle Scrabble works — the board hosts the seating
ring and routes throws between phones. **This host is the proof the model works.**

### Host C — the phone-only party game (the new piece)
No projector, no computer *in the room*. **One phone takes the host role**: it shows the
QR, runs the ring / scoreboard at phone size, and is authoritative for throws and scoring.
The other phones join it and run the game page. The relay (the server) still lives in the
cloud — "no computer" means no computer in the room, not no server. So Host C is **Host B
with the board shrunk onto a phone and a QR added.**

## What Host C actually needs (the only genuinely new work)

Battle Scrabble is ~90% of Host C already. The missing pieces:

1. **A phone-sized host surface.** The board page assumes a projector's logical width
   (1280, scaled). It needs a responsive mode that reads at 390×844 and shows the ring +
   scoreboard on a phone. This is a layout job, not a logic one — the routing is unchanged.
2. **A QR shown by the host phone.** `hub-qr.js` is already vendored and used by the hub;
   the host phone renders the join QR instead of a projector doing it. One element.
3. **A host that is also a player (optional).** On a TV the host plays nobody. Phone-to-
   phone, the person holding the host phone probably wants to play too — so the host role
   and a player seat may need to coexist on one device. This is the one real design
   question (see below).
4. **Nothing new in the transport.** The relay already holds a room, a per-player seat
   across reconnects, and forwards arbitrary arm shapes. A phone hosting a room is just a
   host *client*, which is what the board page already is.

## The worked target — anagram × Battle Scrabble

The mini-game that forces the extraction, and a good first build because every piece
already exists and only needs recombining:

- **The puzzle** (each phone): your own row of slots; scrambled letters to flick in;
  complete the target word. This is the `anagram` round's completion logic + `Kit.table`.
- **The attack** (between phones): a spent or wrong tile flicked off your screen's open
  edge **travels to a neighbour** with its speed and trajectory, and can knock a letter
  out of their word on a hard hit. This is Battle Scrabble's `openSides`/`onExit` + the
  knock rule, verbatim.
- **The room**: one phone shows the QR, others join; the host phone draws the ring and
  who's finished. Host C.

The tell that the reuse is real: **the completion logic comes from the round, the throwing
from `Kit.table`, the room from the phone room — three existing shelves, no new physics.**
If building it means writing new physics, the cut in "The one idea" was wrong and we stop
and fix that first.

## What exists vs what's new

| Piece | State |
|---|---|
| `Kit.table` physics, throwing, knock, `openSides`/`onExit` | **exists**, 4 callers |
| Phone room: relay, join, QR, per-player seat across reconnect | **exists** |
| A phone running the whole game page (not `join.html`) | **exists** (Battle Scrabble) |
| Board routing throws between phones in a ring | **exists** (Battle Scrabble) |
| A physics dynamic as a *named shared layer* (the middle tier) | **new** — extract from anagram flick + Battle Scrabble on the second caller |
| Phone-sized host surface + host-phone QR (Host C) | **new** — mostly layout |
| Host-is-also-a-player on one device | **new** — the one open design question |
| anagram × Battle Scrabble mini-game | **new** — the recombination that proves it all |

## Open questions — decide before building, not during

1. **Does the host phone also play?** On a TV the host plays nobody; phone-to-phone the
   host probably wants a seat. Either the host role is a thin overlay a player device also
   carries, or one phone is a dedicated "table" that doesn't play. This changes the host
   contract (authoritative-device vs player-device) and should be settled first — it is
   the Host C equivalent of the "a simulated phone never touches the seat" rule.
2. **What is the shared dynamic's exact surface?** The extraction only earns itself with a
   second caller. anagram-battle is that caller. Write the dynamic *inside* the mini-game
   first, and pull it onto the shelf only when the classroom round wants the same thing —
   the project's two-callers rule. Do not build a `Kit.dynamic` on spec.
3. **Which fate for each dynamic?** The existing playground model already offers three:
   stay standalone, graduate whole via `registerGame`, or distil into a `Kit.round` /
   `Kit.table` mode. Host C adds a fourth: **ship as a standalone phone-only game** with no
   hub at all. A given dynamic may take more than one fate — that's the point.
4. **Authority and cheating.** Phone-to-phone with no teacher, the host phone judging words
   means trusting one player's device. Fine for a party; worth naming so nobody is
   surprised when the host can't referee a dispute the way a teacher can.

## Where this sits with the playground

Nothing here bypasses the playground discipline. A new dynamic is still **developed out
fully as a standalone page first**, still borrows the phone room, still must degrade
(Host C's degradation is "the host phone's screen is the shared board — lose it and there
is no game," which is a weaker guarantee than the classroom's teacher-only fallback and
should be stated as such). The `new-playground-game` skill is the procedure; this doc only
adds the idea that a playground game's *host* is now a variable, and one of its values is
"another phone."

**The next concrete step is not code.** It is deciding Open Question 1 (does the host
play?), because the host contract can't be written until that's answered — and once it is,
the anagram × Battle Scrabble mini-game is the build that exercises the whole thing.
