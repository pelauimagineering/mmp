import { useEffect, useRef, useState } from 'react';
import { Tv } from 'lucide-react';
import { boot } from '../lib/boot.js';
import { DEMO_SEATED, DEMO_USERS } from '../lib/demo.js';
import { PlayingCard } from '../components/cards.jsx';
import { Brand, Button, SkipLink, cx } from '../components/ui.jsx';

function useCrew() {
  const [crew, setCrew] = useState({ phase: 'loading', users: [], seated: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (boot.demo) {
      setCrew({ phase: 'ready', users: DEMO_USERS, seated: DEMO_SEATED });
      return undefined;
    }
    let cancelled = false;
    setCrew((current) => ({ ...current, phase: 'loading' }));
    fetch('/api/auth/users', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bad status'))))
      .then((data) => {
        if (!cancelled) setCrew({ phase: 'ready', users: data.users ?? [], seated: data.loggedInUsers ?? [] });
      })
      .catch(() => {
        if (!cancelled) setCrew({ phase: 'failed', users: [], seated: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...crew, retry: () => setAttempt((n) => n + 1) };
}

export default function Login() {
  const crew = useCrew();
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const gridRef = useRef(null);

  const chosen = crew.users.find((user) => user.id === userId) ?? null;
  const alreadySeated = chosen !== null && crew.seated.includes(chosen.id);

  const nameField = useRef(null);
  const choose = (user) => {
    setFormError(null);
    setUserId(user.id);
    setDisplayName(user.display_name);
  };
  // Bring the name field above the docked button once a name is picked.
  useEffect(() => {
    if (userId === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nameField.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [userId]);

  const onSubmit = (event) => {
    // The button stays enabled; a missing choice is explained next to the field.
    if (!chosen) {
      event.preventDefault();
      setFormError('Pick your name to sit down.');
      gridRef.current?.querySelector('input')?.focus();
      return;
    }
    if (!displayName.trim()) {
      event.preventDefault();
      setFormError('Add the name you want shown at the table.');
      document.getElementById('displayName')?.focus();
      return;
    }
    if (boot.demo) {
      event.preventDefault();
      window.location.assign('/game?demo=lobby');
      return;
    }
    // A normal form post: the server sets the session cookie and redirects to /game.
    setSubmitting(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-safe pt-safe">
      <SkipLink href="#seat-form">Skip to the names</SkipLink>
      <header className="flex items-center justify-between py-3">
        <a href="https://mmp.pelau.com/" className="inline-flex min-h-11 items-center rounded-control text-heading">
          <Brand />
        </a>
        <a
          href="https://mmp.pelau.com/golf/"
          className="inline-flex min-h-11 items-center rounded-control text-body font-semibold text-chalk underline decoration-line-strong underline-offset-4 hover:decoration-chalk"
        >
          Switch to golf
        </a>
      </header>

      <main className="flex-1 pt-4 pb-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display font-bold">Who’s sitting down?</h1>
            <p className="mt-2 text-body text-chalk-dim">Your phone holds your cards. The chips stay on the table.</p>
          </div>
          <div aria-hidden="true" className="flex flex-none pr-1 [--card-w:44px]">
            <PlayingCard card={{ rank: 'A', suit: 'spades' }} faceUp className="-rotate-6" />
            <PlayingCard card={{ rank: 'K', suit: 'hearts' }} faceUp className="-ml-4 translate-y-1 rotate-6" />
          </div>
        </div>

        <form id="seat-form" method="post" action="/api/auth/login" onSubmit={onSubmit} noValidate className="mt-6">
          <fieldset>
            <legend className="text-lead font-semibold">Pick your name</legend>

            {crew.phase === 'loading' ? (
              <div aria-busy="true" className="mt-3 grid grid-cols-2 gap-2">
                <p className="sr-only">Loading the crew…</p>
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className="h-12 rounded-control bg-table" />
                ))}
              </div>
            ) : null}

            {crew.phase === 'failed' ? (
              <div role="alert" className="mt-3 rounded-control border border-danger-text p-4">
                <p className="text-body">The crew list didn’t load. Check your connection, then try again.</p>
                <Button className="mt-3" onClick={crew.retry}>
                  Try again
                </Button>
              </div>
            ) : null}

            {crew.phase === 'ready' && crew.users.length === 0 ? (
              <p className="mt-3 text-body text-chalk-dim">
                No players are set up yet. Run <code className="font-mono">npm run db:init</code> on the server.
              </p>
            ) : null}

            {crew.phase === 'ready' && crew.users.length > 0 ? (
              <div ref={gridRef} className="mt-3 grid grid-cols-2 gap-2">
                {crew.users.map((user) => {
                  const seated = crew.seated.includes(user.id);
                  const selected = user.id === userId;
                  return (
                    <label
                      key={user.id}
                      className={cx(
                        'flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-control border px-3 text-lead font-semibold',
                        'transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brass',
                        selected
                          ? 'border-brass bg-brass text-brass-ink'
                          : 'border-line-strong text-chalk hover:bg-raised',
                      )}
                    >
                      <input
                        type="radio"
                        name="userId"
                        value={user.id}
                        required
                        checked={selected}
                        onChange={() => choose(user)}
                        className="sr-only"
                      />
                      <span translate="no" className="min-w-0 truncate">
                        {user.display_name}
                      </span>
                      {seated ? (
                        <span className={cx('flex-none text-caption font-semibold', selected ? 'text-brass-ink' : 'text-chalk-dim')}>
                          At the table
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
            {formError ? (
              <p role="alert" className="mt-3 text-body font-semibold text-danger-text">
                {formError}
              </p>
            ) : null}
          </fieldset>

          {chosen ? (
            <div ref={nameField} className="mt-5">
              <label htmlFor="displayName" className="block text-lead font-semibold">
                Name at the table
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                maxLength={50}
                autoComplete="nickname"
                spellCheck={false}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 block min-h-12 w-full rounded-control border border-line-strong bg-rail px-3 text-lead text-chalk placeholder:text-chalk-dim"
                placeholder="e.g. Big Slick…"
              />
              <p className="mt-2 text-caption text-chalk-dim">This is how the others see you. Change it if you like.</p>
            </div>
          ) : null}

        </form>

        <div className="mt-8 border-t border-line pt-5">
          <a
            href={boot.demo ? '/community?demo=flop' : '/community'}
            className="inline-flex min-h-11 items-center gap-2 rounded-control text-lead font-semibold text-chalk underline decoration-line-strong underline-offset-4 hover:decoration-chalk"
          >
            <Tv aria-hidden="true" className="size-5" />
            Put the board on the TV
          </a>
          <p className="text-caption text-chalk-dim">Opens the shared board: community cards, blinds and the clock. No sign-in.</p>
        </div>
      </main>

      <footer className="pb-2 text-center">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-control px-3 text-caption text-chalk-dim hover:text-chalk"
        >
          Made with 💕 in the 6ix
        </button>
      </footer>

      {/* The next step is always the one brass button, docked in the thumb zone. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-rail px-4 pt-3 pb-safe">
        {alreadySeated ? (
          <p role="status" className="mb-3 rounded-control bg-warn px-3 py-2 text-body font-semibold text-brass-ink">
            {chosen.display_name} is already at the table on another device. Sitting down here opens a second screen for the
            same seat.
          </p>
        ) : null}
        <Button type="submit" form="seat-form" tone="primary" busy={submitting} className="w-full">
          <span className="truncate">
            {submitting ? 'Taking your seat…' : chosen ? `Take a seat as ${displayName.trim() || chosen.display_name}` : 'Take a seat'}
          </span>
        </Button>
      </div>
    </div>
  );
}
