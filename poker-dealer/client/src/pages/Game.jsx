import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, LogOut, Menu, Pause, Play, RefreshCw, RotateCcw, Shuffle, TimerReset, Tv, X } from 'lucide-react';
import { boot } from '../lib/boot.js';
import { cardName } from '../lib/cards.js';
import { DEMO_SCENARIOS, DEMO_USER } from '../lib/demo.js';
import { useBlindClock } from '../lib/useBlindClock.js';
import { useTable } from '../lib/useTable.js';
import { BlindsValue, CLOCK_TONE_TEXT, ClockDigits } from '../components/BlindClock.jsx';
import { Board, PlayingCard, StreetTrack } from '../components/cards.jsx';
import { SlideToConfirm } from '../components/SlideToConfirm.jsx';
import { VideoRoom } from '../components/VideoRoom.jsx';
import {
  Brand,
  Button,
  ConnectionBanner,
  ConnectionPill,
  Dialog,
  Disclosure,
  IconButton,
  Notice,
  SeatChip,
  SeatChips,
  SkipLink,
  cx,
} from '../components/ui.jsx';

const NEXT_STEP = {
  'pre-flop': 'Turn the flop',
  flop: 'Turn the turn card',
  turn: 'Turn the river',
};

function useSession() {
  const [session, setSession] = useState(boot.demo ? { user: DEMO_USER, token: 'demo' } : null);

  useEffect(() => {
    if (boot.demo) return;
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((data) => {
        if (!data.authenticated) {
          window.location.assign('/');
          return;
        }
        setSession({ user: data.user, token: data.token });
      })
      .catch(() => window.location.assign('/'));
  }, []);

  return session;
}

export default function Game() {
  const session = useSession();
  const user = session?.user ?? null;
  const table = useTable({
    mode: 'game',
    token: session?.token ?? null,
    demo: boot.demo ?? null,
    userId: user?.id ?? null,
    enabled: session !== null,
  });
  const { state, status, send, notify } = table;
  const clock = useBlindClock(state?.timerState, table.clockOffset);

  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Lock the dealer's buttons from a tap until the table answers, so a double
  // tap can never turn two streets.
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [state?.version, state]);
  useEffect(() => {
    if (!busy) return undefined;
    const id = setTimeout(() => setBusy(false), 2500);
    return () => clearTimeout(id);
  }, [busy]);
  // ...and for a beat after the street changes, so a second tap that lands
  // just after the table answers cannot turn another card or end the hand.
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 800);
    return () => clearTimeout(id);
  }, [state?.phase, state?.cardsDealt]);
  const dockLocked = busy || settling;

  const act = useCallback(
    (type, data) => {
      if (send(type, data)) setBusy(true);
    },
    [send],
  );

  const players = state?.players ?? [];
  const me = players.find((player) => player.id === user?.id) ?? null;
  const dealer = players.find((player) => player.isDealer) ?? null;
  const iAmDealer = Boolean(me?.isDealer);
  const cardsDealt = Boolean(state?.cardsDealt);
  const holeCards = state?.holeCards ?? [];
  const revealedHands = state?.revealedHands ?? [];
  const iHaveShown = revealedHands.some((hand) => hand.userId === user?.id);
  // Your own shown hand is already face up in "Your hand"; the board lists everyone else's.
  const othersShown = revealedHands.filter((hand) => hand.userId !== user?.id);
  const wideScreen = useMemo(() => window.matchMedia('(min-width: 1024px)').matches, []);

  const logout = async () => {
    if (boot.demo) {
      window.location.assign('/?demo=1');
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.assign('/');
    }
  };

  const slideTimedOut = useCallback(() => notify('No answer from the table. Try that again.', 'error', 5000), [notify]);

  const foldedCount = players.filter((player) => player.hasFolded).length;
  const boardStatus = !state
    ? 'Finding the table…'
    : cardsDealt
      ? `${state.activePlayerCount ?? players.length - foldedCount} still in${foldedCount ? ` · ${foldedCount} folded` : ''}`
      : players.length === 0
        ? 'Nobody is seated yet'
        : dealer
          ? `${iAmDealer ? 'You deal' : `${dealer.name} deals`} the next hand`
          : 'Waiting for a dealer';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col [--notice-top:7.75rem] lg:[--notice-top:4.75rem]">
      <SkipLink href="#table">Skip to the table</SkipLink>

      <header className="sticky top-0 z-10 bg-rail pt-safe lg:rounded-b-panel">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 px-safe lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:gap-x-6">
          <h1 className="py-2 text-heading">
            <Brand />
          </h1>
          <ConnectionPill status={status} />
          <IconButton label="Menu" onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
            <Menu aria-hidden="true" className="size-6" />
          </IconButton>

          <div className="col-span-full row-start-2 flex items-center gap-4 border-t border-line py-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center lg:gap-8 lg:border-t-0">
            <p className="flex flex-col gap-0.5">
              <span className="text-body leading-5 text-chalk-dim">Blinds</span>
              <BlindsValue blinds={state?.blinds} className="text-[1.75rem]" />
            </p>
            <p className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-none">
              <span
                className={cx(
                  'truncate text-body leading-5',
                  clock.tone === 'running' || clock.tone === 'idle' ? 'text-chalk-dim' : cx('font-semibold', CLOCK_TONE_TEXT[clock.tone]),
                )}
              >
                {clock.label}
              </span>
              <ClockDigits clock={clock} className="text-[1.75rem]" />
            </p>
            {iAmDealer && (state.timerState?.isRunning || state.timerState?.isPaused) ? (
              state.timerState.isPaused ? (
                <IconButton label="Resume the clock" onClick={() => act('resume-timer')} disabled={busy} className="border border-line-strong">
                  <Play aria-hidden="true" className="size-5" />
                </IconButton>
              ) : (
                <IconButton label="Pause the clock" onClick={() => act('pause-timer')} disabled={busy} className="border border-line-strong">
                  <Pause aria-hidden="true" className="size-5" />
                </IconButton>
              )
            ) : null}
          </div>
        </div>
        <ConnectionBanner status={status} onSync={table.syncNow} />
      </header>

      <main id="table" tabIndex={-1} className="flex-1 px-safe pt-2 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:pt-6">
        <div>
          <section aria-label="The board" className="rounded-panel bg-table px-3 pt-2 pb-3 lg:px-6 lg:pb-5">
            <StreetTrack phase={state?.phase} />
            <Board
              cards={state?.communityCards ?? []}
              className="mt-3 [--card-w:clamp(48px,calc((100vw-3.5rem)/5.48),96px)] lg:[--card-w:112px]"
            />
            <p className="mt-2 text-center text-body text-chalk">{boardStatus}</p>

            {othersShown.length > 0 ? (
              <div className="mt-2 border-t border-line pt-2">
                <h2 className="text-lead font-semibold">Shown hands</h2>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2 [--card-w:40px] lg:[--card-w:52px]">
                  {othersShown.map((hand) => (
                    <li key={hand.userId} className="flex items-center gap-2">
                      <span translate="no" className="max-w-[9ch] truncate text-body font-semibold">
                        {hand.playerName}
                      </span>
                      <span className="flex gap-1">
                        {hand.cards.map((card, index) => (
                          <PlayingCard key={index} card={card} faceUp />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <Hand
            ready={state !== null}
            me={me}
            dealer={dealer}
            cardsDealt={cardsDealt}
            holeCards={holeCards}
            shown={iHaveShown}
            playerCount={players.length}
            busy={busy}
            act={act}
            send={send}
            blinds={state?.blinds}
            onSlideTimeout={slideTimedOut}
          />
        </div>

        <aside className="mt-4 lg:mt-0">
          <Disclosure
            id="players"
            title="Players"
            defaultOpen={wideScreen}
            summary={
              players.length === 0
                ? 'Nobody yet'
                : `${players.length} seated${dealer ? ` · ${iAmDealer ? 'you deal' : `${dealer.name} deals`}` : ''}`
            }
          >
            <Players
              players={players}
              userId={user?.id}
              iAmDealer={iAmDealer}
              cardsDealt={cardsDealt}
              busy={busy}
              act={act}
            />
          </Disclosure>

          <Disclosure id="video" title="Video table" summary="For anyone joining remotely" keepMounted>
            <VideoRoom jwtToken={boot.jwtToken} demo={Boolean(boot.demo)} className="aspect-video w-full" />
          </Disclosure>
          <div className="border-t border-line" />
        </aside>
      </main>

      {iAmDealer ? (
        <div className="sticky bottom-0 z-20 border-t border-line bg-rail px-safe pt-3 pb-safe lg:rounded-t-panel">
          <div className="mx-auto flex max-w-xl gap-3">
            {!cardsDealt ? (
              <>
                <Button onClick={() => act('shuffle-deck')} disabled={dockLocked} className="flex-none px-4">
                  <Shuffle aria-hidden="true" className="size-5" />
                  Shuffle
                </Button>
                <Button tone="primary" className="flex-1" disabled={dockLocked} onClick={() => act('deal-cards')}>
                  Deal
                </Button>
              </>
            ) : state.phase === 'river' ? (
              // Finishing clears the board and every shown hand, so it takes a slide, not a tap.
              <div className="flex-1">
                <SlideToConfirm
                  key={settling ? 'settling' : 'ready'}
                  label="Slide to finish the hand"
                  onConfirm={() => (settling ? false : send('flip-community-card'))}
                  onTimeout={slideTimedOut}
                />
              </div>
            ) : (
              <Button tone="primary" className="flex-1" disabled={dockLocked} onClick={() => act('flip-community-card')}>
                {NEXT_STEP[state.phase] ?? 'Turn the next card'}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <Notice notice={table.notice} onDismiss={table.dismissNotice} />

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={user ? `Seated as ${user.display_name}` : 'Menu'}>
        <ul className="-mx-2 flex flex-col">
          <MenuItem
            icon={RefreshCw}
            onClick={() => {
              table.syncNow();
              setMenuOpen(false);
              notify('Synced with the table');
            }}
          >
            Sync now
          </MenuItem>
          <MenuItem icon={Tv} href={boot.demo ? '/community?demo=flop' : '/community'} target="_blank">
            Open the board for the TV
          </MenuItem>
          {iAmDealer && state?.timerState && (state.timerState.isRunning || state.timerState.isPaused || state.timerState.blindsWillIncrease) ? (
            <MenuItem
              icon={TimerReset}
              onClick={() => {
                setMenuOpen(false);
                if (send('reset-timer')) notify('Clock restarted at 7:00');
              }}
            >
              Restart the blind clock
            </MenuItem>
          ) : null}
          <MenuItem href="https://mmp.pelau.com/golf/">Switch to golf</MenuItem>
          <MenuItem href="https://mmp.pelau.com/">MMP home</MenuItem>
          <MenuItem
            icon={LogOut}
            onClick={() => {
              setMenuOpen(false);
              setLogoutOpen(true);
            }}
          >
            Log out…
          </MenuItem>
          <li aria-hidden="true" className="my-2 border-t border-line" />
          <MenuItem
            danger
            icon={RotateCcw}
            onClick={() => {
              setMenuOpen(false);
              setResetOpen(true);
            }}
          >
            Reset the game…
          </MenuItem>
        </ul>

        {boot.demo ? (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="text-body font-semibold">Sample scenes</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {DEMO_SCENARIOS.map(([key, label]) => (
                <li key={key}>
                  <a
                    href={`/game?demo=${key}`}
                    aria-current={boot.demo === key ? 'page' : undefined}
                    className={cx(
                      'inline-flex min-h-11 items-center rounded-control border px-3 text-body font-semibold',
                      boot.demo === key ? 'border-brass text-brass' : 'border-line-strong hover:bg-raised',
                    )}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-11 w-full rounded-control text-caption text-chalk-dim hover:text-chalk"
        >
          Made with 💕 in the 6ix
        </button>
      </Dialog>

      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Leave the table?">
        <p className="text-body text-chalk-dim">
          Logging out gives up your seat{cardsDealt && me ? ' and your cards in this hand' : ''}. You can take a seat again from the
          start screen.
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="flex-1" onClick={() => setLogoutOpen(false)}>
            Stay
          </Button>
          <Button tone="danger" className="flex-1" onClick={logout}>
            Log out
          </Button>
        </div>
      </Dialog>

      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} notify={notify} />
    </div>
  );
}

function MenuItem({ icon: Icon, href, target, danger = false, onClick, children }) {
  const className = cx(
    'flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left text-lead font-semibold hover:bg-raised',
    danger ? 'text-danger-text' : 'text-chalk',
  );
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" className="size-5 flex-none" /> : <span aria-hidden="true" className="size-5 flex-none" />}
      {children}
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} target={target} rel={target ? 'noreferrer' : undefined} className={className}>
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {content}
        </button>
      )}
    </li>
  );
}

/** Your two cards, the peek gesture, and the two slides. */
function Hand({ ready, me, dealer, cardsDealt, holeCards, shown, playerCount, busy, act, send, blinds, onSlideTimeout }) {
  const [peeking, setPeeking] = useState(false);
  const hasCards = holeCards.length > 0;
  const folded = Boolean(me?.hasFolded);

  // Never leave cards face up after the hand changes or the tab is hidden.
  useEffect(() => {
    const hide = () => setPeeking(false);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  useEffect(() => {
    if (!hasCards) setPeeking(false);
  }, [hasCards]);

  const faceUp = peeking || shown;
  const hint = shown ? 'Shown to the table' : folded ? 'You folded' : hasCards ? 'Hold to peek' : null;

  let empty = null;
  if (!ready) {
    empty = <p className="text-body text-chalk-dim">Finding your seat…</p>;
  } else if (!me && !cardsDealt) {
    empty = (
      <>
        <p className="text-body">You’re not in this game yet.</p>
        <Button tone="primary" className="mt-3 w-full" disabled={busy} onClick={() => act('join-game')}>
          Join the game
        </Button>
      </>
    );
  } else if (!me) {
    empty = <p className="text-body">A hand is in progress. You can join as soon as it finishes.</p>;
  } else if (!hasCards && cardsDealt) {
    empty = <p className="text-body">You’re sitting this hand out.</p>;
  } else if (!hasCards && !dealer) {
    empty = (
      <>
        <p className="text-body">Nobody has the button yet.</p>
        <Button className="mt-3 w-full" disabled={busy || playerCount === 0} onClick={() => act('choose-dealer')}>
          Pick a dealer at random
        </Button>
        <p className="mt-2 text-caption text-chalk-dim">Or open Players below and choose someone.</p>
      </>
    );
  } else if (!hasCards) {
    empty = (
      <p className="text-body">
        {me.isDealer ? 'Deal when everyone’s ready.' : `No cards yet. ${dealer.name} deals next.`}
      </p>
    );
  }

  return (
    <section aria-labelledby="hand-title" className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="hand-title" className="text-heading font-semibold">
          Your hand
        </h2>
        {hint ? <p className="text-body text-chalk-dim">{hint}</p> : null}
      </div>
      {/* Your own seat markers, so "do I post?" never needs the Players drawer. */}
      {me && (me.isDealer || me.isSmallBlind || me.isBigBlind) ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
          {me.isDealer ? (
            <span className="inline-flex items-center gap-1.5">
              <SeatChip kind="dealer" /> You have the button
            </span>
          ) : null}
          {me.isSmallBlind ? (
            <span className="inline-flex items-center gap-1.5">
              <SeatChip kind="small" /> You’re the small blind, {blinds?.small ?? 1}
            </span>
          ) : null}
          {me.isBigBlind ? (
            <span className="inline-flex items-center gap-1.5">
              <SeatChip kind="big" /> You’re the big blind, {blinds?.big ?? 2}
            </span>
          ) : null}
        </p>
      ) : null}

      {empty ? (
        <div className="mt-2 rounded-panel border border-dashed border-line-strong p-4">{empty}</div>
      ) : (
        <>
          <button
            type="button"
            disabled={shown}
            aria-label={
              faceUp
                ? `Your cards: ${holeCards.map(cardName).join(' and ')}`
                : 'Your two cards, face down. Hold to peek.'
            }
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture?.(event.pointerId);
              setPeeking(true);
            }}
            onPointerUp={() => setPeeking(false)}
            onPointerCancel={() => setPeeking(false)}
            onLostPointerCapture={() => setPeeking(false)}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                setPeeking(true);
              }
            }}
            onKeyUp={() => setPeeking(false)}
            onBlur={() => setPeeking(false)}
            className={cx(
              'mx-auto mt-2 flex justify-center gap-3 rounded-panel p-1 select-none [-webkit-touch-callout:none]',
              '[--card-w:clamp(72px,min(24vw,13dvh),120px)] disabled:cursor-default',
              folded && !faceUp && 'opacity-60',
            )}
          >
            {holeCards.map((card, index) => (
              <PlayingCard key={index} card={card} faceUp={faceUp} />
            ))}
          </button>

          {/* Fold on the left with a cross, show on the right with an eye: told apart by place and shape, not only colour. */}
          <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-3">
            <div>
              {!folded ? (
                <SlideToConfirm label="Slide to fold" tone="danger" icon={X} onConfirm={() => send('fold-hand')} onTimeout={onSlideTimeout} />
              ) : null}
            </div>
            <div>
              {!shown ? (
                <SlideToConfirm label="Slide to show" icon={Eye} onConfirm={() => send('show-my-cards')} onTimeout={onSlideTimeout} />
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Players({ players, userId, iAmDealer, cardsDealt, busy, act }) {
  const [arranging, setArranging] = useState(false);
  const dragFrom = useRef(null);
  const canArrange = iAmDealer && !cardsDealt;
  const editing = arranging && canArrange;

  const move = (from, to) => {
    if (to < 0 || to >= players.length || from === to) return;
    const ids = players.map((player) => player.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    act('reorder-players', { playerIds: ids });
  };

  if (players.length === 0) {
    return <p className="text-body text-chalk-dim">Nobody is seated yet. Join the game to take the first seat.</p>;
  }

  return (
    <div>
      {!cardsDealt ? (
        <div className="mb-2 flex flex-wrap gap-2">
          <Button className="flex-1 px-3 text-body" disabled={busy} onClick={() => act('choose-dealer')}>
            Random dealer
          </Button>
          {canArrange ? (
            <Button className="flex-1 px-3 text-body" aria-pressed={arranging} onClick={() => setArranging((on) => !on)}>
              {arranging ? 'Done arranging' : 'Arrange seats'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <p className="mb-1 text-caption text-chalk-dim">
          Move seats with the arrows (or drag on a computer). “Out” sits a player out until they have chips again.
        </p>
      ) : null}
      <ol>
        {players.map((player, index) => (
          <li
            key={player.id}
            draggable={editing}
            onDragStart={() => {
              dragFrom.current = index;
            }}
            onDragOver={(event) => {
              if (editing) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragFrom.current !== null) move(dragFrom.current, index);
              dragFrom.current = null;
            }}
            className={cx('flex min-h-12 items-center gap-x-2 border-b border-line py-1 last:border-b-0', editing && 'cursor-grab')}
          >
            <span className="w-5 flex-none text-right font-mono text-body text-chalk-dim tabular">{index + 1}</span>
            <span
              translate="no"
              className={cx(
                'min-w-[3ch] truncate text-lead font-semibold',
                (player.hasFolded || player.isBroke) && 'text-chalk-dim',
                player.hasFolded && 'line-through',
              )}
            >
              {player.name}
            </span>
            {player.id === userId ? <span className="flex-none text-body text-chalk-dim">(you)</span> : null}
            <SeatChips player={player} />
            {player.hasFolded ? <span className="flex-none text-body text-chalk-dim">Folded</span> : null}
            {player.isBroke && !editing ? <span className="flex-none text-body text-chalk-dim">Out of chips</span> : null}

            <span className="ml-auto flex flex-none items-center gap-1">
              {editing ? (
                <>
                  <button
                    type="button"
                    aria-pressed={player.isBroke}
                    aria-label={player.isBroke ? `Mark ${player.name} back in` : `Mark ${player.name} out of chips`}
                    disabled={busy}
                    onClick={() => act('toggle-player-broke', { playerId: player.id })}
                    className="min-h-11 rounded-control border border-line-strong px-3 text-body font-semibold hover:bg-raised disabled:opacity-55"
                  >
                    {player.isBroke ? 'Back in' : 'Out'}
                  </button>
                  <IconButton label={`Move ${player.name} up`} disabled={busy || index === 0} onClick={() => move(index, index - 1)}>
                    <ArrowUp aria-hidden="true" className="size-5" />
                  </IconButton>
                  <IconButton
                    label={`Move ${player.name} down`}
                    disabled={busy || index === players.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-5" />
                  </IconButton>
                </>
              ) : !cardsDealt && !player.isDealer ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Make ${player.name} the dealer`}
                  onClick={() => act('select-dealer', { playerId: player.id })}
                  className="min-h-11 rounded-control border border-line-strong px-3 text-body font-semibold text-chalk hover:bg-raised disabled:opacity-55"
                >
                  Make dealer
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {cardsDealt ? (
        <p className="mt-2 text-caption text-chalk-dim">Seats and the dealer can change once this hand finishes.</p>
      ) : null}
    </div>
  );
}

function ResetDialog({ open, onClose, notify }) {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhrase('');
      setError(null);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!phrase.trim()) {
      setError('Enter the challenge phrase to reset the game.');
      inputRef.current?.focus();
      return;
    }
    if (boot.demo) {
      onClose();
      notify('Sample mode: nothing was reset.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const response = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ challengePhrase: phrase }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        onClose();
        notify('The game was reset. Take a seat again.', 'info', 6000);
        setTimeout(() => window.location.assign('/'), 2000);
      } else {
        setError(response.status === 403 ? 'That’s not the phrase. Check it and try again.' : data.error || 'The reset didn’t go through. Try again.');
        inputRef.current?.focus();
      }
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Reset the game?">
      <form onSubmit={submit} noValidate>
        <p className="text-body text-chalk-dim">
          This clears the table, puts the blinds back to 1&thinsp;/&thinsp;2 and logs everyone out. It can’t be undone.
        </p>
        <label htmlFor="reset-phrase" className="mt-4 block text-lead font-semibold">
          Challenge phrase
        </label>
        <p id="reset-hint" className="text-caption text-chalk-dim">The phrase the crew agreed on, so nobody resets the table by accident.</p>
        <input
          id="reset-phrase"
          ref={inputRef}
          name="challengePhrase"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'reset-error reset-hint' : 'reset-hint'}
          className="mt-2 block min-h-12 w-full rounded-control border border-line-strong bg-felt px-3 text-lead text-chalk"
        />
        {error ? (
          <p id="reset-error" role="alert" className="mt-2 text-body font-semibold text-danger-text">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <Button className="flex-1" onClick={onClose}>
            Keep playing
          </Button>
          <Button type="submit" tone="danger" className="flex-1" busy={working}>
            Reset
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
