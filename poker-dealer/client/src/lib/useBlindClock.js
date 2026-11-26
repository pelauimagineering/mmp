import { useEffect, useState } from 'react';

/**
 * Remaining time on the blind clock, derived from the server's start time and
 * corrected for the difference between this device's clock and the server's.
 * Recomputed from the wall clock on every tick, so it cannot drift while a
 * phone tab is throttled in the background.
 */
export function useBlindClock(timerState, clockOffset = 0) {
  const [, tick] = useState(0);
  const running = Boolean(timerState?.isRunning && timerState.startTime);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [running]);

  if (!timerState) {
    return { seconds: 420, tone: 'idle', label: 'Starts on the first deal' };
  }

  let seconds = timerState.durationSeconds ?? 420;
  if (timerState.isPaused) {
    seconds = timerState.remainingSeconds ?? seconds;
  } else if (running) {
    const elapsed = (Date.now() + clockOffset - new Date(timerState.startTime).getTime()) / 1000;
    seconds = Math.max(0, Math.min(seconds, seconds - Math.floor(elapsed)));
  }

  if (timerState.blindsWillIncrease) {
    return { seconds: 0, tone: 'expired', label: 'Blinds go up next hand' };
  }
  if (timerState.isPaused) return { seconds, tone: 'paused', label: 'Paused' };
  if (!running) return { seconds, tone: 'idle', label: 'Starts on the first deal' };
  if (seconds <= 30) return { seconds, tone: 'critical', label: 'Under 30 seconds' };
  if (seconds <= 60) return { seconds, tone: 'warn', label: 'Under a minute' };
  return { seconds, tone: 'running', label: 'Until blinds go up' };
}
