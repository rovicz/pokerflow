import type { GameState } from './game-types.ts';
import { act, betweenHands } from './engine.ts';
import { decideBotAction, maybeBotEmote } from './bot-ai.ts';
import { pushEmote } from './emotes.ts';
import { expireBanVote } from './moderation.ts';

// Aplica prazos vencidos: votação expirada, jogada de bot pronta (1 por vez para ritmo natural),
// timeout de humano e início automático da próxima mão.
// Roda no servidor a cada requisição da sala, sem depender de workers em background.
export function resolveDue(s: GameState, now = Date.now()): boolean {
  let changed = expireBanVote(s, now);
  for (let i = 0; i < 20; i++) {
    try {
      const activePlayer = s.turn >= 0 ? s.players[s.turn] : null;
      if (activePlayer?.bot && s.botActAt != null && now >= s.botActAt) {
        const seat = s.turn;
        const decision = decideBotAction(s, seat);
        const emote = maybeBotEmote(s, seat, decision);
        act(s, activePlayer.id, decision.type, decision.amount);
        if (emote) {
          const res = pushEmote(s.emotes, seat, emote, now);
          if (res.ok) s.emotes = res.emotes;
        }
        return true; // 1 jogada de bot por vez para o humano acompanhar cada ação na mesa
      }
      if (s.deadline != null && s.turn >= 0 && now >= s.deadline) {
        act(s, s.players[s.turn].id, 'tick');
      } else if (
        s.phase === 'settled' &&
        s.pausedFor == null &&
        s.nextHandAt != null &&
        now >= s.nextHandAt &&
        s.players.filter((p) => !p.kicked && !p.left && !p.sittingOut && p.stack > 0).length >= 2
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
