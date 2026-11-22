// Sample-data mode (?demo=<scenario>). A small in-browser table that speaks
// the same messages as the real server, so every screen can be explored and
// screenshotted fully populated without a database or other players.

const CREW = [
  { id: 1, name: 'Gary' },
  { id: 2, name: 'Neave' },
  { id: 3, name: 'Harish' },
  { id: 5, name: 'Tony' },
  { id: 7, name: 'Kerwin' },
  { id: 8, name: 'Wayne' },
  { id: 9, name: 'Dee' },
  { id: 10, name: 'Lorenzo' },
];

export const DEMO_USER = { id: 9, display_name: 'Dee', user_name: 'dee' };

export const DEMO_USERS = [
  { id: 4, display_name: 'Chris', user_name: 'chris' },
  { id: 9, display_name: 'Dee', user_name: 'dee' },
  { id: 1, display_name: 'Gary', user_name: 'gary' },
  { id: 3, display_name: 'Harish', user_name: 'harish' },
  { id: 11, display_name: 'JB', user_name: 'jb' },
  { id: 7, display_name: 'Kerwin', user_name: 'kerwin' },
  { id: 10, display_name: 'Lorenzo', user_name: 'lorenzo' },
  { id: 2, display_name: 'Neave', user_name: 'neave' },
  { id: 6, display_name: 'Seymour', user_name: 'seymour' },
  { id: 5, display_name: 'Tony', user_name: 'tony' },
  { id: 8, display_name: 'Wayne', user_name: 'wayne' },
];
export const DEMO_SEATED = [1, 2, 3, 5, 7];

export const DEMO_SCENARIOS = [
  ['lobby', 'Not joined yet'],
  ['waiting', 'Between hands'],
  ['preflop', 'Pre-flop'],
  ['flop', 'Flop'],
  ['turn', 'Turn'],
  ['river', 'River'],
  ['showdown', 'Showdown'],
  ['dealer', 'You deal'],
  ['blindsup', 'Blinds going up'],
];

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const card = (code) => {
  const suit = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }[code.slice(-1)];
  return { rank: code.slice(0, -1), suit };
};

const BOARD = ['As', 'Kh', '7d', '7c', '2s'].map(card);
const HANDS = {
  9: ['Qs', 'Qd'], 1: ['Ac', 'Jc'], 2: ['9h', '8h'], 3: ['4d', '4s'],
  5: ['Kd', '10d'], 7: ['Ah', '5h'], 8: ['Jd', '9s'], 10: ['6c', '6h'],
};

const PHASE_VISIBLE = { 'pre-flop': 0, flop: 3, turn: 4, river: 5 };
const DURATION = 420;

function buildScenario(name) {
  const t = {
    players: CREW.map((p) => ({ ...p })),
    dealerIndex: 4, // Kerwin
    phase: 'waiting',
    cardsDealt: false,
    board: [],
    hands: new Map(),
    revealed: new Set(),
    folded: new Set(),
    broke: new Set(),
    blinds: { small: 2, big: 4 },
    timer: { startedAt: Date.now() - (DURATION - 342) * 1000, pausedRemaining: null, blindsWillIncrease: false },
  };

  const dealFixed = (phase) => {
    t.phase = phase;
    t.cardsDealt = true;
    t.board = BOARD.map((c) => ({ ...c }));
    t.players.forEach((p) => {
      if (!t.broke.has(p.id)) t.hands.set(p.id, HANDS[p.id].map(card));
    });
  };

  switch (name) {
    case 'lobby':
      t.players = CREW.filter((p) => DEMO_SEATED.includes(p.id));
      t.dealerIndex = -1;
      t.timer.startedAt = null;
      t.blinds = { small: 1, big: 2 };
      break;
    case 'waiting':
      t.dealerIndex = 6; // Dee
      break;
    case 'preflop':
      dealFixed('pre-flop');
      break;
    case 'turn':
      dealFixed('turn');
      t.folded = new Set([2, 3]);
      break;
    case 'river':
      dealFixed('river');
      t.folded = new Set([2, 3, 10]);
      break;
    case 'showdown':
      t.broke = new Set([8]);
      dealFixed('river');
      t.folded = new Set([2, 3]);
      t.revealed = new Set([9, 5, 1]);
      t.blinds = { small: 4, big: 8 };
      t.timer.startedAt = Date.now() - (DURATION - 48) * 1000;
      break;
    case 'dealer':
      t.dealerIndex = 6;
      dealFixed('flop');
      t.folded = new Set([5]);
      break;
    case 'blindsup':
      t.dealerIndex = 6;
      t.timer = { startedAt: null, pausedRemaining: null, blindsWillIncrease: true };
      break;
    case 'flop':
    default:
      dealFixed('flop');
      t.folded = new Set([5]);
  }
  return t;
}

function shuffledDeck() {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createDemoConnection({ scenario, mode, onMessage, onStatus }) {
  const t = buildScenario(scenario);
  const me = DEMO_USER.id;
  let version = 1;
  let disposed = false;

  const active = () => t.players.filter((p) => !t.broke.has(p.id));
  const nextActive = (from) => {
    for (let step = 1; step <= t.players.length; step += 1) {
      const index = (from + step) % t.players.length;
      if (!t.broke.has(t.players[index].id)) return index;
    }
    return -1;
  };

  const timerState = () => {
    const base = { durationSeconds: DURATION, blindsWillIncrease: t.timer.blindsWillIncrease, expired: false };
    if (t.timer.pausedRemaining != null) {
      return { ...base, isRunning: false, isPaused: true, startTime: null, remainingSeconds: t.timer.pausedRemaining };
    }
    if (!t.timer.startedAt) {
      return { ...base, isRunning: false, isPaused: false, startTime: null, remainingSeconds: DURATION };
    }
    const remaining = Math.max(0, DURATION - Math.floor((Date.now() - t.timer.startedAt) / 1000));
    return { ...base, isRunning: true, isPaused: false, startTime: new Date(t.timer.startedAt).toISOString(), remainingSeconds: remaining };
  };

  const snapshot = () => {
    const sb = t.dealerIndex === -1 || active().length < 2 ? -1 : active().length === 2 ? t.dealerIndex : nextActive(t.dealerIndex);
    const bb = sb === -1 ? -1 : nextActive(sb);
    const visible = PHASE_VISIBLE[t.phase] ?? 0;
    const state = {
      players: t.players.map((p, index) => ({
        id: p.id,
        name: p.name,
        isDealer: index === t.dealerIndex,
        isSmallBlind: index === sb,
        isBigBlind: index === bb,
        hasFolded: t.folded.has(p.id),
        isBroke: t.broke.has(p.id),
      })),
      communityCards: t.board.map((c, index) => ({ ...c, visible: index < visible })),
      phase: t.phase,
      cardsDealt: t.cardsDealt,
      revealedHands: [...t.revealed]
        .filter((id) => t.hands.has(id))
        .map((id) => ({
          userId: id,
          playerName: t.players.find((p) => p.id === id)?.name ?? '',
          cards: t.hands.get(id).map((c) => ({ ...c, visible: true })),
        })),
      timerState: timerState(),
      blinds: { ...t.blinds },
      version,
      serverTime: Date.now(),
    };
    if (mode === 'game') {
      state.holeCards = (t.hands.get(me) ?? []).map((c) => ({ ...c, visible: false }));
    }
    return state;
  };

  const emit = (message) => {
    if (!disposed) setTimeout(() => !disposed && onMessage(message), 60);
  };
  const push = () => {
    version += 1;
    emit({ type: mode === 'game' ? 'game-state' : 'community-state', data: snapshot() });
  };
  const fail = (message) => emit({ type: 'error', message });
  const isDealer = () => t.dealerIndex !== -1 && t.players[t.dealerIndex]?.id === me;

  const handlers = {
    'get-state': () => emit({ type: 'game-state', data: snapshot() }),
    'get-community-state': () => emit({ type: 'community-state', data: snapshot() }),
    'join-game': () => {
      if (t.cardsDealt) return emit({ type: 'join-rejected', message: 'Cannot join game - cards already dealt or game is full' });
      t.players.push({ id: me, name: DEMO_USER.display_name });
      push();
      emit({ type: 'join-accepted' });
    },
    'choose-dealer': () => {
      t.dealerIndex = Math.floor(Math.random() * t.players.length);
      push();
      emit({ type: 'dealer-selected', dealer: t.players[t.dealerIndex] });
    },
    'select-dealer': ({ playerId }) => {
      t.dealerIndex = t.players.findIndex((p) => p.id === Number(playerId));
      push();
      emit({ type: 'dealer-selected', dealer: t.players[t.dealerIndex] });
    },
    'reorder-players': ({ playerIds }) => {
      const dealerId = t.players[t.dealerIndex]?.id;
      t.players = playerIds.map((id) => t.players.find((p) => p.id === Number(id)));
      t.dealerIndex = t.players.findIndex((p) => p.id === dealerId);
      push();
    },
    'toggle-player-broke': ({ playerId }) => {
      const id = Number(playerId);
      const nowBroke = !t.broke.has(id);
      if (nowBroke) t.broke.add(id); else t.broke.delete(id);
      push();
      const name = t.players.find((p) => p.id === id)?.name;
      emit({ type: 'player-broke-toggled', playerName: name, isBroke: nowBroke });
    },
    'shuffle-deck': () => emit({ type: 'deck-shuffled' }),
    'deal-cards': () => {
      if (!isDealer()) return fail('Only the dealer can deal cards');
      if (active().length < 2) return fail('Need at least 2 active players to deal');
      const deck = shuffledDeck();
      t.hands = new Map(active().map((p) => [p.id, [deck.pop(), deck.pop()]]));
      t.board = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
      t.phase = 'pre-flop';
      t.cardsDealt = true;
      if (t.timer.blindsWillIncrease) {
        t.blinds = { small: t.blinds.small * 2, big: t.blinds.big * 2 };
        t.timer = { startedAt: Date.now(), pausedRemaining: null, blindsWillIncrease: false };
      } else if (t.timer.pausedRemaining != null) {
        t.timer = { ...t.timer, startedAt: Date.now() - (DURATION - t.timer.pausedRemaining) * 1000, pausedRemaining: null };
      } else if (!t.timer.startedAt) {
        t.timer.startedAt = Date.now();
      }
      push();
      emit({ type: 'cards-dealt' });
    },
    'flip-community-card': () => {
      if (!isDealer()) return fail('Only the dealer can flip community cards');
      const next = { 'pre-flop': 'flop', flop: 'turn', turn: 'river' }[t.phase];
      if (next) {
        t.phase = next;
      } else if (t.phase === 'river') {
        t.phase = 'waiting';
        t.cardsDealt = false;
        t.board = [];
        t.hands.clear();
        t.revealed.clear();
        t.folded.clear();
        t.dealerIndex = nextActive(t.dealerIndex);
      }
      push();
      emit({ type: 'community-revealed', phase: t.phase });
    },
    'show-my-cards': () => {
      t.revealed.add(me);
      push();
      emit({ type: 'cards-revealed' });
    },
    'fold-hand': () => {
      t.folded.add(me);
      push();
      emit({ type: 'fold-confirmed' });
    },
    'pause-timer': () => {
      if (!t.timer.startedAt) return;
      t.timer.pausedRemaining = timerState().remainingSeconds;
      t.timer.startedAt = null;
      push();
    },
    'resume-timer': () => {
      if (t.timer.pausedRemaining == null) return;
      t.timer.startedAt = Date.now() - (DURATION - t.timer.pausedRemaining) * 1000;
      t.timer.pausedRemaining = null;
      push();
    },
    'reset-timer': () => {
      t.timer = { startedAt: Date.now(), pausedRemaining: null, blindsWillIncrease: false };
      push();
    },
  };

  setTimeout(() => {
    if (disposed) return;
    onStatus('live');
    onMessage({ type: '@open' });
    onMessage({ type: mode === 'game' ? 'game-state' : 'community-state', data: snapshot() });
  }, 0);

  return {
    send(message) {
      handlers[message.type]?.(message);
      return true;
    },
    syncNow() {
      push();
    },
    close() {
      disposed = true;
    },
  };
}
