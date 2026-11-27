import type { AvatarInfo } from './avatars.ts';
import type { EmoteEvent } from './emotes.ts';

export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'settled';
export type Action = 'fold' | 'check' | 'call' | 'raise';
export type Point = { x: number; y: number };
export type Hand = { score: number; cards: number[]; rank: number; coreCount: number };
export type Player = {
  id: string;
  name: string;
  stack: number;
  cards: number[];
  bet: number;
  total: number;
  avatar?: AvatarInfo;
  fold?: boolean;
  acted?: boolean;
  actedAt?: number | null;
};
export type Spectator = { id: string; name: string; avatar?: AvatarInfo };
export type GameState = {
  host: string;
  initial: number;
  phase: Phase;
  players: Player[];
  board: number[];
  deck?: number[];
  result: { name: string; amount: number }[];
  hand: number;
  dealer: number;
  sbSeat?: number;
  bbSeat?: number;
  turn: number;
  sb: number;
  bb: number;
  seconds: number;
  deadline?: number | null;
  nextHandAt?: number | null;
  pausedFor?: number;
  current?: number;
  minRaise?: number;
  reveal?: boolean;
  last?: { seat: number; type: Action; seq: number; auto?: boolean };
  spectators?: Spectator[];
  removed?: string[];
  touched?: number;
  emotes?: EmoteEvent[];
};
export type PublicPlayer = Omit<Player, 'id'> & { self: boolean; hand: Hand | null };
export type PublicSpectator = { name: string; avatar?: AvatarInfo; self: boolean };
export type PublicState = Omit<
  GameState,
  'host' | 'deck' | 'players' | 'spectators' | 'removed'
> & {
  host: boolean;
  role: 'player' | 'spectator';
  players: PublicPlayer[];
  spectators: PublicSpectator[];
};
// now = relógio do servidor (ms) para corrigir diferenças de relógio; channel = canal de tempo real da sala.
export type Room = {
  code: string;
  state: PublicState;
  version: number;
  now?: number;
  channel?: string;
};
export type Winners = [name: string, amount: number][];
export type GameOperation =
  | 'create'
  | 'join'
  | 'state'
  | 'start'
  | 'interval'
  | 'remove'
  | 'avatar'
  | 'action'
  | 'emote'
  | 'leave'
  | 'sit';
