# MMP Poker Data: Key Findings

_Updated 2026-05-01 — includes the April 2026 final event._

## Overview
- **11 players** tracked across **4 seasons** (2022-23 through 2025-26)
- **17 events** played across the dataset, plus 2 "No Games" months on record
- **Span**: Nov 2022 – Apr 2026 (3.5 years of tournament history)

## All-Time Leaders

Cumulative leaderboard, summing each player's final YTD across all seasons they played (Nov 2022 – Apr 2026):

1. **Seymour**: 166.5 points (4 seasons) — 35 + 41 + 40.5 + 50
2. **Neave**: 154.0 points (4 seasons) — 52.5 + 21 + 30.5 + 50
3. **Harish**: 146.5 points (4 seasons) — 52.5 + 16 + 23 + 55
4. **Junior**: 132.5 points (4 seasons) — 32 + 0 + 63 + 37.5
5. **Kerwin**: 120.0 points

Seymour holds the all-time lead by 12.5 over Neave; both broke 50 in 2025-26. Note: an earlier draft of this doc listed Neave at "404" — that was a calculation error (summing every event-snapshot YTD instead of season-final YTDs). The numbers above match what the site renders.

## Season Winners

| Season | Winner | Points | Notes |
|---|---|---|---|
| **2025–26** | **Harish** | 55.0 | Came from 4th to 1st in the final event |
| 2024–25 | Junior | 63.0 | Sat out 2023-24, returned to win outright |
| 2023–24 | Seymour | 41.0 | Three played events (no Nov/Dec/Apr) |
| 2022–23 | Neave | 52.5 | Tied with Harish on points; Neave took it on tiebreak |

No repeat winners across the 4 tracked seasons. The trophy has rotated every year.

## The Headline: Harish's April Heist

Going into the April 2026 finale, the standings sat: Neave 48, Seymour 38, Kerwin 33.5, Gary 33, Harish 33. Then in one night, Harish posted a **22-point event** (1 win + 2 runner-ups across multiple games of the night) — the biggest single-event total in the entire dataset — vaulting from T-4 to season champion. Neave (+2) and Seymour (+12) climbed but came up short, finishing tied for 2nd at 50.

This is a strong narrative the homepage should lead with.

## Attendance & Reliability

**Most reliable** (4/4 seasons, played near every event):
- Neave, Seymour, Chris, Harish, Kerwin

**Sparse participants**:
- Lorenzo: never appears (0 appearances across all seasons)
- Tony: ~25% of appearance slots filled
- Wayne: ~35% of appearance slots filled

The core group is stable; treat Lorenzo and Tony as data noise on highlight cards (but keep them in standings tables — they're part of the league).

## Hot Streaks & Movement

**Biggest single-event total in the dataset**: Junior, 32 pts (Nov 2022)
**Biggest single-event in 2025-26**: Harish, 22 pts (Apr 2026) — won the season with it
**Biggest year-over-year gain**: Junior, 0 → 63 (2023-24 → 2024-25)
**Recent momentum (2024-25 → 2025-26 final YTD)**:
- Harish: +32 (23 → 55)
- Kerwin: +27.5 (13 → 40.5)
- Neave: +19.5 (30.5 → 50)
- Gary: +27 (8 → 35)

## Tie Splits

Across 17 played events, ~25% had at least one tie split. The 2025-26 season had 4 tie splits, all in Jan/Feb. April 2026 had no ties. Decimals (7.5, 9.5, 2.5) must be preserved in the UI — rounding would misrepresent the data.

## Data Quality Notes (for the parser)

1. April 2026 (2025-26) had a stray space `' '` in Harish's Tie cell — parser treats it as None.
2. Earlier xlsx exports used `(Host: Neave)` and `(Neave)` interchangeably — host name is normalized.
3. Some event blocks render as placeholders before being played (all-None player rows). These get `played: false`.
4. Lorenzo and Tony's zero rows are not missing data — they genuinely didn't play.

## Design & Homepage Priorities (post-April)

1. **Harish's season-stealing April** is the lead story for 2025-26
2. **All-time leader card** still belongs to Neave (404), with Seymour now within 2.5 points
3. **Tied-for-2nd** result is a fun visual detail — show the T-rank treatment in the standings
4. **Host rotation** callout — events were hosted by Darren, Seymour, Junior, Neave, then Harish (April host data missing in source — flag for confirmation)
5. **Tie splits** need decimal preservation in any column displaying points
