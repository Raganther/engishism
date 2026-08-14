---
name: ship-it
description: Deploy a change to the live Engishism site, or decide whether it needs testing first. Use this whenever the work is finished and about to be committed, pushed, merged or deployed, when choosing which smoke suite to run, when a fix appears not to have shipped, or when the user says a change "didn't work" on the live site or on their phone. Also use it when a test run looks green but may have been truncated.
---

# Shipping

## The default is: no test suite

The tests open a real browser and play the games. That is worth four minutes when
nobody is watching the screen — but **the user is watching**, on the real site, on a
real phone. For most changes their eyes are faster and better than the robot.

**Small changes taking a long time is the thing this is fixing.** The loop:

1. Make the change.
2. `node tools/check-syntax.js` — two seconds, always, no exceptions.
3. Bump the cache stamp if anything under `game-hub/` moved.
4. Commit, merge to `main`, push. Live in about forty seconds.
5. The user looks, screenshots, says what is wrong.

**Three cases where you stop and ask first.** Say the risk in one line and let the user
choose — never test by habit, and never silently:

- **Something all the games share** — `hub-kit.js`, the shared half of `hub-engine.js`,
  the header, the team bar, the clue card, settings, the fit, `hub.css` outside one
  stage. One mistake breaks five boards and only the opened one gets noticed.
- **Phones or the relay** — `hub-buzzer.js`, `buzzer-relay.js`, `join.html`. The user
  cannot check this alone; it needs a second device, and the suite fakes thirty in
  seconds.
- **Content in bulk** — twenty seconds, and it catches what eyes cannot: the same prompt
  in two banks, an answer whose initial does not match its hexagon.

Everything else — one game's board, one stage's CSS, a new setting, docs, `CLAUDE.md` —
just push.

## The cache stamp

**Bump it whenever a file under `game-hub/` changes**, or Chrome keeps serving the
cached JS and the fix looks like it never shipped.

```bash
sed -i "s/?v=20[0-9]\{6\}[a-z]*/?v=20260814d/g" \
  $(grep -rl '?v=20[0-9]\{6\}' --include=*.html . | grep -v node_modules)
node tools/check-syntax.js          # it walks every stamped page and checks they agree
```

**The date shape in that pattern is load-bearing.** `classic.html` carries `?v=picture`
and `?v=unit1`, which are *content selectors*, not build stamps — a looser
`?v=[0-9a-z]*` rewrites them and breaks the page. Match `20YYMMDD`, never "anything
after `?v=`". Check them afterwards:

```bash
grep -o '?v=[a-z0-9]*' classic.html | sort -u    # must still be picture / unit1
```

**Do not bump for changes outside `game-hub/`** — a skill, `CLAUDE.md`, `docs/`, or
`tools/`. Bumping anyway makes every device re-download the app for nothing and muddies
"which build am I on".

## "It didn't deploy" — usually a stale shell, not a failed deploy

`game-hub.html` carries no stamp of its own, so a browser holding the old shell asks for
the **old** `?v=`, gets its own cached assets, and shows the previous build with no error
anywhere. Two tells:

- ⚙ reports the **old build number** — it reports what the shell *asked for*.
- Raw `___` in a prompt, meaning `Kit.prompt` is not running at all.

The way out from the user's side is a **different URL**: `game-hub.html?fresh=1`. A
plain reload hands back the same stale copy, and in-app browsers (Facebook, Instagram)
hold it hardest and often ignore pull-to-refresh. There is also a reload chip that
detects this itself and offers a tap — but it only appears once the *server* is newer,
so it cannot help before the deploy has landed.

**Before debugging any "the fix isn't there" report, ask which build ⚙ says it is
running.** Two rounds have been lost to this already.

## Which suite

| What changed | Run | Costs |
|---|---|---|
| Content (a bank, a unit file) | `--only=content` | ~20s |
| One game's own logic | `--only=<game>` | ~40s |
| Shared layer 1 | `--only=millionaire,fit,phone,card,turns,gameshow,lab,registry,competition` | ~4 min |
| A playground page | `--only=playground,forms,bench,qbench` | ~1 min |
| A round | `--only=qbench,grouping,anagram,card,gameshow` | ~4 min |
| The Lab board | `--only=grouping,content,jeopardy,card` | ~2 min |
| Phones / relay | add `,buzzers,phonemodes,teamvote,phoneteams,degradation,reconnect,playground,bench` | +6 min |
| Before a lesson you will teach from | the full suite | ~25 min |

```bash
NODE_PATH=$(npm root -g) node tools/smoke-test.js --only=… > /tmp/…/suite.log 2>&1
echo "runner exit: $?"
```

**Never pipe it through `tail`.** `node … | tail` reports the *pipe's* exit code, so a
red run looks green. Redirect to a file — you also get progress while it runs, which
`tail` denies you for fifteen minutes.

**A green-looking partial run is not trustworthy.** A suite that throws fails by name
now and the rest still run, but check which sections actually ran before believing a
total. `315 passed` means nothing if the suite you cared about aborted at check three.

**Waiting for a background run: `pgrep -f smoke-test.js` matches the waiting shell
itself**, because that process's own command line contains the string. A wait-loop
written that way never finishes. Use `ps -eo args | grep "[s]moke-test"` or wait on the
task's own completion.

## The known red

**`ordering on a projector: the whole card is on screen` — 726px on a 720 board**, 6px
over with the action strip on. It is a real layout item on the Next list, deliberately
still red. **It is not your change.** Any other red is.

## Merging

Push straight to `main`; Render redeploys in ~40s and Pages follows.

```bash
git checkout main && git merge --no-ff <branch> -m "…"
git merge-base --is-ancestor origin/main HEAD   # nothing dropped
git diff --stat origin/main HEAD                # only what you meant
git push origin main
```

If local `main` is behind, the merge will also fast-forward it — the file count in the
merge output will look alarming. **Check `git diff --stat origin/main HEAD`**, which
shows only your actual change.

**Retry a failed push up to 4 times with backoff (2s, 4s, 8s, 16s)** — network only,
never a force.

## Last

**Did a decision get made?** Then `CLAUDE.md` gets the entry, in the same push. The
commit hook asks whenever `CLAUDE.md` is not in the commit, and it is right to. The
runs and the reasoning are the only things no suite can reproduce — do not leave them
in chat.
