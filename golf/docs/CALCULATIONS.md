# MMP Golf — How the Numbers Work

This is the rulebook for MMP golf scoring, rewritten in plain language
from the original *Calculations* document and the retired spreadsheet
(`MMP_Touring_Series_v3.xlsx`). Every formula here was extracted from
the spreadsheet's actual cell formulas and verified against the 2026
season's numbers.

Three calculations run the league, in this order after every round:

1. **Event scoring** — how many points each player earns in a round.
2. **Handicap calculation** — how each player's handicap updates after
   the round, ready for the next one.
3. **Championship standings** — how round points add up to crown the
   season champion.

The code that implements all of this lives in
[`golf/lib/golf-calc.js`](../lib/golf-calc.js) (browser + Node), with a
server-side mirror in
[`golf-supabase/migrations/0009_scoring_fixes.sql`](../../golf-supabase/migrations/0009_scoring_fixes.sql).
The tests in [`golf/scripts/test-calc.mjs`](../scripts/test-calc.mjs)
replay the 2026 season and confirm the engine reproduces the
spreadsheet's handicaps exactly.

---

## 1. Event scoring

Every player who shows up earns points from this menu:

| Points | For | Notes |
|-------:|-----|-------|
| **+5** | Attendance | Show up and play at least 9 holes. |
| **+1** | Each par | Raw count — handicap does not adjust these. |
| **+3** | Each birdie | |
| **+10** | Each eagle | Not yet achieved — the app is ready anyway. |
| **+20** | Each albatross | Same. |
| **+25** | Each hole-in-one | Same. |
| **+3** | Low round | Lowest **net** score of the day (see below). |
| **−1 per band** | Over-par penalty | See below — no upper limit. |

**Round total = 5 (attendance) + scoring points + low-round points − penalty.**

A few working numbers used throughout:

- **Net** = gross strokes − handicap. This is what makes an amateur
  round comparable to par.
- **Handicap par** = course par + handicap. The score a player is
  "expected" to shoot.
- Courses differ: par is usually 72 but not always — the app reads it
  from the course table.

### The over-par penalty

If you shoot more than 5 strokes above your handicap par, you lose a
point for every 5-stroke band you fall into, **with no upper limit**:

> diff = gross − (course par + handicap)
>
> - 6–10 over → −1
> - 11–15 over → −2
> - 16–20 over → −3
> - 21–25 over → −4 … and so on.

*Example (2026, round 1 at Kedron Dells):* Junior shot 110 with a
handicap of 19. Handicap par = 72 + 19 = 91, so he was 19 over — that's
the 16–20 band: **−3 points**.

**9-hole rounds:** halve both numbers — par becomes par ÷ 2 and the
handicap counts at half value. (Gross 47, handicap 10 → 47 − 36 − 5 = 6
over → −1.)

### Low round (3 points)

The player with the lowest **net** score (gross − handicap) among those
who played all 18 holes wins 3 points. Players without a recorded
handicap, or who played only 9 holes, aren't eligible.

*Example (2026, round 1):* Neave shot 112 with a handicap of 36 —
net 76, the lowest of the day. +3 points.

**Ties split the points evenly:** a two-way tie pays 1.5 each, a
three-way tie 1 each. (This matches the championship sheet, where
half-point rounds appear.)

---

## 2. Handicap calculation

The point of the handicap is to let players of different abilities
compete on equal footing. It is recalculated **after every round** —
this is the "Running Handicap".

### What each course contributes

Every course has two published difficulty numbers (from the tees the
league plays, usually the Blues):

- **Slope** — how much harder the course plays for an amateur than for
  a scratch golfer (113 = average).
- **Rating** — the score a scratch golfer is expected to shoot.

The app keeps these in a course table
([`golf/data/courses.json`](../data/courses.json) → Supabase `courses`),
seeded with the 38 courses the league has played or scouted. **Playing a
new course?** The score-entry form asks for its par, slope and rating
once, and remembers it.

### Step 1 — Handicap Index for the round

After each round, every player who played gets an index for that round:

> **Handicap Index = (gross − course rating) × 113 ÷ course slope**

*Example (2026, round 2 at Silver Lakes — slope 129, rating 71.2):*
Junior shot 92.
Index = (92 − 71.2) × 113 ÷ 129 = **18.2**.

- **Played only 9 holes?** Double the gross first (average strokes per
  hole extended to 18): a 9-hole 55 counts as 110.
- **Missed the round?** You're held steady: the round contributes your
  **season starting handicap** as its index, so sitting out doesn't
  move your number. (The spreadsheet faked this by inserting a made-up
  score; the app just uses the value directly.)

### Step 2 — Running Handicap

After every round, each player's Running Handicap is the average of
their **season starting handicap** plus **every round's index so far**,
rounded to a whole number:

> **Running Handicap = round( (starting + index₁ + … + indexₙ) ÷ (n + 1) )**

*Example — Junior through 2026:* starting handicap 19.

| After round | Indexes so far | Average | Running |
|------------|----------------|--------:|--------:|
| 1 · Kedron Dells (110) | 33.2 | (19 + 33.2) ÷ 2 = 26.1 | **26** |
| 2 · Silver Lakes (92) | 33.2, 18.2 | 23.5 | **23** |
| 3 · Westview (92) | + 17.1 | 21.9 | **22** |
| 4 · Shawneeki (96) | + 22.5 | 22.0 | **22** |
| 5 · Kedron Dells (94) | + 19.1 | 21.5 | **22** |

### Step 3 — Use it for the next round

The handicap used to **score** a round is the Running Handicap as it
stood **before** that round started. Round 1 uses the season starting
handicap. The score-entry form pre-fills this automatically (the
organizer can still override it), and the number is frozen onto the
round — editing old rounds later never rewrites history.

### Season end

The **next season's starting handicap** is the average of the season's
round indexes **without** the starting handicap in the mix:

> **Season-end handicap = round( (index₁ + … + indexₙ) ÷ n )**

*Example:* Junior's five 2026 indexes average 22.0 → he starts next
season at **22**. Tony's average 30.7 → **31**.

### Special cases (from the original sheet's margin notes)

- **Didn't finish 18 holes** → the score extends by average strokes per
  hole (the 9-hole × 2 rule).
- **Missed a round** → held at starting handicap for that round (above).
- **Missed the whole season** → carry last season's handicap forward.

---

## 3. Championship standings

Round points accumulate all season, and the highest total wins the cup —
with one twist:

> **Only your best 10 rounds count.**

If the season has 12 rounds, everyone drops their 2 lowest-scoring
rounds; 11 rounds, drop 1; 10 or fewer, everything counts. This keeps
one bad day (or a missed round) from deciding the season.

*Example:* 12 rounds played, your round scores are
9, 8, 13, 7, 11, 6, 9, 10, 8, 12, 5, 9. Drop the 5 and the 6 —
your championship total is the sum of the remaining ten: **96**.

Ties in the standings are broken by rounds attended, then
alphabetically. The standings page shows "best 10 of N" whenever
rounds are being dropped.

---

## Appendix — deliberate differences from the spreadsheet

1. **Low round is always lowest net.** The sheet's written rules and
   the championship tab agree on net; one server-side formula had
   drifted to lowest gross. Fixed to net everywhere.
2. **Low-round ties split the 3 points** (1.5 / 1.5), as the
   championship tab actually recorded them — the per-event tab's
   formula paid each winner in full. The split is now the rule
   everywhere.
3. **Missed rounds hold you at exactly your starting handicap.** The
   sheet back-solved whole-number fake scores, which could drift a
   handicap by ±1 (e.g. Wayne, who missed every 2026 round, drifted
   56 → 55). The app holds the number exactly — truer to the rule's
   intent.
4. **The penalty has no floor**, matching the current app rule
   (−1 per 5-stroke band, forever). The sheet's formula stopped at −3
   and its own notes said automation should go further.
