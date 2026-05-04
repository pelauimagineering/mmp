# MMP Design System — Skill prompt

When designing for any MMP property (Poker app, Golf/Challenge Cup app, mmp.pelau.com homepage, internal docs), follow this order:

1. **Read first, design second.** Open these files before anything else:
   - `index.html` — the system overview and reading order
   - `Foundations.html` + `tokens.css` — voice, palette, type, spacing, motion
   - `Components.html` + `components.css` — what's already built; reuse before reinventing
   - The relevant kit: `Poker UI Kit.html` (`theme-felt`) or `Golf UI Kit.html` (`theme-links`)

2. **Always link `tokens.css` then `components.css`.** Set the page theme on `<body>` with `theme-felt` (poker, dark) or `theme-links` (golf + homepage, light). All color and spacing must come from CSS custom properties — never hard-code hex.

3. **Voice.** Sound like the guys at the table. First names, light banter, `Fraunces` italic for the lede. Never "User 4," never "Click here to forfeit." See the voice card on `index.html` for do/don't pairs.

4. **Type rules.**
   - Display headings: `var(--font-display)` (Fraunces), 600 weight, italic for emphasis.
   - UI / body: `var(--font-ui)` (Inter), 400/500/600.
   - Numbers (scores, pots, timers): `var(--font-mono)` (JetBrains Mono).
   - Slide titles can use `font-variation-settings: "opsz" 144` for the Fraunces optical-size flair.

5. **Color rules.**
   - Primary brand mark: `--primary` (plaque gold #B5862A on light, gold-amber #D4A017 on dark).
   - Felt green = poker only. Fairway green = golf only. Don't mix.
   - Danger / live indicators: `--accent` (signal red #C8472B).

6. **Components to reach for first** (all in `components.css`):
   - `.btn` family (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-plaque`)
   - `.card-pc` for playing cards (sm/md/lg, suits hearts/diamonds/clubs/spades, `card-back`)
   - `.slide-track` for slide-to-confirm gestures (the peek/fold/post-score motion)
   - `.player-row` for any list of league members
   - `.leader-row` for leaderboards (with `gold` modifier for the top spot)
   - `.plaque` for trophy-archive entries
   - `.timer-card` for blinds / tee-time countdowns

7. **Mobile-first, one-handed.** Hit targets ≥ 44px. Score steppers, slide-to-confirm, big tap zones. The user is holding a drink in the other hand.

8. **Brand assets** live in `assets/`:
   - `mmp-mark.svg` — the M-shape monogram, 64×64, single-color (`currentColor`)
   - `mmp-lockup.svg` — mark + "MMP" wordmark
   - `trophy.jpg` — the actual Challenge Cup, hero image for the homepage

9. **Cross-link the products.** Poker and Golf are siblings under one cup. Every kit has a "Switch to [other]" link in the top bar.

10. **When in doubt, look at the existing kit pages.** They're the canonical examples — copy a section out and adapt it rather than starting from a blank file.
