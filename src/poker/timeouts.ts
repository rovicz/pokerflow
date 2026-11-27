import type { GameState } from './game-types.ts';
import { act, betweenHands } from './engine.ts';

// Aplica, de uma vez, tudo o que já venceu: jogada automática de quem estourou o tempo e início da próxima mão.
// Roda no servidor a cada requisição da sala, então ninguém depende de um cliente específico para a mesa andar.
export function resolveDue(s: GameState, now = Date.now()): boolean {
  let changed = false;
  for (let i = 0; i < 20; i++) {
    try {
      if (s.deadline != null && s.turn >= 0 && now >= s.deadline) {
        act(s, s.players[s.turn].id, 'tick');
      } else if (
        s.phase === 'settled' &&
        s.pausedFor == null &&
        s.nextHandAt != null &&
        now >= s.nextHandAt &&
        s.players.filter((p) => p.stack > 0).length >= 2
      ) {
        betweenHands(s, s.host, 'tick');
      } else break;
      changed = true;
    } catch {
      break;
    }
  }
  return changed;
}
