import type {
  ActiveStreet,
  GameState,
  Hand,
  HandLogEntry,
  HandRecord,
  HandShowdownEntry,
  HandWinnerSummary,
  Player,
  PotAward,
  SeatRef,
} from './game-types.ts';
import { describeHand } from './hands.ts';
import { advanceBlindsIfDue, blindsForLevel } from './blinds.ts';
import { randomInt } from 'node:crypto';
import { PRESENCE_TIMEOUT_MS, publicPlayerUid } from './seat.ts';

const MAX_HAND_HISTORY = 12;

function pushLog(s: GameState, entry: Omit<HandLogEntry, 'seq'>) {
  const list = (s.handLog ??= []);
  const seq = (list[list.length - 1]?.seq ?? 0) + 1;
  list.push({ seq, ...entry });
}
export function deck() {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
const rank = (c: number) => (c % 13) + 2;
function five(cs: number[]) {
  const r = cs.map(rank).sort((a, b) => b - a),
    groups = [...new Set(r)]
      .map((v) => [r.filter((x) => x === v).length, v])
      .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = cs.every((c) => Math.floor(c / 13) === Math.floor(cs[0] / 13));
  const straight =
    new Set(r).size === 5 ? (r[0] - r[4] === 4 ? r[0] : r.join(',') === '14,5,4,3,2' ? 5 : 0) : 0;
  let a =
    flush && straight
      ? [8, straight]
      : groups[0][0] === 4
        ? [7, ...groups.map((g) => g[1])]
        : groups[0][0] === 3 && groups[1][0] === 2
          ? [6, ...groups.map((g) => g[1])]
          : flush
            ? [5, ...r]
            : straight
              ? [4, straight]
              : groups[0][0] === 3
                ? [3, ...groups.map((g) => g[1])]
                : groups[0][0] === 2 && groups[1][0] === 2
                  ? [2, ...groups.map((g) => g[1])]
                  : groups[0][0] === 2
                    ? [1, ...groups.map((g) => g[1])]
                    : [0, ...r];
  return Array.from({ length: 6 }, (_, i) => a[i] || 0).reduce((s, v) => s * 15 + v, 0);
}
const CORE_COUNTS = [1, 2, 4, 3, 5, 5, 5, 4, 5];
function orderHand(cards: number[], category: number) {
  const byVal = [...cards].sort((a, b) => rank(b) - rank(a) || a - b);
  if (category === 8 || category === 4) {
    const wheel = byVal.map(rank).join(',') === '14,5,4,3,2';
    return wheel ? [byVal[0], ...byVal.slice(1).reverse()] : byVal.reverse();
  }
  if (category === 5) return byVal;
  const freq = new Map<number, number>();
  for (const c of byVal) freq.set(rank(c), (freq.get(rank(c)) || 0) + 1);
  return byVal.sort(
    (a, b) => freq.get(rank(b))! - freq.get(rank(a))! || rank(b) - rank(a) || a - b,
  );
}
export function bestHand(cs: number[]): Hand | null {
  let best = 0,
    cards: number[] = [];
  for (let a = 0; a < cs.length - 4; a++)
    for (let b = a + 1; b < cs.length - 3; b++)
      for (let c = b + 1; c < cs.length - 2; c++)
        for (let d = c + 1; d < cs.length - 1; d++)
          for (let e = d + 1; e < cs.length; e++) {
            const candidate = [cs[a], cs[b], cs[c], cs[d], cs[e]],
              value = five(candidate);
            if (!cards.length || value > best) {
              best = value;
              cards = candidate;
            }
          }
  if (!cards.length) return null;
  const category = Math.floor(best / 15 ** 5),
    royal = category === 8 && Math.floor(best / 15 ** 4) % 15 === 14;
  return {
    score: best,
    cards: orderHand(cards, category),
    rank: royal ? 1 : 10 - category,
    coreCount: CORE_COUNTS[category],
  };
}
export function score(cs: number[]) {
  return bestHand(cs)?.score || 0;
}
const live = (s: GameState) => s.players.filter((p) => !p.fold && p.cards.length);
const able = (p: Player) => !p.fold && p.cards.length && p.stack > 0;
const next = (s: GameState, i: number, f: (p: Player) => boolean) => {
  for (let n = 1; n <= s.players.length; n++) {
    let j = (i + n) % s.players.length;
    if (f(s.players[j])) return j;
  }
  return -1;
};
function pay(p: Player, n: number) {
  n = Math.min(n, p.stack);
  p.stack -= n;
  p.bet += n;
  p.total += n;
}
function turn(s: GameState, i: number) {
  s.turn = i;
  const now = Date.now();
  s.turnSeq = (s.turnSeq ?? 0) + 1;
  const bot = s.players[i]?.bot;
  s.deadline = s.guided && !bot ? null : now + s.seconds * 1000;
  if (bot) {
    const minMs = bot.difficulty === 'easy' ? 850 : bot.difficulty === 'hard' ? 1050 : 900;
    const maxMs = bot.difficulty === 'easy' ? 1750 : bot.difficulty === 'hard' ? 2250 : 2000;
    s.botActAt = now + randomInt(minMs, maxMs);
  } else {
    s.botActAt = null;
  }
}
function pushRoomNotice(s: GameState, text: string) {
  s.roomNotice = {
    seq: (s.roomNotice?.seq ?? 0) + 1,
    text,
    at: Date.now(),
  };
}

const eligibleToPlay = (p: Player) => !p.kicked && !p.left && !p.sittingOut && p.stack > 0;
const remainingWithChips = (p: Player) => !p.kicked && !p.left && p.stack > 0;

function purgeDeparted(s: GameState) {
  let removedBeforeDealer = 0;
  const kept: Player[] = [];
  for (let i = 0; i < s.players.length; i++) {
    if (s.players[i].kicked || s.players[i].left) {
      if (i <= s.dealer) removedBeforeDealer++;
    } else {
      kept.push(s.players[i]);
    }
  }
  if (kept.length !== s.players.length) {
    s.players = kept;
    s.dealer = s.players.length ? Math.max(-1, s.dealer - removedBeforeDealer) : -1;
  }
}

export function transferHostIfNeeded(s: GameState) {
  const hostActive = s.players.some((p) => p.id === s.host && !p.bot && !p.kicked && !p.left);
  if (hostActive) return false;
  const nextHost = s.players.find((p) => !p.bot && !p.kicked && !p.left);
  if (!nextHost) return false;
  s.host = nextHost.id;
  pushRoomNotice(s, `${nextHost.name} agora é o anfitrião da sala.`);
  return true;
}

export function kickFromTable(s: GameState, targetId: string) {
  const idx = s.players.findIndex((p) => p.id === targetId);
  if (idx < 0) return false;
  if (!s.removed?.includes(targetId)) (s.removed ??= []).push(targetId);
  if (!s.banned?.includes(targetId)) (s.banned ??= []).push(targetId);
  const sessionToken = s.players[idx].sessionToken;
  if (sessionToken && sessionToken !== targetId) {
    (s.removed ??= []).push(sessionToken);
    (s.banned ??= []).push(sessionToken);
  }

  if (s.phase === 'waiting' || s.phase === 'settled') {
    s.players.splice(idx, 1);
    if (idx <= s.dealer) s.dealer = Math.max(-1, s.dealer - 1);
    if (s.phase === 'settled' && s.players.filter(eligibleToPlay).length < 2) {
      delete s.nextHandAt;
      delete s.pausedFor;
    }
    transferHostIfNeeded(s);
    return true;
  }

  // Em mão ativa: preserva p.total no pote para conservação de fichas, dá fold e avança o turno se necessário.
  const target = s.players[idx];
  target.kicked = true;
  if (!target.fold) {
    target.fold = true;
    target.acted = true;
    target.actedAt = s.current ?? 0;
    pushLog(s, { street: s.phase, kind: 'fold', actor: target.name, auto: true });
    if (s.turn === idx) {
      s.last = { seat: idx, type: 'fold', seq: (s.last?.seq || 0) + 1, auto: true };
      progress(s, idx);
    } else if (live(s).length === 1) {
      settle(s);
    }
  }
  transferHostIfNeeded(s);
  return true;
}

export function leaveTable(s: GameState, id: string) {
  const idx = s.players.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  const target = s.players[idx];
  const wasHost = s.host === id;
  if (s.banVote?.targetId === id) s.banVote = null;

  if (s.phase === 'waiting' || s.phase === 'settled') {
    s.players.splice(idx, 1);
    if (idx <= s.dealer) s.dealer = Math.max(-1, s.dealer - 1);
    if (s.phase === 'settled' && s.players.filter(eligibleToPlay).length < 2) {
      delete s.nextHandAt;
      delete s.pausedFor;
    }
    if (!transferHostIfNeeded(s) && !wasHost) {
      pushRoomNotice(s, `${target.name} saiu da mesa.`);
    }
    return true;
  }

  // Em mão ativa: saída segura sem banimento e com 100% de conservação de fichas.
  target.left = true;
  if (!target.fold) {
    target.fold = true;
    target.acted = true;
    target.actedAt = s.current ?? 0;
    pushLog(s, { street: s.phase, kind: 'fold', actor: target.name, auto: true });
    if (s.turn === idx) {
      s.last = { seat: idx, type: 'fold', seq: (s.last?.seq || 0) + 1, auto: true };
      progress(s, idx);
    } else if (live(s).length === 1) {
      settle(s);
    }
  }
  if (!transferHostIfNeeded(s)) {
    pushRoomNotice(s, `${target.name} saiu da mesa.`);
  }
  return true;
}

export function setSitOut(s: GameState, id: string, active: boolean) {
  if (s.guided) throw Error('O treino pode ser retomado a qualquer momento');
  const idx = s.players.findIndex((p) => p.id === id && !p.bot && !p.kicked && !p.left);
  if (idx < 0) throw Error('Jogador inválido');
  const p = s.players[idx];
  if (!!p.sittingOut === active) return s;
  p.sittingOut = active;

  if (active && s.phase !== 'waiting' && s.phase !== 'settled' && s.turn === idx) {
    const due = Math.max(0, (s.current ?? 0) - p.bet);
    act(s, id, due > 0 ? 'fold' : 'check');
  } else if (s.phase === 'settled') {
    const readyCount = s.players.filter(eligibleToPlay).length;
    if (readyCount < 2) {
      delete s.nextHandAt;
      delete s.pausedFor;
    } else if (s.nextHandAt == null && s.pausedFor == null) {
      s.nextHandAt = Date.now() + 5000;
    }
  }
  return s;
}

export function showCards(s: GameState, id: string, indices?: unknown) {
  if (s.phase !== 'settled' || s.reveal)
    throw Error('Mostrar cartas só vale após vitória por desistência');
  const p = s.players.find((q) => q.id === id && !q.kicked && !q.left);
  if (!p || p.fold || p.cards.length !== 2)
    throw Error('Apenas o vencedor pode mostrar suas cartas');
  const raw = Array.isArray(indices) ? indices : [0, 1];
  const valid = [...new Set(raw.filter((x): x is number => x === 0 || x === 1))].sort();
  if (!valid.length) throw Error('Cartas inválidas');
  const merged = [...new Set([...(p.shown ?? []), ...valid])].sort();
  p.shown = merged;

  // Atualiza o último registro no histórico da mesa se corresponder à mão atual.
  const lastRec = s.history?.[s.history.length - 1];
  if (lastRec && lastRec.hand === s.hand && !lastRec.reveal) {
    lastRec.shown = {
      name: p.name,
      cards: p.cards.map((c, idx) => (merged.includes(idx) ? c : -1)),
    };
  }
  return s;
}

export function rematch(s: GameState, id: string, mode: unknown) {
  if (s.host !== id) throw Error('Somente o anfitrião pode iniciar a revanche');
  if (s.phase !== 'settled') throw Error('A partida ainda está em andamento');
  if (!s.guided && s.players.filter(remainingWithChips).length >= 2) {
    throw Error('A partida ainda tem jogadores com fichas');
  }
  const targetMode = !s.guided && mode === 'lobby' ? 'lobby' : 'start';
  purgeDeparted(s);
  for (const p of s.players) {
    p.stack = s.initial;
    p.cards = [];
    p.bet = 0;
    p.total = 0;
    p.fold = false;
    p.sittingOut = false;
    delete p.ready;
    delete p.shown;
    p.acted = false;
    p.actedAt = null;
  }
  s.dealer = -1;
  s.turn = -1;
  s.hand = 0;
  s.board = [];
  s.result = [];
  delete s.pots;
  delete s.refunds;
  s.handLog = [];
  s.history = [];
  s.reveal = false;
  s.banVote = null;
  delete s.sbSeat;
  delete s.bbSeat;
  delete s.current;
  delete s.minRaise;
  delete s.last;
  delete s.nextHandAt;
  delete s.pausedFor;
  delete s.statsRecordedHand;
  delete s.statsRecordedMatch;
  s.deadline = null;
  s.botActAt = null;
  if (s.blinds) {
    s.blinds.level = 1;
    s.blinds.nextAt = null;
    const base = blindsForLevel(s.blinds.baseBb, 1);
    s.sb = base.sb;
    s.bb = base.bb;
  }

  if (targetMode === 'start' && s.players.length >= 2) {
    s.phase = 'waiting';
    start(s);
  } else {
    s.phase = 'waiting';
  }
  return s;
}

export function start(s: GameState, now = Date.now()) {
  if (!['waiting', 'settled'].includes(s.phase)) throw Error('Mão em andamento');
  purgeDeparted(s);
  if (s.players.filter(eligibleToPlay).length < 2) throw Error('Mínimo de dois jogadores');
  delete s.nextHandAt;
  delete s.pausedFor;
  s.deck = deck();
  s.board = [];
  s.result = [];
  delete s.pots;
  delete s.refunds;
  s.reveal = false;
  s.hand++;
  const blindUpdate = advanceBlindsIfDue(s, now);
  if (blindUpdate.leveledUp) {
    pushRoomNotice(
      s,
      `Nível ${blindUpdate.level} · Blinds subiram para ${blindUpdate.sb}/${blindUpdate.bb}!`,
    );
  }
  s.dealer = next(s, s.dealer, eligibleToPlay);
  for (const p of s.players) {
    p.cards = [];
    p.bet = 0;
    p.total = 0;
    p.fold = p.stack === 0 || !!p.sittingOut;
    delete p.shown;
    p.acted = false;
    p.actedAt = null;
  }
  for (let k = 0; k < 2; k++)
    for (let n = 1; n <= s.players.length; n++) {
      let p = s.players[(s.dealer + n) % s.players.length];
      if (!p.fold) p.cards.push(s.deck!.pop()!);
    }
  const heads = live(s).length === 2;
  let sb = heads ? s.dealer : next(s, s.dealer, (p) => !p.fold),
    bb = next(s, sb, (p) => !p.fold);
  s.sbSeat = sb;
  s.bbSeat = bb;
  pay(s.players[sb], s.sb);
  pay(s.players[bb], s.bb);
  s.current = s.bb;
  s.minRaise = s.bb;
  s.phase = 'preflop';
  s.handLog = [];
  if (s.players[sb].bet > 0) {
    pushLog(s, {
      street: 'preflop',
      kind: 'sb',
      actor: s.players[sb].name,
      amount: s.players[sb].bet,
    });
  }
  if (s.players[bb].bet > 0) {
    pushLog(s, {
      street: 'preflop',
      kind: 'bb',
      actor: s.players[bb].name,
      amount: s.players[bb].bet,
    });
  }
  progress(s, bb);
  return s;
}
function settle(s: GameState) {
  const survivors = live(s);
  const levels = [...new Set(s.players.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b);
  const seatRef = (p: Player): SeatRef => ({
    uid: publicPlayerUid(p.id),
    seat: s.players.indexOf(p),
    name: p.name,
  });
  const pots: { amount: number; eligible: Player[] }[] = [];
  s.refunds = [];
  let prev = 0;
  for (const level of levels) {
    const contributors = s.players.filter((p) => p.total >= level);
    const amount = (level - prev) * contributors.length;
    prev = level;
    if (contributors.length === 1) {
      const [p] = contributors;
      p.stack += amount;
      s.refunds.push({ ...seatRef(p), amount });
      continue;
    }

    // Saídas e expulsões podem deixar um pote lateral sem ninguém elegível.
    // Nesse caso, incorpore as fichas ao último pote que ainda pode ser disputado.
    const last = pots.at(-1);
    const eligible = contributors.filter((p) => !p.fold);
    const sameEligibility =
      last &&
      eligible.length === last.eligible.length &&
      eligible.every((p, i) => last.eligible[i] === p);
    if (last && (!eligible.length || sameEligibility)) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligible: eligible.length ? eligible : survivors });
    }
  }
  const revealed = survivors.length > 1;
  const hands = new Map(
    revealed ? survivors.map((p) => [p, bestHand([...p.cards, ...s.board])]) : [],
  );
  s.pots = pots.map(({ amount, eligible }): PotAward => {
    const best = Math.max(...eligible.map((p) => hands.get(p)?.score ?? 0));
    const winners = eligible.filter((p) => (hands.get(p)?.score ?? 0) === best);
    winners.sort(
      (a, b) =>
        ((s.players.indexOf(a) - s.dealer - 1 + s.players.length) % s.players.length) -
        ((s.players.indexOf(b) - s.dealer - 1 + s.players.length) % s.players.length),
    );
    const awards = winners.map((p, i) => {
      const won = Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0);
      p.stack += won;
      return { ...seatRef(p), amount: won };
    });
    return { amount, eligible: eligible.map(seatRef), awards };
  });
  s.result = s.pots.flatMap((pot) => pot.awards);
  s.reveal = revealed;

  const winners = new Map<string, HandWinnerSummary>();
  for (const award of s.result) {
    const previous = winners.get(award.uid!);
    const hand = award.seat == null ? null : hands.get(s.players[award.seat]);
    winners.set(award.uid!, {
      ...award,
      amount: (previous?.amount ?? 0) + award.amount,
      ...(hand ? { handName: describeHand(hand) } : {}),
    });
  }
  const showdown: HandShowdownEntry[] | undefined = revealed
    ? survivors.map((p) => ({
        ...seatRef(p),
        cards: [...p.cards],
        handName: describeHand(hands.get(p) ?? null),
        won: winners.has(publicPlayerUid(p.id)),
      }))
    : undefined;
  const record: HandRecord = {
    hand: s.hand,
    at: Date.now(),
    pot: s.pots.reduce((sum, pot) => sum + pot.amount, 0),
    board: [...s.board],
    reveal: s.reveal,
    winners: [...winners.values()],
    pots: s.pots,
    refunds: s.refunds,
    log: [...(s.handLog ?? [])],
    ...(showdown ? { showdown } : {}),
  };
  s.history = [...(s.history ?? []), record].slice(-MAX_HAND_HISTORY);

  s.phase = 'settled';
  s.turn = -1;
  s.deadline = null;
  s.botActAt = null;
  for (const p of s.players) {
    p.total = 0;
    p.bet = 0;
  }
  if (!s.guided && s.players.filter(eligibleToPlay).length >= 2) {
    s.nextHandAt = Date.now() + 15000;
  } else {
    delete s.nextHandAt;
  }
}
function progress(s: GameState, from: number) {
  if (live(s).length === 1) {
    settle(s);
    return;
  }
  const active = s.players.filter(able);
  let i = next(s, from, (p) => !!able(p) && (!p.acted || p.bet < (s.current ?? 0)));
  if (active.length === 1 && active[0].bet >= (s.current ?? 0)) i = -1;
  if (i >= 0) {
    turn(s, i);
    return;
  }
  if (s.phase === 'river') {
    settle(s);
    return;
  }
  s.deck!.pop()!;
  let count = s.phase === 'preflop' ? 3 : 1;
  const dealt: number[] = [];
  while (count--) {
    const c = s.deck!.pop()!;
    s.board.push(c);
    dealt.push(c);
  }
  const nextStreet: ActiveStreet =
    s.phase === 'preflop' ? 'flop' : s.phase === 'flop' ? 'turn' : 'river';
  s.phase = nextStreet;
  pushLog(s, { street: nextStreet, kind: 'street', cards: dealt });
  s.current = 0;
  s.minRaise = s.bb;
  for (const p of s.players) {
    p.bet = 0;
    p.acted = false;
    p.actedAt = null;
  }
  progress(s, s.dealer);
}
export function betweenHands(s: GameState, id: string, type: unknown) {
  if (s.guided || s.phase !== 'settled' || s.players.filter(eligibleToPlay).length < 2)
    throw Error('Sem próxima mão disponível');
  const now = Date.now();
  if (type === 'tick') {
    if (s.pausedFor != null || (s.nextHandAt ?? 0) > now) throw Error('Intervalo em andamento');
    if (s.nextHandAt == null) s.nextHandAt = now + 15000;
    else start(s);
    return;
  }
  if (type === 'skip') {
    // Pular a espera só faz sentido sem outros humanos na mesa (jogo solo contra bots).
    if (s.host !== id) throw Error('Somente o anfitrião pode pular o intervalo');
    if (s.players.some((p) => p.id !== id && !p.bot && !p.kicked && !p.left))
      throw Error('Só é possível pular o intervalo jogando contra bots');
    start(s);
    return;
  }
  if (s.host !== id) throw Error('Somente o anfitrião pode pausar ou retomar');
  if (type === 'pause' && s.pausedFor == null && s.nextHandAt != null && s.nextHandAt > now) {
    s.pausedFor = s.nextHandAt - now;
    s.nextHandAt = null;
  } else if (type === 'resume' && s.pausedFor != null) {
    s.nextHandAt = now + s.pausedFor;
    delete s.pausedFor;
  } else throw Error('Intervalo atualizado');
}
export function act(s: GameState, id: string, type: unknown, amount?: unknown) {
  const p = s.players[s.turn],
    { current, minRaise, deadline } = s;
  if (
    !p ||
    !able(p) ||
    current == null ||
    minRaise == null ||
    (deadline == null && (!s.guided || p.bot))
  )
    throw Error('Sem turno');
  let auto = false;
  if (type === 'tick') {
    if (deadline == null || Date.now() < deadline) throw Error('Prazo ativo');
    type = p.bet >= current ? 'check' : 'fold';
    auto = true;
  } else if (p.id !== id) throw Error('Não é sua vez');
  else if (deadline != null && Date.now() >= deadline) throw Error('Turno expirado');
  const due = Math.max(0, current - p.bet);
  const previousBet = p.bet;
  if (type === 'fold') p.fold = true;
  else if (type === 'check') {
    if (due) throw Error('Existe aposta pendente');
  } else if (type === 'call') {
    if (!due) throw Error('Use check');
    pay(p, due);
  } else if (type === 'raise') {
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount <= current ||
      amount > p.bet + p.stack
    )
      throw Error('Valor inválido');
    if (p.actedAt != null && current - p.actedAt < minRaise) throw Error('Aposta não reaberta');
    if (!s.players.some((q) => q !== p && able(q))) throw Error('Sem adversário para aumentar');
    let inc = amount - current;
    if (inc < minRaise && amount !== p.bet + p.stack) throw Error('Raise abaixo do mínimo');
    pay(p, amount - p.bet);
    if (inc >= minRaise) s.minRaise = inc;
    s.current = amount;
  } else throw Error('Ação inválida');
  p.acted = true;
  p.actedAt = s.current!;
  if (s.phase !== 'waiting' && s.phase !== 'settled') {
    const isAllIn = (type === 'call' || type === 'raise') && p.stack === 0;
    pushLog(s, {
      street: s.phase,
      kind: isAllIn ? 'allin' : type,
      actor: p.name,
      ...(type === 'call' || type === 'raise' ? { amount: p.bet, paid: p.bet - previousBet } : {}),
      ...(auto ? { auto: true } : {}),
    });
  }
  s.last = { seat: s.turn, type, seq: (s.last?.seq || 0) + 1, ...(auto ? { auto } : {}) };
  progress(s, s.turn);
  return s;
}
export function view(s: GameState, id: string) {
  const {
    deck,
    removed,
    banned,
    banVote,
    voteCooldowns,
    spectators,
    statsRecordedHand,
    statsRecordedMatch,
    ...safe
  } = s;
  return {
    ...safe,
    players: s.players.map(({ cards, userId, sessionToken, lastSeenAt, actionReceipts, ...p }) => ({
      ...p,
      ...(userId ? { verified: true } : {}),
      ...(lastSeenAt != null && !p.bot
        ? { connected: Date.now() - lastSeenAt < PRESENCE_TIMEOUT_MS }
        : {}),
      cards:
        p.id === id || (s.phase === 'settled' && s.reveal && !p.fold)
          ? cards
          : cards.map((c, idx) => (s.phase === 'settled' && p.shown?.includes(idx) ? c : -1)),
      hand: s.phase === 'settled' && s.reveal && !p.fold ? bestHand([...cards, ...s.board]) : null,
    })),
  };
}
