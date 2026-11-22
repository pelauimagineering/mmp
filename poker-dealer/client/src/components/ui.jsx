import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, CircleAlert, LoaderCircle, RefreshCw, WifiOff, X } from 'lucide-react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_TONES = {
  primary: 'bg-brass text-brass-ink hover:bg-brass-hover active:bg-brass',
  secondary: 'border border-line-strong text-chalk hover:bg-raised active:bg-table',
  quiet: 'text-chalk underline decoration-line-strong underline-offset-4 hover:decoration-chalk',
  danger: 'bg-danger text-white hover:bg-danger-hover active:bg-danger',
};

export function Button({ tone = 'secondary', busy = false, className, children, disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-lead font-semibold',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_TONES[tone],
        className,
      )}
      {...rest}
    >
      {busy ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 flex-none items-center justify-center rounded-control text-chalk',
        'transition-colors duration-150 hover:bg-raised active:bg-table disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SkipLink({ href, children }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-chalk focus:px-3 focus:py-2 focus:font-semibold focus:text-card-ink"
    >
      {children}
    </a>
  );
}

export function BrandMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true" className={className}>
      <ellipse cx="22" cy="32" rx="14" ry="18" strokeWidth="4" />
      <ellipse cx="42" cy="32" rx="14" ry="18" strokeWidth="4" />
      <path d="M28.4 18.6 Q 32 22 32 32 Q 32 42 28.4 45.4" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className }) {
  return (
    <span translate="no" className={cx('inline-flex flex-none items-center gap-2 font-display font-bold text-chalk', className)}>
      <BrandMark className="size-[1.5em] text-brass" />
      MMP&nbsp;Poker
    </span>
  );
}

const STATUS_COPY = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
};

/** Always-visible connection state. Offers a manual sync whenever it is not live. */
export function ConnectionPill({ status, onSync, className }) {
  const live = status === 'live';
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      <span
        role="status"
        className={cx(
          'inline-flex h-8 items-center gap-2 rounded-full px-3 text-caption font-semibold',
          live ? 'text-chalk' : 'bg-warn text-brass-ink',
        )}
      >
        {live ? (
          <span aria-hidden="true" className="size-2.5 rounded-full bg-chalk" />
        ) : status === 'offline' ? (
          <WifiOff aria-hidden="true" className="size-4" />
        ) : (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        )}
        {STATUS_COPY[status] ?? status}
      </span>
      {!live && onSync ? (
        <IconButton label="Sync now" onClick={onSync}>
          <RefreshCw aria-hidden="true" className="size-5" />
        </IconButton>
      ) : null}
    </span>
  );
}

/** Banner shown under the top bar while the table is unreachable. */
export function ConnectionBanner({ status, onSync, audience = 'player' }) {
  if (status === 'live' || status === 'connecting') return null;
  const tv = audience === 'tv';
  const copy = tv
    ? status === 'offline'
      ? 'Offline. This board may be behind the table.'
      : 'Reconnecting… this board may be behind the table.'
    : status === 'offline'
      ? 'You’re offline. The table will catch up when you’re back.'
      : 'Reconnecting… your cards are safe.';
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-warn px-4 py-2 text-brass-ink">
      <p className={cx('font-semibold', tv ? 'text-[clamp(1.125rem,2.8vh,1.75rem)] leading-tight' : 'text-body')}>{copy}</p>
      <button
        type="button"
        onClick={onSync}
        className="min-h-11 flex-none rounded-control border border-brass-ink px-3 text-body font-semibold hover:bg-brass"
      >
        Sync now
      </button>
    </div>
  );
}

/** One transient message at a time. Errors are announced assertively. */
export function Notice({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(onDismiss, notice.duration);
    return () => clearTimeout(id);
  }, [notice, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+var(--notice-top,4rem))]"
    >
      {notice ? (
        <div
          key={notice.id}
          role={notice.tone === 'error' ? 'alert' : undefined}
          className={cx(
            'pointer-events-auto flex max-w-md animate-notice items-center gap-3 rounded-control py-2 pr-1 pl-4 text-body font-semibold shadow-[0_8px_24px_rgb(0_0_0/0.35)]',
            notice.tone === 'error' ? 'bg-danger text-white' : 'bg-chalk text-card-ink',
          )}
        >
          {notice.tone === 'error' ? <CircleAlert aria-hidden="true" className="size-5 flex-none" /> : null}
          <span className="min-w-0 break-words">{notice.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="inline-flex size-11 flex-none items-center justify-center rounded-control hover:bg-black/10"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function readStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

/**
 * Collapsible section. The header always shows a one-line summary so the
 * answer is usually visible without opening it.
 */
export function Disclosure({ id, title, summary, defaultOpen = false, keepMounted = false, onOpenChange, children }) {
  const storageKey = `mmp-open-${id}`;
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen));
  const [everOpened, setEverOpened] = useState(open);
  const panelId = useId();

  useEffect(() => {
    if (open) setEverOpened(true);
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* storage unavailable: state just isn't remembered */
      }
      return next;
    });
  };

  return (
    <section className="border-t border-line">
      <h2 className="text-heading">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:text-white"
        >
          <span className="flex-none text-heading font-semibold">{title}</span>
          <span className="min-w-0 flex-1 truncate text-right text-body text-chalk-dim">{summary}</span>
          <ChevronDown
            aria-hidden="true"
            className={cx('size-5 flex-none text-chalk-dim transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="pb-4">
        {open || (keepMounted && everOpened) ? children : null}
      </div>
    </section>
  );
}

/** Modal built on the native dialog element (focus trap and Escape for free). */
export function Dialog({ open, onClose, title, children, className }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cx(
        'm-auto w-[min(26rem,calc(100vw-2rem))] overscroll-contain rounded-panel border border-line bg-rail p-0 text-chalk',
        className,
      )}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="min-w-0 font-display text-title font-semibold break-words">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mt-2 -mr-2">
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}

const CHIP_STYLES = {
  dealer: { letter: 'D', name: 'Dealer', className: 'bg-card text-card-ink' },
  small: { letter: 'SB', name: 'Small blind', className: 'bg-chip-blue text-card-ink' },
  big: { letter: 'BB', name: 'Big blind', className: 'bg-brass text-brass-ink' },
};

/** Seat marker drawn as a clay chip: dealer button, small blind, big blind. */
export function SeatChip({ kind, className }) {
  const chip = CHIP_STYLES[kind];
  return (
    <span
      title={chip.name}
      className={cx(
        'inline-flex size-[1.75em] min-h-7 min-w-7 flex-none items-center justify-center rounded-full text-[max(0.875rem,0.8125em)] leading-none font-bold',
        chip.className,
        className,
      )}
    >
      <span aria-hidden="true">{chip.letter}</span>
      <span className="sr-only">{chip.name}</span>
    </span>
  );
}

export function SeatChips({ player }) {
  return (
    <>
      {player.isDealer ? <SeatChip kind="dealer" /> : null}
      {player.isSmallBlind ? <SeatChip kind="small" /> : null}
      {player.isBigBlind ? <SeatChip kind="big" /> : null}
    </>
  );
}
