# MMP Poker — Design plan

Written with the frontend-design process (plan, check against the brief,
build, critique) and working inside `MASTER.md`. This is the plan every page
was built from.

## Subject, audience, job

- **Subject:** a monthly in-person poker night among old friends. The app is
  the dealer: it hands out hole cards to phones and turns the board on a TV.
- **Audience:** the crew. Phone in one hand at a dim table; one shared screen.
- **Job of the design:** show the true state of the hand at a glance, and get
  out of the way.

## Tokens (from MASTER.md)

- **Colour:** felt `#0F3628`, table `#15503A`, rail `#0B2A20`, chalk `#F4F0E4`,
  brass `#E2B755`, card ivory `#FBF8EF` (+ card red `#C21F32`, burgundy back).
- **Type:** Besley (display, card indices), Atkinson Hyperlegible Next (UI),
  Atkinson Hyperlegible Mono (clock, blinds).
- **Layout concept:** "the table, then the drawer". The hand loop is a fixed
  stack that fits one screen; everything occasional sits in collapsible
  drawers beneath it. Left-aligned text; only the cards and the clock centre.
- **Principles:** (1) the cards are the only bright thing; (2) state is spelled
  out in words, never colour alone; (3) the next step is one brass button;
  (4) the connection is always visible and self-healing.

## Layout options considered

```
A. Tabs (Table | Players | Video)      B. Table, then drawers (chosen)
┌───────────────┐                      ┌───────────────┐
│ board         │                      │ clock strip   │
│ hand          │                      │ board         │
│               │                      │ hand + slides │
│ [T] [P] [V]   │                      │ ▸ players     │
└───────────────┘                      │ ▸ shown hands │
                                       │ [dealer step] │
                                       └───────────────┘
```

A hides who is dealing and who has folded behind a tab switch, and tabs
compete with the dealer's button for the bottom edge. B keeps a one-line
summary of each drawer visible ("7 seated · Dee deals") so the answer is
usually on screen without opening anything. B also degrades to the desktop
two-column layout by simply opening the drawers in a side column.

## Review against the brief

| Brief | Plan | Verdict |
|---|---|---|
| Inherit all functionality | Every WebSocket message and REST call of the old client is mapped to a control (see table below). | Kept |
| Client went out of sync, needed refresh | Server: multiple sockets per user, heartbeat, versioned state. Client: endless reconnect, resync on wake, stale-socket watchdog, render only from server state. Visible Live / Reconnecting pill with "Sync now". | Addressed at the cause, plus a visible fallback |
| Too much scrolling on a phone | Hand loop fixed above the fold; players, shown hands, video are disclosures; logout and reset move into a menu; dealer step docks at the bottom. | Addressed |
| `/community` must fit a desktop viewport | One-viewport grid, fluid sizes on `vh`/`vw`, video in the side rail instead of a fixed 1100px block. | Addressed |
| Numbers and small text highly readable | 14px floor, hyperlegible UI face, mono tabular clock, Clarendon card indices, all text ≥ 4.5:1. | Addressed |
| React + Tailwind, sample data, responsive | Vite + React 19 + Tailwind 4; `?demo=` scenarios with the real crew's first names; fluid from 360px to 1920px. | Addressed |

### Where the first draft was generic, and what changed

- First draft kept the existing charcoal page with a green accent: that is the
  stock "near-black plus one acid accent" look. **Changed** to felt as the
  ground colour, brass as the only accent.
- First draft put board, hand, timer, and players each in a rounded bordered
  panel (the SaaS card kit). **Changed**: only the board is a surface (it is
  the table); other groups are separated by space and one hairline.
- First draft labelled sections with small tracked capitals. **Changed** to
  sentence-case titles at `lead` size, which also reads better at arm's length.
- First draft used pill-shaped coloured status badges for folded / broke.
  **Changed** to plain words in `chalk-dim` plus a struck-through or dimmed
  name: quieter, and it doesn't rely on colour.
- Kept on purpose: the four-step street track. Pre-flop → flop → turn → river
  is a real sequence, so a stepped marker carries information here.

## Feature parity map

| Old control | New home |
|---|---|
| User select + display name + "Take a seat" | Login: name grid, display name field, "Take a seat" |
| Community Display link | Login: "Put the board on the TV" |
| Join Game | Game: "Join the game" in the hand area |
| Community cards, phase | Board + street track |
| Blind timer, blinds, "blinds will increase" | Clock strip (and TV side rail) |
| Timer pause / resume / reset (dealer) | Clock strip buttons (dealer only) |
| Hold to peek | Hold the hand (touch, mouse, Space) |
| Slide to show / slide to fold | `SlideToConfirm` × 2 |
| Dealer: shuffle, deal, flip | Dealer dock: next-step button + shuffle |
| Players list with D / SB / BB / folded / broke | Players drawer |
| Click a player to make them dealer; random dealer | Players drawer: "Make dealer" per row, "Pick a dealer at random" |
| Dealer drag-to-reorder | Players drawer: drag (pointer) plus move up / down buttons |
| Dealer broke toggle | Players drawer: "Out of chips" toggle per row |
| Revealed hands | Shown hands drawer (and TV bottom row) |
| Show Video toggle | Video drawer (TV: Video button) |
| Reset Game (phrase + confirm) | Menu → dialog |
| Logout (name) | Menu |
| Switch to Golf, MMP home | Menu and login footer |
| Connection status | Connection pill in the top bar |
| Footer "Made with 💕 in the 6ix" (tap to reload) | Kept in the menu and login footer |
| Overlay notifications | `Notice` |
