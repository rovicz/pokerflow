import type { GameState, Hand, Player } from './game-types.ts';
import { randomInt } from 'node:crypto';
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
  s.deadline = now + s.seconds * 1000;
  const bot = s.players[i]?.bot;
  if (bot) {
    const minMs = bot.difficulty === 'easy' ? 850 : bot.difficulty === 'hard' ? 1050 : 900;
    const maxMs = bot.difficulty === 'easy' ? 1750 : bot.difficulty === 'hard' ? 2250 : 2000;
    s.botActAt = now + randomInt(minMs, maxMs);
  } else {
    s.botActAt = null;
  }
}
function purgeKicked(s: GameState) {
  let removedBeforeDealer = 0;
  const kept: Player[] = [];
  for (let i = 0; i < s.players.length; i++) {
    if (s.players[i].kicked) {
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

export function kickFromTable(s: GameState, targetId: string) {
  const idx = s.players.findIndex((p) => p.id === targetId);
  if (idx < 0) return false;
  if (!s.removed?.includes(targetId)) (s.removed ??= []).push(targetId);
  if (!s.banned?.includes(targetId)) (s.banned ??= []).push(targetId);

  if (s.phase === 'waiting' || s.phase === 'settled') {
    s.players.splice(idx, 1);
    if (idx <= s.dealer) s.dealer = Math.max(-1, s.dealer - 1);
    if (s.phase === 'settled' && s.players.filter((p) => !p.kicked && p.stack > 0).length < 2) {
      delete s.nextHandAt;
      delete s.pausedFor;
    }
    return true;
  }

  // Em mão ativa: preserva p.total no pote para conservação de fichas, dá fold e avança o turno se necessário.
  const target = s.players[idx];
  target.kicked = true;
  if (!target.fold) {
    target.fold = true;
    target.acted = true;
    target.actedAt = s.current ?? 0;
    if (s.turn === idx) {
      s.last = { seat: idx, type: 'fold', seq: (s.last?.seq || 0) + 1, auto: true };
      progress(s, idx);
    } else if (live(s).length === 1) {
      settle(s);
    }
  }
  return true;
}

export function start(s: GameState) {
  if (!['waiting', 'settled'].includes(s.phase)) throw Error('Mão em andamento');
  purgeKicked(s);
  if (s.players.filter((p) => p.stack > 0).length < 2) throw Error('Mínimo de dois jogadores');
  delete s.nextHandAt;
  delete s.pausedFor;
  s.deck = deck();
  s.board = [];
  s.result = [];
  s.dealer = next(s, s.dealer, (p) => p.stack > 0);
  for (const p of s.players) {
    p.cards = [];
    p.bet = 0;
    p.total = 0;
    p.fold = p.stack === 0;
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
  s.hand++;
  progress(s, bb);
  return s;
}
function settle(s: GameState) {
  const survivors = live(s);
  const levels = [...new Set(s.players.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b);
  let prev = 0;
  s.result = [];
  for (const level of levels) {
    const contributors = s.players.filter((p) => p.total >= level),
      pot = (level - prev) * contributors.length;
    prev = level;
    let eligible = contributors.filter((p) => !p.fold);
    if (contributors.length === 1 || !eligible.length) eligible = contributors;
    let winners = eligible;
    if (eligible.length > 1 && survivors.length > 1) {
      let best = Math.max(...eligible.map((p) => score([...p.cards, ...s.board])));
      winners = eligible.filter((p) => score([...p.cards, ...s.board]) === best);
    }
    winners.sort(
      (a, b) =>
        ((s.players.indexOf(a) - s.dealer - 1 + s.players.length) % s.players.length) -
        ((s.players.indexOf(b) - s.dealer - 1 + s.players.length) % s.players.length),
    );
    winners.forEach((p, i) => {
      let amount = Math.floor(pot / winners.length) + (i < pot % winners.length ? 1 : 0);
      p.stack += amount;
      s.result.push({ name: p.name, amount });
    });
  }
  s.reveal = survivors.length > 1;
  s.phase = 'settled';
  s.turn = -1;
  s.deadline = null;
  s.botActAt = null;
  for (const p of s.players) {
    p.total = 0;
    p.bet = 0;
  }
  if (s.players.filter((p) => !p.kicked && p.stack > 0).length >= 2) {
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
  while (count--) s.board.push(s.deck!.pop()!);
  s.phase = s.phase === 'preflop' ? 'flop' : s.phase === 'flop' ? 'turn' : 'river';
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
  if (s.phase !== 'settled' || s.players.filter((p) => !p.kicked && p.stack > 0).length < 2)
    throw Error('Sem próxima mão disponível');
  const now = Date.now();
  if (type === 'tick') {
    if (s.pausedFor != null || (s.nextHandAt ?? 0) > now) throw Error('Intervalo em andamento');
    if (s.nextHandAt == null) s.nextHandAt = now + 15000;
    else start(s);
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
  if (!p || !able(p) || current == null || minRaise == null || deadline == null)
    throw Error('Sem turno');
  let auto = false;
  if (type === 'tick') {
    if (Date.now() < deadline) throw Error('Prazo ativo');
    type = p.bet >= current ? 'check' : 'fold';
    auto = true;
  } else if (p.id !== id) throw Error('Não é sua vez');
  else if (Date.now() >= deadline) throw Error('Turno expirado');
  const due = Math.max(0, current - p.bet);
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
  s.last = { seat: s.turn, type, seq: (s.last?.seq || 0) + 1, ...(auto ? { auto } : {}) };
  progress(s, s.turn);
  return s;
}
export function view(s: GameState, id: string) {
  const { deck, removed, banned, banVote, voteCooldowns, spectators, ...safe } = s;
  return {
    ...safe,
    players: s.players.map(({ cards, ...p }) => ({
      ...p,
      cards:
        p.id === id || (s.phase === 'settled' && s.reveal && !p.fold) ? cards : cards.map(() => -1),
      hand: s.phase === 'settled' && s.reveal && !p.fold ? bestHand([...cards, ...s.board]) : null,
    })),
  };
}
