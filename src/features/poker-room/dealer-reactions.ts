import type { Hand, PublicPlayer, PublicState } from '../../poker/game-types.ts';
import { analyzeShowdown, rankLabel } from '../../poker/hands.ts';

export type DealerMood =
  'idle' | 'deal' | 'focus' | 'nod' | 'cheer' | 'wow' | 'raise' | 'timeout' | 'blinds' | 'shrug';

export type DealerReaction = {
  mood: DealerMood;
  text?: string;
  duration: number;
  lookAtBoard?: boolean;
};

const STREETS = {
  flop: 'Primeiras três!',
  turn: 'Mais uma carta.',
  river: 'Última carta da mesa.',
};

function resultReactions(state: PublicState): DealerReaction[] {
  const mainPot = state.pots?.[0];
  const awards = state.pots?.flatMap((pot) => pot.awards) ?? state.result;
  const winners = new Set(awards.map((award) => award.uid ?? award.name));
  const multiplePots = (state.pots?.length ?? 0) > 1;
  let text = 'Levou sem mostrar!';
  if (multiplePots && winners.size > 1) {
    text =
      state.pots?.length === 2 && winners.size === 2
        ? 'Dois potes, dois vencedores!'
        : 'Potes com vencedores diferentes!';
  } else if ((mainPot?.awards.length ?? 0) > 1) {
    text = 'Pote dividido!';
  } else if (state.reveal) {
    const ranked = state.players
      .filter((player): player is PublicPlayer & { hand: Hand } => player.hand != null)
      .sort((a, b) => b.hand.score - a.hand.score);
    const award = mainPot?.awards[0] ?? state.result[0];
    const winner = ranked.find((player) =>
      award?.uid ? award.uid === player.uid : award?.name === player.name,
    );
    const runnerUp = ranked.find(
      (player) =>
        player !== winner &&
        (!mainPot ||
          mainPot.eligible.some((seat) =>
            seat.uid ? seat.uid === player.uid : seat.name === player.name,
          )),
    );
    const decisive = winner ? analyzeShowdown([winner], runnerUp).decisiveIndex : null;
    const card = decisive != null ? winner?.hand.cards[decisive] : undefined;
    text = card != null ? `O ${rankLabel(card)} decidiu!` : 'Pote entregue!';
  }

  const reactions: DealerReaction[] = [{ mood: 'cheer', text, duration: 2350 }];
  if (state.reveal) {
    reactions.unshift({
      mood: 'focus',
      text: 'Vamos às cartas.',
      duration: 1250,
      lookAtBoard: true,
    });
  }
  if (
    !state.guided &&
    state.players.filter((player) => !player.kicked && !player.left && player.stack > 0).length ===
      1
  ) {
    reactions.push({ mood: 'cheer', text: 'Temos campeão!', duration: 2600 });
  }
  return reactions;
}

function hasNewShownCards(previous: PublicState, current: PublicState) {
  return current.players.some(
    (player) =>
      (player.shown?.length ?? 0) >
      (previous.players.find((other) => other.uid === player.uid)?.shown?.length ?? 0),
  );
}

export function dealerReactions(
  previous: PublicState | null,
  state: PublicState,
): DealerReaction[] {
  const starting =
    state.phase === 'preflop' &&
    (state.handLog ?? []).every((entry) => entry.kind === 'sb' || entry.kind === 'bb');
  const newHand = previous
    ? state.hand !== previous.hand || (starting && previous.phase === 'settled')
    : starting;

  if (state.phase === 'settled') {
    if (
      previous &&
      (previous.phase !== 'settled' ||
        newHand ||
        previous.history?.at(-1)?.at !== state.history?.at(-1)?.at)
    ) {
      return resultReactions(state);
    }
    if (previous && !state.reveal && hasNewShownCards(previous, state)) {
      return [{ mood: 'wow', text: 'Mostrou as cartas!', duration: 1700 }];
    }
    return [];
  }

  if (newHand) {
    const rematch =
      state.hand === 1 && (previous ? previous.phase === 'settled' : (state.turnSeq ?? 1) > 1);
    const reactions: DealerReaction[] = [
      {
        mood: 'deal',
        text: rematch ? 'Bora de novo?' : 'Cartas na mesa!',
        duration: 1450,
        lookAtBoard: true,
      },
    ];
    const playersInHand = state.players.filter(
      (player) => !player.fold && player.cards.length > 0,
    ).length;
    const previousPlayersInHand = previous?.players.filter(
      (player) => player.cards.length > 0,
    ).length;
    if (playersInHand === 2 && (rematch || previousPlayersInHand !== 2)) {
      reactions.push({ mood: 'focus', text: 'Agora é mano a mano.', duration: 1600 });
    }
    if ((state.blinds?.level ?? 1) > (previous?.blinds?.level ?? 1) && previous) {
      reactions.unshift({ mood: 'blinds', text: 'Os blinds subiram!', duration: 1600 });
    }
    return reactions;
  }

  if (!previous) return [];
  const street =
    (state.phase === 'flop' || state.phase === 'turn' || state.phase === 'river') &&
    state.board.length > previous.board.length
      ? STREETS[state.phase]
      : null;
  const reactions: DealerReaction[] = [];
  const last = state.last;
  if (last && last.seq !== previous.last?.seq) {
    const player = state.players[last.seat];
    if (last.auto && player && !player.left && !player.kicked) {
      reactions.push({ mood: 'timeout', text: 'Tempo esgotado.', duration: 1150 });
    } else if ((last.type === 'raise' || last.type === 'call') && player?.stack === 0) {
      reactions.push({ mood: 'wow', text: 'Tudo no meio!', duration: 1350 });
    } else if (last.type === 'raise') {
      const bet = state.handLog?.findLast((entry) => entry.kind !== 'street');
      if (bet?.kind === 'raise' && (bet.paid ?? bet.amount ?? 0) >= state.bb * 5) {
        reactions.push({ mood: 'raise', text: 'A aposta subiu.', duration: 1350 });
      }
    } else if (last.type === 'fold' && !street) {
      reactions.push({ mood: 'shrug', duration: 700 });
    }
  }
  if (street) reactions.push({ mood: 'nod', text: street, duration: 1650, lookAtBoard: true });
  return reactions;
}
