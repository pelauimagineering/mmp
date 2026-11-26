# Page override — Your seat (`/game`)

Inherits `../MASTER.md`. Only differences are listed.

- **Job:** see the board, peek at your cards, show or fold. If you hold the
  button: deal and turn the streets.

## Phone (under 1024px)

The hand loop fits one screen with no scrolling (target: 390 × 664 visible).

```
┌──────────────────────────────────┐
│ MMP Poker           ● Live   ☰   │  top bar (rail)
│ Blinds   Until blinds go up  [⏸] │  clock strip: 28px numbers
│ 2/4      5:42                    │
├──────────────────────────────────┤
│ Pre-flop · Flop · Turn · River   │  street track
│ [A♠] [K♥] [7♦] [ ] [ ]           │  board on the table felt
│ 7 still in · 1 folded            │
│ Shown hands: Tony [K♦][10♦]      │  only once someone shows
├──────────────────────────────────┤
│ Your hand          Hold to peek  │
│ (SB) You're the small blind, 2   │  your own seat markers
│        [▒▒]  [▒▒]                │
│ [✕ Slide to fold][👁 Slide to show]│  side by side
├──────────────────────────────────┤
│ ▸ Players · 8 seated · Dee deals │  disclosures (collapsed)
│ ▸ Video table                    │
├──────────────────────────────────┤
│ [        Turn the flop        ]  │  dealer dock (rail), dealer only
└──────────────────────────────────┘
```

- The clock strip and the top bar are one sticky block.
- Disclosures sit below the fold line by design: everything above them is the
  per-hand loop. Their headers summarise their content so most hands never
  need them opened.
- The dealer's next step is the single brass control, docked to the bottom
  thumb zone: "Deal", "Turn the flop", "Turn the turn card", "Turn the river".
  Finishing the hand clears the board and every shown hand, so it is a slide
  ("Slide to finish the hand"), not a tap. The dock locks for 800ms after each
  street so a double tap cannot turn two cards.
- Shuffle appears beside "Deal" between hands only. Pause / resume sits on the
  clock strip; restarting the clock is in the menu (it cannot be undone).
- Shown hands are part of the hand loop, so they sit on the board panel rather
  than in a drawer. Your own shown hand is not repeated there: it is already
  face up under "Your hand".
- Measured: the hand loop ends at 573px and the dealer dock starts at 591px on
  a 390 × 664 screen.
- Before you have joined, the hand area is replaced by a single "Join the
  game" action.

## Desktop (1024px and up)

Two columns inside a 1200px frame, nothing scrolls at 1440 × 900:
left (flexible) = board with shown hands, your hand; right (360px) = players
and video. Disclosures are open by default on desktop.

## Page-specific rules

- Hole cards are face down until held. Holding anywhere on the cards peeks;
  releasing hides. Keyboard: hold Space on the hand.
- Card size here: board fills the panel width up to 96px (112px on desktop);
  hand `clamp(72px, min(24vw, 13dvh), 120px)` so short phones get shorter cards.
- In "Arrange seats" (dealer, between hands) each row keeps to one line:
  name, markers, then Out / Back in and the two move arrows.
- Destructive, table-wide actions (reset the game, log out) live in the menu,
  never on the main surface.
