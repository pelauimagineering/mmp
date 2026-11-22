import { useCallback, useEffect, useRef, useState } from 'react';
import { createConnection } from './connection.js';
import { createDemoConnection } from './demo.js';

const STREET_NOTICE = {
  flop: 'The flop is out',
  turn: 'The turn is out',
  river: 'The river is out',
  waiting: 'Hand finished',
  complete: 'Hand finished',
};

function describeError(message) {
  const text = message.message || '';
  if (/at least 2 active players/i.test(text)) return 'You need at least 2 players with chips to deal.';
  if (/only the dealer/i.test(text)) return `${text}. The button may have moved: check who is dealing.`;
  if (/while cards are dealt/i.test(text)) return 'The dealer can only change between hands.';
  if (/already revealed/i.test(text)) return 'Your cards are already shown.';
  if (/already folded/i.test(text)) return 'You already folded this hand.';
  return text || 'Something went wrong. Try that again.';
}

/**
 * Live table state for a page.
 *
 * Everything on screen is rendered from the latest server snapshot, never
 * from a local guess, so a missed message can only ever delay the UI: the
 * next snapshot (pushed, or pulled by the resync timer) puts it right.
 *
 * @param {object} options
 * @param {'game'|'community'} options.mode
 * @param {string|null} options.token   session token (game mode)
 * @param {string|null} options.demo    demo scenario name, or null for the real server
 * @param {number|null} options.userId  current player (game mode), used to word notices
 * @param {boolean} options.enabled     connect only once this is true
 */
export function useTable({ mode, token = null, demo = null, userId = null, enabled = true }) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [clockOffset, setClockOffset] = useState(0);
  const [notice, setNotice] = useState(null);
  const connectionRef = useRef(null);
  const versionRef = useRef(0);
  const noticeId = useRef(0);

  const notify = useCallback((text, tone = 'info', duration = 4000) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text, tone, duration });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!enabled) return undefined;

    const stateType = mode === 'game' ? 'game-state' : 'community-state';

    const onMessage = (message) => {
      switch (message.type) {
        case '@open':
          versionRef.current = 0; // new socket: accept whatever the server sends first
          break;
        case stateType: {
          const data = message.data;
          if (!data) break;
          // Ignore a snapshot older than the one on screen (out-of-order delivery).
          if (typeof data.version === 'number') {
            if (data.version < versionRef.current) break;
            versionRef.current = data.version;
          }
          if (typeof data.serverTime === 'number') {
            setClockOffset(data.serverTime - Date.now());
          }
          setState(data);
          break;
        }
        case 'cards-dealt':
          notify('Dealt. Hold your cards to peek.');
          break;
        case 'community-revealed':
          notify(STREET_NOTICE[message.phase] ?? 'The board changed');
          break;
        case 'join-accepted':
          notify('You’re in.');
          break;
        case 'join-rejected':
          notify(
            /already in game/i.test(message.message || '')
              ? 'You’re already seated.'
              : 'A hand is in progress or the table is full. Join when this hand finishes.',
            'error',
            6000,
          );
          break;
        case 'dealer-selected':
          notify(`${message.dealer?.name ?? 'Someone'} has the button`);
          break;
        case 'timer-expired':
          notify('Time. Blinds go up next hand.', 'info', 6000);
          break;
        case 'fold-confirmed':
          notify('You folded');
          break;
        case 'player-folded':
          if (message.playerId !== userId) notify(`${message.playerName} folded`);
          break;
        case 'player-broke-toggled':
          notify(message.isBroke ? `${message.playerName} is out of chips` : `${message.playerName} is back in`);
          break;
        case 'deck-shuffled':
          notify('Shuffled');
          break;
        case 'cards-revealed':
          notify('Your cards are shown to the table');
          break;
        case 'players-reordered':
          notify('Seats updated');
          break;
        case 'game-reset':
          notify('The game was reset. Take a seat again.', 'info', 6000);
          if (mode === 'game') {
            setTimeout(() => window.location.assign('/'), 2000);
          }
          break;
        case 'error':
          if (message.code === 'session-expired' || /invalid or expired session|not authenticated/i.test(message.message || '')) {
            if (mode === 'game') {
              notify('Your seat timed out. Take a seat again.', 'error', 6000);
              setTimeout(() => window.location.assign('/'), 1500);
            }
            break;
          }
          notify(describeError(message), 'error', 6000);
          break;
        default:
      }
    };

    const connection = demo
      ? createDemoConnection({ scenario: demo, mode, onMessage, onStatus: setStatus })
      : createConnection({
          hello: () =>
            mode === 'game'
              ? [{ type: 'auth', token }]
              : [{ type: 'auth-public', view: 'community' }],
          resync: () =>
            mode === 'game' ? [{ type: 'get-state', token }] : [{ type: 'get-community-state' }],
          onMessage,
          onStatus: setStatus,
        });

    connectionRef.current = connection;
    return () => {
      connection.close();
      connectionRef.current = null;
    };
  }, [mode, token, demo, userId, enabled, notify]);

  /** Send an action. Returns false (and says why) when the table is unreachable. */
  const send = useCallback(
    (type, data = {}) => {
      const sent = connectionRef.current?.send({ type, token, ...data }) ?? false;
      if (!sent) {
        notify('Not connected right now. Reconnecting… try again in a moment.', 'error', 5000);
        connectionRef.current?.syncNow();
      }
      return sent;
    },
    [token, notify],
  );

  const syncNow = useCallback(() => connectionRef.current?.syncNow(), []);

  return { state, status, clockOffset, notice, notify, dismissNotice, send, syncNow };
}
