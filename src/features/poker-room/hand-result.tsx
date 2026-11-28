'use client';
import { useId, useRef, useState } from 'react';
import type { HandRecord, SeatRef } from '../../poker/game-types.ts';
import { fmt } from './table';
import { CloseButton } from './ui';

export function seatLabel(seat: SeatRef) {
  return seat.seat == null ? seat.name : `${seat.name} (assento ${seat.seat + 1})`;
}

export function PotBreakdown({ hand }: { hand: HandRecord }) {
  return (
    <div className="pot-breakdown">
      {hand.pots?.map((pot, i) => (
        <section key={i}>
          <h3>
            {i === 0 ? 'Pote principal' : `Pote lateral ${i}`} · {fmt(pot.amount)} fichas
          </h3>
          <p>Disputaram {pot.eligible.map(seatLabel).join(', ')}</p>
          <p>
            <strong>{pot.awards.length > 1 ? 'Empate · ' : ''}</strong>
            {pot.awards
              .map((award) => `${seatLabel(award)} ganhou ${fmt(award.amount)}`)
              .join(' · ')}
          </p>
        </section>
      ))}
      {!!hand.refunds?.length && (
        <section>
          <h3>Fichas devolvidas</h3>
          <p>Parte da aposta que ninguém cobriu.</p>
          {hand.refunds.map((refund) => (
            <p key={refund.uid}>
              {seatLabel(refund)} recebeu de volta {fmt(refund.amount)} fichas.
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

export function PotDetailsButton({ hand }: { hand?: HandRecord }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [selected, setSelected] = useState<HandRecord | null>(null);

  return (
    <>
      {!!(hand?.pots?.length || hand?.refunds?.length) && (
        <button
          type="button"
          className="outline sm-btn"
          onClick={() => {
            setSelected(hand!);
            dialog.current?.showModal();
          }}
        >
          Ver potes
        </button>
      )}
      <dialog
        ref={dialog}
        className="modal pot-details-modal"
        aria-labelledby={title}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <header className="between">
          <h2 id={title}>Potes da mão {selected?.hand}</h2>
          <CloseButton onClick={() => dialog.current?.close()} />
        </header>
        {selected && <PotBreakdown hand={selected} />}
      </dialog>
    </>
  );
}
