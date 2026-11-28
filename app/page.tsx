import RoomScreen from '../src/features/poker-room/room-screen';
import { loadLeaderboard } from '../src/server/leaderboard.ts';

// A primeira dobra já chega com o pódio do clube renderizado no servidor (sem "Carregando…" nem salto de layout).
export default async function Page() {
  const lb = await loadLeaderboard('matches_won').catch(() => null);
  return <RoomScreen initialLeaderboard={lb ? lb.rows.slice(0, 3) : null} />;
}
