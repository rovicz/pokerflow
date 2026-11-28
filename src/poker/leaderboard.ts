export type LeaderboardCategory = 'matches_won' | 'total_chips_won' | 'hands_won' | 'biggest_pot';

export const LEADERBOARD_CATEGORIES: {
  id: LeaderboardCategory;
  label: string;
  short: string;
  desc: string;
  unit: string;
}[] = [
  {
    id: 'matches_won',
    label: 'Campeões',
    short: 'Partidas',
    desc: 'Jogadores que mais fecharam mesas como últimos sobreviventes.',
    unit: 'vitórias',
  },
  {
    id: 'total_chips_won',
    label: 'Banco Acumulado',
    short: 'Fichas',
    desc: 'Total de fichas conquistadas em potes ao longo de todas as sessões.',
    unit: 'fichas',
  },
  {
    id: 'hands_won',
    label: 'Reis da Rodada',
    short: 'Rodadas',
    desc: 'Maior número de mãos individuais vencidas nas mesas do clube.',
    unit: 'mãos',
  },
  {
    id: 'biggest_pot',
    label: 'Maior Pote',
    short: 'Recorde',
    desc: 'Recorde absoluto de maior pote único conquistado em uma única mão.',
    unit: 'fichas',
  },
];

export function isLeaderboardCategory(v: unknown): v is LeaderboardCategory {
  return v === 'matches_won' || v === 'total_chips_won' || v === 'hands_won' || v === 'biggest_pot';
}

export type StatDelta = {
  userId: string;
  handsPlayed: number;
  handsWon: number;
  matchesPlayed: number;
  matchesWon: number;
  biggestPot: number;
  chipsWon: number;
};

export type LeaderboardRow = {
  username: string;
  displayName: string;
  avatarStyle: string;
  avatarSeed: string;
  handsPlayed: number;
  handsWon: number;
  matchesPlayed: number;
  matchesWon: number;
  biggestPot: number;
  totalChipsWon: number;
  isMe?: boolean;
};

export function categoryValue(row: LeaderboardRow, category: LeaderboardCategory): number {
  switch (category) {
    case 'matches_won':
      return row.matchesWon;
    case 'total_chips_won':
      return row.totalChipsWon;
    case 'hands_won':
      return row.handsWon;
    case 'biggest_pot':
      return row.biggestPot;
  }
}

export function rankEntries(
  rows: LeaderboardRow[],
  category: LeaderboardCategory,
): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    const diff = categoryValue(b, category) - categoryValue(a, category);
    if (diff !== 0) return diff;
    if (category === 'matches_won') {
      const rateA = a.matchesPlayed > 0 ? a.matchesWon / a.matchesPlayed : 0;
      const rateB = b.matchesPlayed > 0 ? b.matchesWon / b.matchesPlayed : 0;
      if (rateB !== rateA) return rateB - rateA;
      return b.handsWon - a.handsWon || b.totalChipsWon - a.totalChipsWon;
    }
    if (category === 'total_chips_won') {
      return b.biggestPot - a.biggestPot || b.handsWon - a.handsWon;
    }
    if (category === 'hands_won') {
      const rateA = a.handsPlayed > 0 ? a.handsWon / a.handsPlayed : 0;
      const rateB = b.handsPlayed > 0 ? b.handsWon / b.handsPlayed : 0;
      if (rateB !== rateA) return rateB - rateA;
      return b.totalChipsWon - a.totalChipsWon;
    }
    return b.totalChipsWon - a.totalChipsWon || b.handsWon - a.handsWon;
  });
}
