import type { HandRecord, SeatRef } from '../../poker/game-types.ts';
import { fmt } from './table';

export function seatLabel(seat: SeatRef) {
  return seat.seat == null ? seat.name : `${seat.name} (assento ${seat.seat + 1})`;
}

export function hasPotDetails(hand: HandRecord) {
  return (
    (hand.pots?.length ?? 0) > 1 ||
    !!hand.pots?.some((pot) => pot.awards.length > 1) ||
    !!hand.refunds?.length
  );
}

export function PotBreakdown({ hand, id }: { hand: HandRecord; id?: string }) {
  const seats = [...(hand.pots ?? []).flatMap((pot) => pot.eligible), ...(hand.refunds ?? [])];
  const label = (seat: SeatRef) =>
    seats.some((other) => other.name === seat.name && other.seat !== seat.seat)
      ? seatLabel(seat)
      : seat.name;

  return (
    <div className="pot-breakdown" id={id}>
      {hand.pots?.map((pot, i) => (
        <section key={i}>
          <div className="pot-line">
            <h3>{i === 0 ? 'Pote principal' : `Pote lateral ${i}`}</h3>
            <span>{fmt(pot.amount)} fichas</span>
          </div>
          {pot.awards.length > 1 && <p>Empate neste pote</p>}
          <ul>
            {pot.awards.map((award) => (
              <li className="pot-line" key={award.uid ?? award.seat}>
                <span>{label(award)}</span>
                <strong>+{fmt(award.amount)}</strong>
              </li>
            ))}
          </ul>
          {pot.eligible.length > pot.awards.length && (
            <p>Podiam disputar: {pot.eligible.map(label).join(', ')}</p>
          )}
        </section>
      ))}
      {!!hand.refunds?.length && (
        <section>
          <h3>Fichas devolvidas</h3>
          <p>Parte da aposta que ninguém cobriu.</p>
          <ul>
            {hand.refunds.map((refund) => (
              <li className="pot-line" key={refund.uid ?? refund.seat}>
                <span>{label(refund)}</span>
                <strong>+{fmt(refund.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
