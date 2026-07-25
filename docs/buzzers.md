# Phone buzzers

Students join on their phones and buzz for the right to answer. Built for
**Race to the Board, head-to-head**, where the engine otherwise can't know who
got there first.

It is an **optional layer**. With buzzers off — or the relay unreachable, or the
WiFi down — the hub behaves exactly as it always has, and you pick the team
yourself with the on-screen chips or the `1` / `2` keys. Nothing about the
existing games depends on this.

---

## Why there's a relay at all

Phones can't talk to your laptop directly. School and guest WiFi almost always
run *client isolation*, which blocks device-to-device traffic on the local
network — and even without it, browsers give a page no way to accept an incoming
connection.

Kahoot solves this by never doing device-to-device at all: every phone and the
teacher's laptop each open an **outbound** connection to a server, which relays
between them. That's why Kahoot works on school WiFi, and it's the same shape
here. `tools/buzzer-relay.js` is that server.

It is deliberately tiny — SSE downstream, HTTP POST upstream, no dependencies,
no database, no accounts. Rooms live in memory and disappear when empty.

---

## Running it

You need Node installed. From the repo:

```bash
node tools/buzzer-relay.js
```

It prints two addresses:

```
  Teacher (this machine):  http://localhost:8080/game-hub.html
  Students (same WiFi):    http://192.168.1.24:8080/join.html
```

1. Open the **teacher** address on the classroom machine.
2. Turn on **⚙ → Phone buzzers**.
3. Start Race to the Board in **head-to-head**. A code appears on the bar.
4. Students open the **students** address, type the code, their name, and tap
   their team.

Use `PORT=3000 node tools/buzzer-relay.js` if 8080 is taken.

**The relay serves the site as well as the buzzers, and that is deliberate.** A
page served over https from GitHub Pages is not allowed to talk to a plain-http
relay on the local network — browsers block it as mixed content. Serving both
from the same place sidesteps that entirely. So for a buzzer lesson, run the hub
from the relay, not from the Pages URL.

---

## How a round plays

1. A sentence goes up → **buzzers arm**, phones light up green with `BUZZ`.
2. First student to buzz takes the floor. Their name and team appear on the bar;
   every other phone greys out with `Too late`.
3. That student goes to the board and touches a word; you click it.
   - **Right** → the point goes to the buzzing student's team automatically. You
     are never asked who was first.
   - **Wrong** → no penalty, the sentence stays up, and the **buzzers re-open** so
     the other team can steal it.
4. Next sentence, buzzers arm again.

If nobody has buzzed when you click a correct word, it falls back to asking —
so you can mix buzzing and non-buzzing students in the same game.

---

## If the school WiFi blocks it

Client isolation may stop phones reaching your laptop even on the same network.
Test it in one minute: start the relay and try the students' address on your own
phone. If it doesn't load, the LAN route is closed to you.

The fix is to put the relay somewhere on the internet instead, exactly as Kahoot
does. `tools/buzzer-relay.js` is plain Node with no dependencies, so it will run
on most small hosts as-is. Then:

- Deploy it and note its **https** address.
- Put that address in **⚙ → Relay address**.
- Students can then use the GitHub Pages `join.html` — add the relay as a query
  parameter so they don't have to type it:
  `…/join.html?relay=https://your-relay.example`

Over https the mixed-content problem disappears and the hub can go back to being
served from GitHub Pages.

Note that a hosted relay means student devices connect to a third party — worth a
word with whoever handles data protection, though it is exactly what Kahoot
already does. The relay stores nothing: no accounts, no history, and rooms are
dropped from memory once empty.

---

## Protocol

Small enough to re-implement on another host if you ever want to.

| Call | Purpose |
|---|---|
| `GET /buzzer/newcode` | `{code}` — an unused 5-digit room code |
| `GET /buzzer/stream?room=&role=host` | SSE: `ready`, `join`, `leave`, `buzz` |
| `GET /buzzer/stream?room=&role=player&id=&name=&team=` | SSE: `joined`, `armed`, `disarmed`, `locked`, `reset`, `teams` |
| `POST /buzzer/send` | `{room, type}` where type is `arm`, `disarm`, `reset`, `teams`, or `buzz` |
| `GET /buzzer/health` | `{ok, rooms}` |

**Who wins is decided at the relay, not on the phones.** The first `buzz` to
arrive locks the room and everything after it is ignored. Phone clocks can't be
trusted and the host hearing about a buzz first doesn't mean it was pressed
first, so judging every buzz at the same point on the wire is the fairest thing
available without clock synchronisation.

A room survives the host reloading (five-minute grace) so a stray refresh mid-game
doesn't throw the class out.

---

## Known limits

- **Untested with a real class.** It has been driven end-to-end with scripted
  browsers only — two phones, join, buzz, steal, disconnect. Latency and
  behaviour on real handsets over real WiFi are unknown.
- **No reconnect-into-the-same-identity.** A phone that reloads rejoins as a new
  player and must re-enter the code.
- **Nothing stops a student buzzing for the wrong team** — they pick their own
  team on joining. Fine for a classroom, useless as an anti-cheat measure.
- **Head-to-head Race only.** Jeopardy and Blockbusters ignore buzzers so far;
  the obvious next step is using them to pick which team answers a tile.
