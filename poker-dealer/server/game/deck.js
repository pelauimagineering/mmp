class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.visible = false;
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }

    toJSON() {
        return {
            suit: this.suit,
            rank: this.rank,
            visible: this.visible
        };
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        this.cards = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    // Fisher-Yates shuffle algorithm
    shuffle() {
        console.log('Shuffling deck...');
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count = 1) {
        if (count > this.cards.length) {
            throw new Error(`Cannot deal ${count} cards, only ${this.cards.length} remaining`);
        }

        return this.cards.splice(0, count);
    }

    remainingCount() {
        return this.cards.length;
    }

    toJSON() {
        return {
            cards: this.cards.map(card => card.toJSON())
        };
    }

    static fromJSON(data) {
        const deck = new Deck();
        deck.cards = [];

        if (data && data.cards) {
            for (const cardData of data.cards) {
                const card = new Card(cardData.suit, cardData.rank);
                card.visible = cardData.visible;
                deck.cards.push(card);
            }
        }

        return deck;
    }
}

module.exports = { Card, Deck };
