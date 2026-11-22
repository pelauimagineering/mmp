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
  and a side rail of `clamp(260px, 24vw, 420px)`. The board column is two rows:
  board (1fr) and shown hands (auto, reserved height so the board does not
  jump when the first hand is shown).
- Card width on the board: `min(15vw, 30vh)` so five cards always fit both ways.
- Video is optional. When shown it takes the lower half of the side rail (the
  seat list collapses to a single line), so the board never shrinks.
- Type: clock `clamp(48px, 9vh, 120px)`, blinds `clamp(32px, 6vh, 80px)`,
  names `clamp(18px, 2.4vh, 28px)`. Nothing under 16px on this page.
- Under 1024px (someone opens it on a phone) the same blocks stack and the
  page may scroll.
