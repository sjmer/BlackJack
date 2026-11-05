interface DeckStackProps {
  remaining: number;
}

export function DeckStack({ remaining }: DeckStackProps) {
  return (
    <div className="deck-stack" aria-hidden="true">
      <span className="deck-stack__card deck-stack__card--back" />
      <span className="deck-stack__card deck-stack__card--middle" />
      <span className="deck-stack__card deck-stack__card--front">
        <span className="deck-stack__crest">21</span>
      </span>
      <span className="deck-stack__caption">
        <span>DECK</span>
        <strong>{String(remaining).padStart(2, '0')}</strong>
      </span>
    </div>
  );
}
