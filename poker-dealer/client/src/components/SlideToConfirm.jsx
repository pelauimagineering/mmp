import { useEffect, useRef, useState } from 'react';
import { ChevronsRight, LoaderCircle } from 'lucide-react';
import { cx } from './ui.jsx';

const KNOB = 44;
const PAD = 4;
const THRESHOLD = 0.95;

const TONES = {
  brass: { knob: 'bg-brass text-brass-ink', fill: 'bg-brass/25', border: 'border-brass' },
  danger: { knob: 'bg-danger text-white', fill: 'bg-danger/40', border: 'border-danger-text' },
};

/**
 * Drag the knob to the end to confirm. Used for the two actions a player
 * cannot take back: showing cards and folding.
 *
 * Keyboard: focus the knob, then Arrow Right (four steps) or End.
 */
export function SlideToConfirm({ label, tone = 'brass', onConfirm }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const style = TONES[tone];

  // If the server never answers, let the player try again.
  useEffect(() => {
    if (!sending) return undefined;
    const id = setTimeout(() => {
      setSending(false);
      setProgress(0);
    }, 3000);
    return () => clearTimeout(id);
  }, [sending]);

  const confirm = () => {
    setProgress(1);
    const accepted = onConfirm();
    if (accepted === false) {
      setProgress(0);
    } else {
      setSending(true);
    }
  };

  const travel = () => Math.max(1, trackRef.current.clientWidth - KNOB - PAD * 2);

  const onPointerDown = (event) => {
    if (sending) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, travel: travel(), start: progress };
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    const next = drag.current.start + (event.clientX - drag.current.startX) / drag.current.travel;
    setProgress(Math.min(1, Math.max(0, next)));
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setProgress((current) => {
      if (current >= THRESHOLD) {
        queueMicrotask(confirm);
        return 1;
      }
      return 0;
    });
  };

  const onKeyDown = (event) => {
    if (sending) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(1, progress + 0.25);
      if (next >= 1) confirm();
      else setProgress(next);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setProgress(Math.max(0, progress - 0.25));
    } else if (event.key === 'End') {
      event.preventDefault();
      confirm();
    } else if (event.key === 'Home' || event.key === 'Escape') {
      setProgress(0);
    }
  };

  const dragging = drag.current !== null;

  return (
    <div
      ref={trackRef}
      className={cx('relative h-[52px] overflow-hidden rounded-full border bg-rail select-none', style.border)}
    >
      <div
        aria-hidden="true"
        className={cx('absolute inset-y-0 left-0 rounded-full', style.fill, !dragging && 'transition-[width] duration-200')}
        style={{ width: `calc(${KNOB + PAD * 2}px + (100% - ${KNOB + PAD * 2}px) * ${progress})` }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pl-10 text-lead font-semibold text-chalk"
        style={{ opacity: Math.max(0.25, 1 - progress * 1.2) }}
      >
        {sending ? 'Sending…' : label}
      </span>
      <button
        type="button"
        role="slider"
        aria-label={`${label}. Drag to the end, or press the right arrow key four times.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={sending ? 'Sending' : `${Math.round(progress * 100)} percent`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cx(
          'absolute top-[3px] flex size-11 touch-none items-center justify-center rounded-full',
          style.knob,
          !dragging && 'transition-[left] duration-200',
        )}
        style={{ left: `calc(${PAD}px + (100% - ${KNOB + PAD * 2}px) * ${progress})` }}
      >
        {sending ? (
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <ChevronsRight aria-hidden="true" className="size-6" />
        )}
      </button>
    </div>
  );
}
