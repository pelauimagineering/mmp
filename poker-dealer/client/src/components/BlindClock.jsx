import { formatClock } from '../lib/cards.js';
import { cx } from './ui.jsx';

export const CLOCK_TONE_TEXT = {
  idle: 'text-chalk-dim',
  running: 'text-chalk',
  warn: 'text-warn',
  critical: 'text-danger-text',
  paused: 'text-chalk-dim',
  expired: 'text-brass',
};

/** The digits of the blind clock. Fixed-width so the countdown does not jitter. */
export function ClockDigits({ clock, className }) {
  return (
    <span
      role="timer"
      aria-label={`${formatClock(clock.seconds)} on the blind clock. ${clock.label}.`}
      className={cx('font-mono font-bold tabular leading-none', CLOCK_TONE_TEXT[clock.tone], className)}
    >
      {clock.tone === 'expired' ? '0:00' : formatClock(clock.seconds)}
    </span>
  );
}

export function BlindsValue({ blinds, className }) {
  const small = blinds?.small ?? 1;
  const big = blinds?.big ?? 2;
  return (
    <span className={cx('font-mono font-bold tabular leading-none', className)}>
      <span className="sr-only">
        Small blind {small}, big blind {big}
      </span>
      <span aria-hidden="true">
        {small}
        <span className="mx-[0.12em] font-sans font-normal text-chalk-dim">/</span>
        {big}
      </span>
    </span>
  );
}
