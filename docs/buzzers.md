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

## Two ways to run it

The relay has to exist somewhere. Either it runs on the classroom laptop, or it
lives on the internet. **Hosted is the better option for normal use** — nothing to
start, nothing to install, and it is the only route that survives school WiFi
blocking phone-to-laptop traffic.

---

### A. Hosted (recommended)

One-time setup, then the buzzers are just there.

1. Sign in to [Render](https://render.com) with the GitHub account that owns this
   repo.
2. **New → Blueprint**, pick the `engishism` repo. It reads `render.yaml` and needs
   no further configuration.
3. Wait for the first deploy, then note the address it gives you, something like
   `https://engishism-buzzer.onrender.com`.

That address now serves **everything** — the hub, the join page and the relay, all
from one https origin:

| | Address |
|---|---|
| Teacher | `https://<your-service>.onrender.com/game-hub.html` |
| Students | `https://<your-service>.onrender.com/join.html` |

Use those in class instead of the GitHub Pages URL, leave **⚙ → Relay address**
empty, and everything works with nothing running on your machine. Pushes to
`main` redeploy it automatically.

Two things to know:

- **Free instances sleep when idle** and take a little while to wake. Open the
  teacher page a couple of minutes before the lesson rather than on the bell.
- If you would rather keep using the **GitHub Pages** URL for the hub, you can:
  put the relay address in **⚙ → Relay address**, and send students to
  `…github.io/engishism/join.html?relay=https://<your-service>.onrender.com`.
  Serving both from the relay is simpler, but this works.

The blueprint is a plain container (`Dockerfile`), so Fly.io, Koyeb, Railway or
anything else that runs a Docker image will host it equally well if you prefer a
different provider.

---

### B. On the classroom laptop

No account needed, and it keeps everything inside the room — but you have to start
it each time, and school WiFi may block phones from reaching your machine.

You need Node installed. From the repo:

```bash
node tools/buzzer-relay.js
```

It prints two addresses:

```
  Teacher (this machine):  http://localhost:8080/game-hub.html
  Students (same WiFi):    http://192.168.1.24:8080/join.html
```

Open the teacher address — **not** the Pages URL. Use `PORT=3000 node
tools/buzzer-relay.js` if 8080 is taken.

**Why the relay serves the site as well:** a page served over https from GitHub
Pages is not allowed to talk to a plain-http relay on the local network — browsers
block it as mixed content. Serving both from the same place sidesteps that.

---

## Using it, either way

1. Open the teacher address and turn on **⚙ → Phone buzzers**.
2. Start Race to the Board in **head-to-head**. The bar shows the join address,
   the room code, and how many phones are connected.
3. Students open that address, type the code, their name, and tap their team.

### "buzzer relay not reachable"

The bar tells you which problem it is:

| Message | Meaning |
|---|---|
| `this is the GitHub Pages copy…` | Pages has no relay behind it. Use the hosted address, or set **⚙ → Relay address**. |
| `opened as a file…` | You opened `game-hub.html` off the disk. Same fix. |
| `no relay at <host>…` | Right address, but nothing is answering — the relay isn't running, or is still waking up. |
| `no relay answering at <address>` | A **Relay address** is set in ⚙ and that host isn't responding. |

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

## If the school WiFi blocks the laptop route

Client isolation may stop phones reaching your laptop even on the same network.
Test it in a minute: start the relay locally and try the students' address on your
own phone. If it doesn't load, option B is closed to you and option A is the
answer — which is the same reason Kahoot works in your building and a laptop
server wouldn't.

## Data protection

A hosted relay means student devices connect to a third party, which is worth a
word with whoever handles this at the school — though it is exactly what Kahoot
already does, so there is precedent. The relay itself stores nothing: no accounts,
no history, no database. Names live in memory only while a room is open and are
dropped when it empties.

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
