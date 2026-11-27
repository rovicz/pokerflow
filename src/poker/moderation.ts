import { createHash } from 'node:crypto';
import type { GameState, Player, PublicBanVote } from './game-types.ts';
import { kickFromTable } from './engine.ts';

export const VOTE_DURATION_MS = 30_000;
export const VOTE_COOLDOWN_MS = 60_000;
export const MIN_HUMANS_FOR_VOTE = 3;

// Identificador público estável e não-reversível por jogador (nunca expõe o session token).
export function publicPlayerUid(id: string): string {
  return createHash('sha256').update(`pokerflow:uid:${id}`).digest('hex').slice(0, 10);
}

export function activeHumans(s: GameState): Player[] {
  return s.players.filter((p) => !p.bot && !p.kicked && !p.left);
}

export function eligibleVoters(s: GameState, targetId: string): Player[] {
  return s.players.filter((p) => !p.bot && !p.kicked && !p.left && p.id !== targetId);
}

// Maioria absoluta (> 50%) dos humanos elegíveis (excluindo o alvo).
export function requiredVotes(eligibleCount: number): number {
  return Math.floor(eligibleCount / 2) + 1;
}

function nextNoticeSeq(s: GameState): number {
  return (s.voteNotice?.seq ?? 0) + 1;
}

function setCooldown(s: GameState, targetId: string, now: number) {
  const map: Record<string, number> = {};
  for (const [k, exp] of Object.entries(s.voteCooldowns ?? {})) {
    if (exp > now) map[k] = exp;
  }
  map[targetId] = now + VOTE_COOLDOWN_MS;
  s.voteCooldowns = map;
}

export function expireBanVote(s: GameState, now = Date.now()): boolean {
  const v = s.banVote;
  if (!v) return false;
  const target = s.players.find((p) => p.id === v.targetId && !p.kicked);
  if (!target) {
    s.banVote = null;
    return true;
  }
  if (now < v.expiresAt) return false;
  s.banVote = null;
  setCooldown(s, v.targetId, now);
  s.voteNotice = {
    seq: nextNoticeSeq(s),
    kind: 'expired',
    targetName: v.targetName,
    at: now,
  };
  return true;
}

export function castBanVote(
  s: GameState,
  voterId: string,
  targetUid: string,
  vote: 'yes' | 'no',
  now = Date.now(),
): void {
  expireBanVote(s, now);

  const voter = s.players.find((p) => p.id === voterId && !p.bot && !p.kicked);
  if (!voter) throw Error('Apenas jogadores humanos na mesa podem votar');

  const target = s.players.find((p) => publicPlayerUid(p.id) === targetUid && !p.kicked);
  if (!target) throw Error('Jogador não encontrado');
  if (target.id === voterId) throw Error('Você não pode votar em si mesmo');
  if (target.bot) throw Error('Apenas jogadores humanos podem ser alvo de votação');
  if (target.id === s.host) throw Error('O anfitrião não pode ser expulso por votação');

  const humans = activeHumans(s);
  if (humans.length < MIN_HUMANS_FOR_VOTE) {
    throw Error('São necessários pelo menos 3 jogadores humanos para iniciar uma votação');
  }

  if (!s.banVote) {
    if (vote !== 'yes') throw Error('Nenhuma votação ativa para este jogador');
    const cooldownUntil = s.voteCooldowns?.[target.id] ?? 0;
    if (cooldownUntil > now) {
      const waitSec = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
      throw Error(`Aguarde ${waitSec}s para abrir outra votação contra ${target.name}`);
    }
    s.banVote = {
      targetId: target.id,
      targetName: target.name,
      startedBy: voterId,
      yes: [voterId],
      no: [],
      startedAt: now,
      expiresAt: now + VOTE_DURATION_MS,
    };
  } else {
    if (s.banVote.targetId !== target.id) {
      throw Error('Já existe uma votação em andamento nesta sala');
    }
    if (s.banVote.yes.includes(voterId) || s.banVote.no.includes(voterId)) {
      throw Error('Você já registrou seu voto');
    }
    if (vote === 'yes') s.banVote.yes.push(voterId);
    else s.banVote.no.push(voterId);
  }

  const eligible = eligibleVoters(s, target.id);
  const eligibleIds = new Set(eligible.map((p) => p.id));
  const yesCount = s.banVote.yes.filter((id) => eligibleIds.has(id)).length;
  const noCount = s.banVote.no.filter((id) => eligibleIds.has(id)).length;
  const needed = requiredVotes(eligible.length);

  if (yesCount >= needed) {
    const targetName = s.banVote.targetName;
    s.banVote = null;
    kickFromTable(s, target.id);
    s.voteNotice = {
      seq: nextNoticeSeq(s),
      kind: 'banned',
      targetName,
      at: now,
    };
  } else if (noCount > eligible.length - needed) {
    const targetName = s.banVote.targetName;
    s.banVote = null;
    setCooldown(s, target.id, now);
    s.voteNotice = {
      seq: nextNoticeSeq(s),
      kind: 'rejected',
      targetName,
      at: now,
    };
  }
}

export function projectBanVote(s: GameState, viewerId: string): PublicBanVote | null {
  const v = s.banVote;
  if (!v) return null;
  const target = s.players.find((p) => p.id === v.targetId && !p.kicked);
  if (!target) return null;
  const eligible = eligibleVoters(s, v.targetId);
  const eligibleIds = new Set(eligible.map((p) => p.id));
  const yesCount = v.yes.filter((id) => eligibleIds.has(id)).length;
  const noCount = v.no.filter((id) => eligibleIds.has(id)).length;
  const required = requiredVotes(eligible.length);
  const myVote: 'yes' | 'no' | null = v.yes.includes(viewerId)
    ? 'yes'
    : v.no.includes(viewerId)
      ? 'no'
      : null;
  const canVote = eligibleIds.has(viewerId) && myVote === null;
  return {
    targetUid: publicPlayerUid(target.id),
    targetName: v.targetName,
    yesCount,
    noCount,
    required,
    eligible: eligible.length,
    expiresAt: v.expiresAt,
    myVote,
    canVote,
  };
}
