---
name: phone-debug
description: Diagnose problems with the Engishism phone layer — buzzers, the join code, students' handsets, the relay, bingo cards, class votes. Use this whenever the user reports that phones are behaving oddly: a buzzer flickering or not appearing, the join code or QR missing, students getting disconnected or thrown out, answers vanishing, a phone showing the wrong thing for the game being played, or a mode that seems to be ignored. Reach for it as soon as a report involves phones, even before reproducing.
---

# Debugging the phone layer

Every phone bug in this project so far has been one of five shapes. Identify the
shape first — the wrong guess costs a whole round of testing, and the user is often
mid-lesson.

## Ask for the one detail that splits the causes

**Does the phone still show its room number while the problem happens?**

That single question separates "the connection is broken" from "the connection is
fine and the armed state is cycling". It has already saved a wasted fix: a buzzer
flickering on and off looked like a dropped connection, the room number was rock
steady throughout, and the real cause was two hub tabs fighting over one room.

Also worth asking: **which game, which phone mode, and does ⚙ show the current
build?** A stale shell serves cached assets silently, and "it didn't deploy" is
usually that.

## The five shapes

### 1. It is configuration, not the game

**By far the most common.** Three reports in a row turned out to be this. A game
looked broken when it was only set up differently — a per-game `phoneMode` override,
or a setting registered with a hard-coded list of games so the newest game silently
missed out.

Check first:

```js
window.HubSettings.get('phoneMode', '<gameid>')   // per-game overrides beat the master
window.HubGames.ids()                              // is the game even registered?
```

Then check whether the setting names games in a literal list rather than `games:'*'`.
That is the single most repeated bug here.

### 2. Two things arming the same handset

A `phoneMode` and a game's own dynamic both trying to own the phone. The tell is that
it looks correct *at first* and changes a moment later — the game arms, then a
reconnect re-asks using the mode and replaces it.

`phoneRoundNow()` is the one definition of what the room should be in. If arming and
re-asking consult different sources, they will disagree, and that disagreement is the
bug rather than a symptom of it.

### 3. A re-ask destroying work in progress

`reaskPhones()` runs on **every** `ready` from the relay — which is every
reconnection of the host's stream, not just the first. Re-arming clears the relay's
lock and its collected responses and resets every handset.

The rule: **re-asking means "the room came back, tell it what is being asked", never
"cancel what is in progress".** It already declines while somebody holds the floor,
while a vote is live, and while the room has answers in hand. If a new kind of work
can be in progress, it needs the same guard.

An arm that changes nothing now sends nothing, which is the general protection — but
if you add a path that arms directly, it bypasses that.

### 4. A connection race in the relay

`tools/buzzer-relay.js` keeps one stream per host and one per player id. Two rules
that both had to be learned:

- **Only remove a stream if it is still the live one.** A reconnecting phone
  re-registers under the same id, and the *old* stream's `close` fires afterwards —
  an unguarded delete removes the connection that just came back, so the phone
  reconnects and is removed again, forever.
- **Tell a replaced stream it was replaced.** Ending it silently is indistinguishable
  from a network drop, so it reconnects and fights the one that replaced it. Two hub
  tabs on one room ping-ponged this way, re-asking the phones on every cycle.

Drive these over raw HTTP, not through a browser — the race is between two
connections and `EventSource` will not let a test hold both. See the `reconnect`
suite for the pattern.

### 5. Something above the board changed height

The room chip and the replies strip sit above the stage and change height on their
own schedule — the room opens asynchronously, phones join, buzzers go live.
**Anything that can occupy vertical space above a board owes it a re-fit**, or the
board keeps the height it had and the bottom of it is pushed off screen.

## Reproducing

Local, with a real relay, two browser contexts:

```bash
node tools/buzzer-relay.js          # serves the hub AND the join page
```

Then drive `http://localhost:<port>/game-hub.html` as the host and
`/join.html` as each phone. The relay must serve both: an https page may not talk to
a plain-http relay, which is why the relay serves the site at all.

Useful probes from the host page:

```js
window.HubSettings.get('phoneMode', '<gameid>')
document.getElementById('buzzer-chip').textContent
document.getElementById('phone-bar').textContent
```

If it will not reproduce locally, the difference is usually **number of tabs,
number of phones, or reconnections**. Try opening the hub twice on the same room
before assuming it is environmental.

## Degradation is a feature — check you have not broken it

No relay, relay dead, or wifi gone must leave the game playing exactly as it does
with phones switched off. The `degradation` suite covers this; run it after any
change to the room lifecycle.

Equally: **a room exists whenever phones are switched on**, in every game. `off` is a
statement about what phones do during a question, not about whether a class can
join. If a change makes the join code conditional again, it is a regression — the
`joinbar` suite asserts it across every registered game.

## Before pushing

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=buzzers,phonemodes,teamvote,phoneteams,degradation,reconnect,strip,joinbar,phonebingo
```

Bump the cache stamp in the four shells or the phone will not see the fix. Then write
what you learned into **Current status** in `CLAUDE.md` — phrased as the *rule*, not
the incident, so the next reader can apply it to a case you did not hit.
