# Review log

What was checked on this branch, what it found, and what was left alone on purpose.

## Critique (impeccable, two independent reviewers)

First pass scored 25 / 40 on Nielsen's heuristics with one P0.

| Finding | Severity | Outcome |
|---|---|---|
| Dealer dock covered "Slide to fold" on a 390 × 664 screen | P0 | Fixed. Slides sit side by side; hand loop ends at 573px, dock starts at 591px. |
| Phone never said you were a blind; clock and blinds too small | P1 | Fixed. Own seat markers beside "Your hand"; 28px numbers, 16px labels. |
| One tap between the dealer and an irreversible action | P1 | Fixed. 800ms lock after each street, slide to finish the hand, clock restart moved to the menu. |
| TV clipped a full table instead of handling it | P1 | Fixed. Two seat columns from 9 seats; shown-hand cards shrink with count. Checked at 1280 × 720, 1440 × 900, 1920 × 1080 with 10 seats and 7 shown hands. |
| Show and fold were identical twins | P2 | Fixed. Different side, different icon, label stays readable while dragging. |
| TV looked current while offline | P2 | Fixed. Banner sized for distance; board, clock and seats dim. |
| Seat-chip letters were 13px | measured | Fixed. 14px minimum. |
| Flat heading scale (16 / 16 / 16) | detector | Fixed. 16 body, 20 headings. |

Detector after the polish pass: 0 findings on 16 scans (8 pages × 390 and 1440).

Not changed, by choice:
- Joining is still a separate tap after taking a seat (that is how the server works today).
- Hold-to-peek shows the full card faces, as before.
- The footer line keeps its emoji; it is the crew's sign-off, not an icon.

## Web Interface Guidelines

Fixed: skip links on every page; `scroll-padding` so sticky bars never cover
the focused control; the login button stays enabled and explains what is
missing next to the field; the slide control animates with `transform` only;
logging out asks first (it gives up your seat); long names truncate
everywhere; the two fonts every page needs are preloaded.

Deliberate exception: the guidelines ask for Title Case on headings and
buttons. This system uses sentence case throughout (MASTER.md §4, §8).

## Layout checks

Every page and scene is captured at 390 and 1440 wide in `screenshots/`.
No page scrolls sideways at either width. `/community` is exactly one
viewport tall at 1280 × 720, 1440 × 900 and 1920 × 1080. On a phone the hand
loop fits 390 × 664 in every scene except a showdown with other players'
hands on the board, which runs 12px over.

## Tests

- `npm test`: six sync regression tests against the real server. The
  reconnect test fails on the previous server code and passes now.
- A browser run with two players and the TV (join, pick dealer, deal, peek,
  flop, server restart mid-hand, turn, show, fold by keyboard, finish, pause
  the clock, arrange seats, reset with a wrong phrase, log out) passes.
