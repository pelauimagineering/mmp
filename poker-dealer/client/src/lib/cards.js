const RANK_NAMES = {
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight',
  7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
};

export function cardName(card) {
  return `${RANK_NAMES[card.rank] ?? card.rank} of ${card.suit}`;
}

export const STREETS = [
  { phase: 'pre-flop', label: 'Pre-flop' },
  { phase: 'flop', label: 'Flop' },
  { phase: 'turn', label: 'Turn' },
  { phase: 'river', label: 'River' },
];

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
