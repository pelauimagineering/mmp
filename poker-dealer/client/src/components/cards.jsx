import { useEffect, useRef } from 'react';
import { STREETS, cardName } from '../lib/cards.js';
import { cx } from './ui.jsx';

const SUIT_PATHS = {
  hearts: (
    <path d="M12 21s-7.5-4.9-9.6-9.4C.9 8.3 2.6 4.5 6.3 4.5c2.2 0 3.9 1.2 5.7 3.3 1.8-2.1 3.5-3.3 5.7-3.3 3.7 0 5.4 3.8 3.9 7.1C19.500 16.100 12 21 12 21z" />
  ),
  diamonds: <path d="M12 2.5 19.5 12 12 21.5 4.5 12z" />,
  spades: (
    <path d="M12 2.5c2.6 3.6 8.5 6.900 8.5 11.300 0 2.500-1.900 4.200-4.200 4.200-1.300 0-2.500-.6-3.300-1.600.2 1.900.9 3.600 2.200 5.100H8.800c1.300-1.500 2-3.200 2.200-5.100-.8 1-2 1.600-3.300 1.600-2.300 0-4.200-1.700-4.200-4.200C3.500 9.400 9.400 6.100 12 2.500z" />
  ),
  clubs: (
    <>
      <circle cx="12" cy="7.2" r="4.2" />
      <circle cx="7" cy="13.6" r="4.2" />
      <circle cx="17" cy="13.6" r="4.2" />
      <path d="M10.900 12h2.200c.1 3.600.8 6.600 2.200 9.500H8.700c1.400-2.900 2.100-5.900 2.200-9.500z" />
    </>
  ),
};

export function SuitIcon({ suit, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {SUIT_PATHS[suit]}
    </svg>
  );
}

/**
 * A playing card. Width comes from the --card-w custom property set by a
 * parent, so the same component serves the phone, the desktop and the TV.
 */
export function PlayingCard({ card, faceUp = card?.visible, animate = false, className }) {
  if (!card) {
    return <div aria-hidden="true" className={cx('playing-card playing-card--slot', className)} />;
  }
  if (!faceUp) {
    return <div role="img" aria-label="Face-down card" className={cx('playing-card playing-card--back', className)} />;
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div
      role="img"
      aria-label={cardName(card)}
      className={cx('playing-card playing-card--face', red && 'playing-card--red', animate && 'animate-turn', className)}
    >
      <span aria-hidden="true" className="playing-card__rank">
        {card.rank}
      </span>
      <SuitIcon suit={card.suit} className="playing-card__suit" />
    </div>
  );
}

/** The five community cards. Always five slots, so the board never changes size. */
export function Board({ cards = [], className }) {
  // Animate a card only when it turns over while we are watching, not on first paint.
  const seen = useRef(null);
  const previous = seen.current;
  useEffect(() => {
    seen.current = cards.map((card) => Boolean(card?.visible));
  });

  const slots = Array.from({ length: 5 }, (_, index) => cards[index] ?? null);
  const shown = cards.filter((card) => card?.visible).map(cardName);

  return (
    <div
      role="group"
      aria-label={
        cards.length === 0
          ? 'Board: no cards dealt'
          : shown.length === 0
            ? 'Board: five cards face down'
            : `Board: ${shown.join(', ')}`
      }
      className={cx('flex justify-center gap-[calc(var(--card-w)*0.12)]', className)}
    >
      {slots.map((card, index) => (
        <PlayingCard
          key={index}
          card={card}
          animate={Boolean(card?.visible && previous && previous[index] === false)}
        />
      ))}
    </div>
  );
}

/** Pre-flop → flop → turn → river. A real sequence, so it is shown as steps. */
export function StreetTrack({ phase, className, size = 'body' }) {
  const currentIndex = STREETS.findIndex((street) => street.phase === phase);
  return (
    <ol aria-label="Street" className={cx('flex items-center gap-1', className)}>
      {STREETS.map((street, index) => {
        const current = index === currentIndex;
        const done = currentIndex > index;
        return (
          <li
            key={street.phase}
            aria-current={current ? 'step' : undefined}
            className={cx(
              'flex-1 border-t-[3px] pt-1.5 text-center font-semibold whitespace-nowrap',
              size === 'body' ? 'text-caption' : '',
              current ? 'border-brass text-brass' : done ? 'border-chalk-dim text-chalk' : 'border-line text-chalk-dim',
            )}
          >
            {street.label}
          </li>
        );
      })}
    </ol>
  );
}
