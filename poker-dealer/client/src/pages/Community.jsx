import { useState } from 'react';
import { Video, VideoOff } from 'lucide-react';
import { boot } from '../lib/boot.js';
import { useBlindClock } from '../lib/useBlindClock.js';
import { useTable } from '../lib/useTable.js';
import { BlindsValue, CLOCK_TONE_TEXT, ClockDigits } from '../components/BlindClock.jsx';
import { Board, PlayingCard, StreetTrack } from '../components/cards.jsx';
import { VideoRoom } from '../components/VideoRoom.jsx';
import { Brand, ConnectionBanner, ConnectionPill, Notice, SeatChips, cx } from '../components/ui.jsx';

const MAX_SMALL_BLIND = 64;

export default function Community() {
  const table = useTable({ mode: 'community', demo: boot.demo ?? null });
  const { state, status } = table;
  const clock = useBlindClock(state?.timerState, table.clockOffset);
  const [videoOn, setVideoOn] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  const players = state?.players ?? [];
  const revealedHands = state?.revealedHands ?? [];
  const dealer = players.find((player) => player.isDealer);
  const cardsDealt = Boolean(state?.cardsDealt);

  const boardCaption = !state
    ? 'Finding the table…'
    : cardsDealt
      ? null
      : players.length === 0
        ? 'Waiting for players to take a seat'
        : dealer
          ? `${dealer.name} deals the next hand`
          : 'Waiting for a dealer';

  const toggleVideo = () => {
    setVideoOn((on) => !on);
    setVideoStarted(true);
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-rail px-safe pt-safe lg:flex-nowrap">
        <h1 className="py-2 lg:py-3">
          <Brand className="lg:text-title" />
          <span className="sr-only"> community board</span>
        </h1>
        <StreetTrack
          phase={state?.phase}
          size="tv"
          className="order-last basis-full pb-2 text-caption lg:order-none lg:max-w-2xl lg:basis-auto lg:flex-1 lg:pb-0 lg:text-[clamp(1rem,2vh,1.375rem)]"
        />
        <div className="ml-auto flex items-center gap-2">
          <ConnectionPill status={status} />
          <button
            type="button"
            aria-pressed={videoOn}
            onClick={toggleVideo}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong px-3 text-body font-semibold hover:bg-raised"
          >
            {videoOn ? <VideoOff aria-hidden="true" className="size-5" /> : <Video aria-hidden="true" className="size-5" />}
            {videoOn ? 'Hide video' : 'Show video'}
          </button>
        </div>
      </header>
      <ConnectionBanner status={status} onSync={table.syncNow} />

      <main
        className={cx(
          'grid min-h-0 flex-1 gap-3 p-3 lg:gap-4 lg:p-4',
          videoOn
            ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_clamp(260px,24vw,420px)]',
        )}
      >
        {videoStarted ? (
          <VideoRoom
            jwtToken={boot.jwtToken}
            demo={Boolean(boot.demo)}
            className={cx('min-h-[56vw] lg:h-full lg:min-h-0', !videoOn && 'hidden')}
          />
        ) : null}

        <div className={cx('grid min-h-0 gap-3 lg:gap-4', videoOn ? 'lg:grid-rows-[auto_minmax(0,1fr)_auto]' : 'lg:grid-rows-[minmax(0,1fr)_auto]')}>
          {videoOn ? <ClockPanel state={state} clock={clock} compact /> : null}

          <section
            aria-label="The board"
            className="flex min-h-0 flex-col items-center justify-center rounded-panel bg-table p-3 [container-type:size] max-lg:aspect-[2/1]"
          >
            <Board cards={state?.communityCards ?? []} className="[--card-w:min(16.5cqw,58cqh)]" />
            {boardCaption ? (
              <p className="mt-[3cqh] text-center text-[clamp(1rem,5cqh,2rem)] leading-tight font-semibold text-chalk">{boardCaption}</p>
            ) : null}
          </section>

          <section
            aria-labelledby="shown-title"
            className={cx(
              'rounded-panel border border-line px-4 py-3',
              videoOn ? '[--card-w:clamp(36px,3.2vw,56px)]' : '[--card-w:clamp(40px,4.6vw,76px)]',
            )}
          >
            <h2 id="shown-title" className="text-[clamp(1rem,2.2vh,1.375rem)] font-semibold">
              Shown hands
            </h2>
            {/* Height is reserved for one row of cards so the board doesn't jump at showdown. */}
            <div className="mt-2 flex min-h-[calc(var(--card-w)*1.4)] items-center">
              {revealedHands.length === 0 ? (
                <p className="text-[clamp(1rem,2.2vh,1.375rem)] text-chalk-dim">
                  {cardsDealt ? 'Nobody has shown yet.' : 'Hands players show will appear here.'}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-x-[2.5vw] gap-y-2">
                  {revealedHands.map((hand) => (
                    <li key={hand.userId} className="flex items-center gap-3">
                      <span translate="no" className="max-w-[10ch] truncate text-[clamp(1.125rem,2.6vh,1.75rem)] font-semibold">
                        {hand.playerName}
                      </span>
                      <span className="flex gap-1.5">
                        {hand.cards.map((card, index) => (
                          <PlayingCard key={index} card={card} faceUp />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {!videoOn ? (
          <aside className="flex min-h-0 flex-col gap-3 lg:gap-4">
            <ClockPanel state={state} clock={clock} />
            <Seats players={players} cardsDealt={cardsDealt} />
          </aside>
        ) : null}
      </main>

      <Notice notice={table.notice} onDismiss={table.dismissNotice} />
    </div>
  );
}

function ClockPanel({ state, clock, compact = false }) {
  const blinds = state?.blinds ?? { small: 1, big: 2 };
  const next = blinds.small < MAX_SMALL_BLIND ? { small: blinds.small * 2, big: blinds.big * 2 } : null;
  const labelTone = clock.tone === 'running' || clock.tone === 'idle' ? 'text-chalk-dim' : CLOCK_TONE_TEXT[clock.tone];

  return (
    <section
      aria-label="Blinds and clock"
      className={cx(
        'flex-none rounded-panel border border-line px-4 py-3',
        compact ? 'flex flex-wrap items-end justify-between gap-x-8 gap-y-2' : 'flex flex-col gap-[2vh]',
      )}
    >
      <p className="flex flex-col">
        <span className="text-[clamp(1rem,2.2vh,1.375rem)] text-chalk-dim">Blinds</span>
        <BlindsValue
          blinds={blinds}
          className={compact ? 'text-[clamp(1.75rem,5vh,3rem)]' : 'text-[clamp(2.25rem,7.5vh,5rem)]'}
        />
        <span className="mt-1 text-[clamp(1rem,2.2vh,1.375rem)] text-chalk-dim">
          {next ? (
            <>
              Next level{' '}
              <BlindsValue blinds={next} className="font-semibold text-chalk" />
            </>
          ) : (
            'Top level'
          )}
        </span>
      </p>
      <p className={cx('flex flex-col', compact && 'items-end text-right')}>
        <span className={cx('text-[clamp(1rem,2.2vh,1.375rem)] font-semibold', labelTone)}>{clock.label}</span>
        <ClockDigits clock={clock} className={compact ? 'text-[clamp(2rem,6vh,3.5rem)]' : 'text-[clamp(3rem,11vh,7.5rem)]'} />
      </p>
    </section>
  );
}

function Seats({ players, cardsDealt }) {
  const inHand = players.filter((player) => !player.hasFolded && !player.isBroke).length;
  return (
    <section aria-labelledby="seats-title" className="flex min-h-0 flex-1 flex-col rounded-panel border border-line px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="seats-title" className="text-[clamp(1rem,2.2vh,1.375rem)] font-semibold">
          Seats
        </h2>
        {players.length > 0 ? (
          <p className="text-[clamp(1rem,2vh,1.25rem)] text-chalk-dim">
            {cardsDealt ? `${inHand} of ${players.length} still in` : `${players.length} seated`}
          </p>
        ) : null}
      </div>
      {players.length === 0 ? (
        <p className="mt-2 text-[clamp(1rem,2.2vh,1.375rem)] text-chalk-dim">Nobody is seated yet.</p>
      ) : (
        <ol className="mt-1 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          {players.map((player) => {
            const out = player.hasFolded || player.isBroke;
            return (
              <li
                key={player.id}
                className="flex min-h-[2.1em] items-center gap-2 border-b border-line text-[clamp(1.125rem,2.5vh,1.625rem)] last:border-b-0"
              >
                <span translate="no" className={cx('min-w-0 truncate font-semibold', out && 'text-chalk-dim', player.hasFolded && 'line-through')}>
                  {player.name}
                </span>
                <SeatChips player={player} />
                {player.hasFolded ? <span className="ml-auto flex-none text-[0.8em] text-chalk-dim">Folded</span> : null}
                {player.isBroke ? <span className="ml-auto flex-none text-[0.8em] text-chalk-dim">Out of chips</span> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
