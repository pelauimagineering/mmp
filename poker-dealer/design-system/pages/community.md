# Page override — The board (`/community`)

Inherits `../MASTER.md`. Only differences are listed.

- **Job:** a public, read-only board for the TV or a laptop at the end of the
  table. Read from three metres away. No sign-in.
- **Hard rule:** the page is exactly one viewport tall (`100dvh`) from 1024px
  up and never scrolls. Every size is fluid (`clamp()` on `vh`/`vw`) so the
  same layout holds at 1280 × 720, 1440 × 900 and 1920 × 1080.

```
┌────────────────────────────────────────────────────────────────┐
│ MMP Poker   Pre-flop · Flop · Turn · River      ● Live  Video  │  bar
├───────────────────────────────────────────────┬────────────────┤
│                                               │ Blinds         │
│        [A♠] [K♥] [7♦] [ ] [ ]                 │ 2 / 4          │
│              the board                        │ 5:42           │
│                                               │ next level 4/8 │
├───────────────────────────────────────────────┤────────────────┤
│ Shown hands:  Dee [Q♠][Q♦]   Tony [A♣][J♣]    │ Seats          │
│                                               │ Dee D · Gary SB│
└───────────────────────────────────────────────┴────────────────┘
```

- Grid: bar (auto) over a body of two columns, board column `minmax(0, 1fr)`
  and a side rail of `clamp(250px, 22vw, 400px)`. The board column is two rows:
  board (1fr) and shown hands (auto, reserved height so the board does not
  jump when the first hand is shown).
- Card width on the board: `min(17cqw, 60cqh)` of the board panel, so five cards always fit both ways.
- Video is optional and off by default. When shown it takes the left of the
  screen at a size worth watching, and the right column stacks a compact
  clock, the board and the shown hands (the seat list gives way). The board's
  cards size themselves from their panel with container units, so they always
  fit.
- A full table (9 or 10 seats) switches the seat list to two columns; shown
  hands shrink their cards as more hands are shown. Nothing is clipped.
- When the connection drops, a banner says the board may be behind and the
  board, clock and seats dim until it is live again.
- Type: clock `clamp(48px, 9vh, 120px)`, blinds `clamp(32px, 6vh, 80px)`,
  names `clamp(18px, 2.4vh, 28px)`. Nothing under 16px on this page.
- Under 1024px (someone opens it on a phone) the same blocks stack and the
  page may scroll.
