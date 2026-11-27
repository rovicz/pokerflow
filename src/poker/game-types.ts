import type { AvatarInfo } from './avatars.ts';
import type { EmoteEvent } from './emotes.ts';

export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'settled';
export type Action = 'fold' | 'check' | 'call' | 'raise';
export type Point = { x: number; y: number };
export type Hand = { score: number; cards: number[]; rank: number; coreCount: number };
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type BotStyle = 'tight' | 'balanced' | 'aggressive' | 'wild';
export type BotProfile = { style: BotStyle; difficulty: BotDifficulty };
export type Player = {
  id: string;
  name: string;
  stack: number;
  cards: number[];
  bet: number;
  total: number;
  avatar?: AvatarInfo;
  bot?: BotProfile;
  fold?: boolean;
  kicked?: boolean;
  acted?: boolean;
  actedAt?: number | null;
};
export type BanVote = {
  targetId: string;
  targetName: string;
  startedBy: string;
  yes: string[];
  no: string[];
  startedAt: number;
  expiresAt: number;
};
export type PublicBanVote = {
  targetUid: string;
  targetName: string;
  yesCount: number;
  noCount: number;
  required: number;
  eligible: number;
  expiresAt: number;
  myVote: 'yes' | 'no' | null;
  canVote: boolean;
};
export type VoteNotice = {
  seq: number;
  kind: 'banned' | 'rejected' | 'expired';
  targetName: string;
  at: number;
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
  botActAt?: number | null;
  botDifficulty?: BotDifficulty;
  nextHandAt?: number | null;
  pausedFor?: number;
  current?: number;
  minRaise?: number;
  reveal?: boolean;
  last?: { seat: number; type: Action; seq: number; auto?: boolean };
  spectators?: Spectator[];
  removed?: string[];
  banned?: string[];
  banVote?: BanVote | null;
  voteCooldowns?: Record<string, number>;
  voteNotice?: VoteNotice | null;
  touched?: number;
  emotes?: EmoteEvent[];
};
export type PublicPlayer = Omit<Player, 'id'> & {
  uid: string;
  self: boolean;
  isHost?: boolean;
  hand: Hand | null;
};
export type PublicSpectator = { name: string; avatar?: AvatarInfo; self: boolean };
export type PublicState = Omit<
  GameState,
  'host' | 'deck' | 'players' | 'spectators' | 'removed' | 'banned' | 'banVote' | 'voteCooldowns'
> & {
  host: boolean;
  role: 'player' | 'spectator';
  players: PublicPlayer[];
  spectators: PublicSpectator[];
  banVote?: PublicBanVote | null;
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
  | 'add_bot'
  | 'vote_kick'
  | 'leave'
  | 'sit';
