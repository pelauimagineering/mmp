# MMP Poker — Design System (Master)

The source of truth for the poker dealer's UI on the design-exploration branch.
Page files in `design-system/pages/` override this file where they disagree;
where a page file is silent, this file rules.

Structure follows the ui-ux-pro-max "Master + page overrides" pattern. The
tokens below are implemented once, in `client/src/styles/app.css` (`@theme`),
and consumed through Tailwind utilities. Never hard-code a hex value in a
component.

> Scope: this system covers the poker dealer only. The shared MMP system at
> the repo root (`/design-system`, themes `theme-felt` and `theme-links`) still
> governs the homepage and the golf app and is untouched.

---

## 1. Product

| | |
|---|---|
| Product | Digital card dealer for in-person Texas Hold'em. Betting happens on the real table; the app deals, shows the board, and keeps the blind clock. |
| People | A crew of friends who have played monthly since 2008. First names. Many are reading a phone at arm's length in a dim rec room, drink in the other hand. |
| Surfaces | `/` take a seat (phone) · `/game` your seat (phone first, desktop second) · `/community` the shared board (TV or laptop, read from across the room) |
| Mode | Operate. The player glances, acts, and looks back at the table. Scanability and correctness outrank expression. |
| Category match | Gaming, casual and social, real-time. From the ui-ux-pro-max data: "if casual, increase playfulness"; dark-only theme; real-time status must always be visible. |

### What the design must guarantee

1. **What you see is the table's current state.** Connection state is always
   visible; the app heals itself; nobody should need to refresh.
2. **One phone screen, no scrolling, for the things you do every hand**: the
   board, your two cards, show, fold, and (for the dealer) the next step.
   Everything else lives in collapsible sections.
3. **Numbers read from across the room.** Card ranks, the blind clock and the
   blind amounts are the biggest, highest-contrast things on any screen.

---

## 2. Visual world: the card room

The interface is made from the materials on the real table, and nothing else.

| Material | Where it appears |
|---|---|
| Baize (green felt) | The page itself. Green is the ground, not an accent. |
| Rail (dark stained wood, read as near-black green) | Top bar, bottom action dock, sheets |
| Card stock (ivory) | Playing cards only. The brightest surface on screen. |
| Brass (the Challenge Cup plaque) | The single accent: primary actions, the dealer, the clock when it matters |
| Clay chips | Seat markers: dealer button, small blind, big blind |

**The one bold thing** is the playing card: ivory, large, with real corner
indices set in a Clarendon. Everything around the cards stays quiet.

### Anti-patterns (do not ship)

- Neutral charcoal page with a single neon-green accent (the previous look).
- Glow shadows, gradient text, glass blur, decorative radial halos.
- Cards nested inside cards. A section is separated by space and a hairline.
- All-caps tracked eyebrow labels above headings.
- Emoji as icons. Icons come from one set (Lucide, 1.75 stroke) or are drawn.
- Text below 14px (13px bold is allowed only inside seat chips: D, SB, BB).
- Colour as the only signal. Every state also has a word or an icon.

---

## 3. Colour tokens

Dark only. Ratios are WCAG contrast against the surface named.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `rail` | `#0B2A20` | Top bar, action dock, dialogs | |
| `felt` | `#0F3628` | Page background | |
| `felt-table` | `#15503A` | The board (table surface) | |
| `felt-raised` | `#1D6349` | Hover / pressed surface on the table | |
| `line` | `#2B6E55` | Hairline dividers | decorative |
| `line-strong` | `#4E9A7C` | Control borders, focus-adjacent outlines | 3.95 on felt |
| `chalk` | `#F4F0E4` | Primary text | 11.7 felt · 8.2 table |
| `chalk-dim` | `#C3D2C7` | Secondary text | 8.5 felt · 6.0 table |
| `brass` | `#E2B755` | Accent, primary action fill, dealer | 7.1 felt · 5.0 table |
| `brass-ink` | `#1C1503` | Text on brass | 9.6 |
| `card` | `#FBF8EF` | Card face | |
| `card-ink` | `#17181C` | Spades, clubs | 16.7 on card |
| `card-red` | `#C21F32` | Hearts, diamonds | 5.6 on card |
| `card-back` | `#7A1626` | Card back (burgundy, lattice pattern) | |
| `danger` | `#B93A27` | Fold track, destructive fill (white text) | 5.7 |
| `danger-text` | `#FFA08C` | Destructive text on felt | 4.8 on table |
| `warn` | `#F2C14E` | Clock under 60s | 5.6 on table |
| `chip-blue` | `#8FC1E8` | Small blind chip | 6.9 on felt |

Rules

- Brass is spent on at most one primary action per screen, plus the dealer.
- Red is never placed on green as the only cue: fold and destructive controls
  carry a label and an icon.
- Suits use two colours (traditional deck). Suit glyph and rank are both shown
  on every face-up card, so suit never depends on colour.

---

## 4. Typography

| Role | Family | Why |
|---|---|---|
| Display, card ranks | **Besley** (variable, 400–900) | A Clarendon: the face of playing-card indices and engraved plaques. Sturdy numerals that survive distance. |
| UI and body | **Atkinson Hyperlegible Next** (variable) | Drawn for legibility: unmistakable 1 / I / l and 0 / O, open counters at small sizes. |
| Clock and blinds | **Atkinson Hyperlegible Mono** (variable) | Fixed-width digits so the countdown does not jitter. |

Fonts are self-hosted through `@fontsource-variable/*` (no third-party font
request, `font-display: swap`).

Scale (rem, 16px root). Nothing in the product is smaller than `caption`.

| Token | Size / line | Use |
|---|---|---|
| `caption` | 14 / 20 | Helper text, timestamps |
| `body` | 16 / 24 | Default UI text, player names |
| `lead` | 18 / 26 | Button labels, player names |
| `heading` | 20 / 28 | Section titles ("Your hand", "Players") |
| `title` | 22 / 28 | Page and dialog titles (Besley 600) |
| `display` | 30 / 34 | Login heading (Besley 700) |
| `clock` | 28 | Blind clock and blinds on the phone (labels at `body`) |
| `tv-*` | `clamp()` on `vh`/`vw` | Community board: clock, blinds, names |

Rules: sentence case everywhere. Numerals use `tabular-nums`. Headings use
`text-wrap: balance`. Labels are 600 weight, never tracked-out capitals.

---

## 5. Space, shape, elevation

- 4px grid. Tight inside a group (4–8), generous between groups (16–24).
- Radius: controls 12px · panels 16px · chips and pills full · cards 9% of width.
- Touch targets 48px minimum (44 absolute floor), 8px apart.
- Elevation is tone, not shadow: rail < felt < table < raised. The only real
  shadow is under a playing card (it is a physical object lying on the felt).
- z-index scale: `10` sticky bars · `20` dock · `40` dialog · `50` notices.
- Safe areas: bars pad with `env(safe-area-inset-*)`.

---

## 6. Components

| Component | Spec |
|---|---|
| `PlayingCard` | Aspect 5:7. Face: ivory, rank (Besley 800) over suit, top-left index plus a large centre suit from `md` up. Back: burgundy lattice with ivory border. Sizes are driven by a `--card-w` custom property so one component serves phone, desktop and TV. Face-up cards expose `aria-label="Ace of spades"`. |
| `Board` | Five slots on `felt-table`. Empty slots are outlined placeholders, so the board never changes height between streets. |
| `StreetTrack` | Pre-flop · Flop · Turn · River as four labelled steps (a real sequence). The current street is brass and announced via `aria-current`. |
| `BlindClock` | Mono digits. States: idle, running, under 60s (`warn` + "1 minute left"), under 30s (`danger-text`), paused ("Paused"), expired ("Blinds go up next hand"). State is always spelled out, never colour alone. |
| `SeatChip` | 28px disc: D (ivory disc, ink letter), SB (blue), BB (brass). With accessible names. |
| `Button` | `primary` (brass), `secondary` (outlined chalk), `quiet` (text), `danger` (red fill). 48px tall. One primary per view. Pending state shows a spinner and disables. |
| `SlideToConfirm` | 52px track with a 44px knob; drag to the end (95%). Keyboard: Arrow Right four times, or End. Used for the actions nobody can take back: fold (danger, cross icon, left), show (brass, eye icon, right) and the dealer's "finish the hand". Fold and show differ by position and icon, not only colour. |
| `Disclosure` | Collapsible section: 48px header row with title, a one-line summary of what is inside, and a chevron. Open state is remembered per device. |
| `ConnectionPill` + banner | Live · Reconnecting… · Offline, always in the top bar. When not live, a full-width banner adds the sentence and "Sync now"; on the TV the board, clock and seats also dim so stale cards never look current. |
| `Notice` | One transient message at a time, top centre just under the header so it never covers a control; `aria-live="polite"`; errors are `role="alert"` and say what to do next. |
| `Dialog` | Native `<dialog>` for reset and other confirmations. |

---

## 7. Motion

- 140ms for press and hover, 220ms for disclosure and notices, 420ms for a card
  turning over. Ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`), no bounce.
- Motion only answers an event: a card is revealed, a section opens, a notice
  arrives. Nothing loops except a reconnect spinner.
- Transform and opacity only. All of it is removed under
  `prefers-reduced-motion: reduce`.

---

## 8. Voice

Sound like the crew at the table: first names, plain verbs, a little dry.

| Instead of | Write |
|---|---|
| Login | Take a seat |
| Player has folded | Tony folded |
| Flip Community Card | Turn the flop |
| Error: not authenticated | Your seat timed out. Take a seat again. |
| Disconnected | Reconnecting… your cards are safe. |

An action keeps its name all the way through: the button says "Deal", the
notice says "Dealt".

---

## 9. Pre-delivery checklist

- [ ] No horizontal scroll at 390px; no vertical scroll for the core hand loop on 390 × 664.
- [ ] `/community` shows every element at 1440 × 900 and 1920 × 1080 without scrolling.
- [ ] All text ≥ 14px and ≥ 4.5:1; controls ≥ 3:1; targets ≥ 44px.
- [ ] Visible `:focus-visible` ring (brass, 2px, offset 2px) on every control.
- [ ] Every gesture has a tap and a keyboard path.
- [ ] `prefers-reduced-motion` honoured.
- [ ] Connection state visible on every screen that shows live data.
