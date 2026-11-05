import { SuitIcon } from './SuitIcon';

export function CardBack() {
  return (
    <div className="card-back" aria-hidden="true">
      <div className="card-back__border">
        <div className="card-back__lattice" />
        <SuitIcon suit="spades" className="card-back__corner card-back__corner--tl" />
        <SuitIcon suit="hearts" className="card-back__corner card-back__corner--tr" />
        <SuitIcon suit="diamonds" className="card-back__corner card-back__corner--bl" />
        <SuitIcon suit="clubs" className="card-back__corner card-back__corner--br" />
        <div className="card-back__crest">
          <span className="card-back__star">✦</span>
          <span className="card-back__number">21</span>
          <span className="card-back__caption">BLACKJACK</span>
        </div>
      </div>
    </div>
  );
}
