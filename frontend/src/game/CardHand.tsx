import { CARDS } from '../engine';
import './cardHand.css';

interface Props {
  hand: string[];
  energy: number;
  maxEnergy: number;
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
  onEndTurn: () => void;
  disabled: boolean;
}

export function CardHand({ hand, energy, maxEnergy, selectedCardId, onSelectCard, onEndTurn, disabled }: Props) {
  return (
    <div className="hand-bar">
      <div className="energy">⚡ {energy}/{maxEnergy}</div>
      <div className="fan">
        {hand.map((id, i) => {
          const c = CARDS[id]!;
          const affordable = energy >= c.cost && !disabled;
          const sel = selectedCardId === id;
          const angle = (i - (hand.length - 1) / 2) * 6;
          return (
            <button
              key={`${id}-${i}`}
              className={`card ${sel ? 'sel' : ''} ${affordable ? '' : 'dim'}`}
              style={{ transform: `rotate(${angle}deg) translateY(${sel ? -18 : 0}px)` }}
              disabled={!affordable}
              onClick={() => onSelectCard(sel ? null : id)}
            >
              <div className="cost">{c.cost}</div>
              <div className="name">{c.name}</div>
              <div className="meta">{c.effect} · {c.shape}{c.range ? ` ${c.range}` : ''} · {c.power}</div>
            </button>
          );
        })}
      </div>
      <button className="end-turn" onClick={onEndTurn} disabled={disabled}>End Turn</button>
    </div>
  );
}
