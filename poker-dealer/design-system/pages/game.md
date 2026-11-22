# Page override — Your seat (`/game`)

Inherits `../MASTER.md`. Only differences are listed.

- **Job:** see the board, peek at your cards, show or fold. If you hold the
  button: deal and turn the streets.

## Phone (under 1024px)

The hand loop fits one screen with no scrolling (target: 390 × 664 visible).

```
┌──────────────────────────────────┐
│ MMP Poker      ● Live     ⋯ menu │  top bar (rail), 52px
│ Blinds 2 / 4        5:42  ⏸ ↻    │  clock strip
├──────────────────────────────────┤
│ Pre-flop · Flop · Turn · River   │  street track
│ [A♠] [K♥] [7♦] [ ] [ ]           │  board on the table felt
├──────────────────────────────────┤
│ Your hand          Hold to peek  │
│        [▒▒]  [▒▒]                │
│ [ ▸ Slide to show ]              │
│ [ ▸ Slide to fold ]              │
├──────────────────────────────────┤
│ ▸ Players · 7 · Dee deals        │  disclosures (collapsed by default)
│ ▸ Shown hands · 2                │
│ ▸ Video table                    │
├──────────────────────────────────┤
│ [        Turn the flop        ]  │  dealer dock (rail), dealer only
└──────────────────────────────────┘
```

- The clock strip and the top bar are one sticky block.
- Disclosures sit below the fold line by design: everything above them is the
  per-hand loop. Their headers summarise their content so most hands never
  need them opened.
- The dealer's next step is the single brass button, docked to the bottom
  thumb zone. Its label is always the next step: "Deal", "Turn the flop",
  "Turn the turn card", "Turn the river", "Finish the hand".
- Shuffle and the clock controls are secondary: shuffle sits beside the dock
  button; pause and reset sit on the clock strip.
- Before you have joined, the hand area is replaced by a single "Join the
  game" action.

## Desktop (1024px and up)

Two columns inside a 1200px frame, nothing scrolls at 1440 × 900:
left (flexible) = board, your hand, dealer step; right (360px) = players,
shown hands, video. Disclosures are open by default on desktop.

## Page-specific rules

- Hole cards are face down until held. Holding anywhere on the cards peeks;
  releasing hides. Keyboard: hold Space on the hand.
- Card size here: board `clamp(52px, 16.5vw, 96px)`, hand `clamp(84px, 26vw, 132px)`.
- Destructive, table-wide actions (reset the game, log out) live in the menu,
  never on the main surface.
