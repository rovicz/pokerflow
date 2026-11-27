import { createClient } from '@supabase/supabase-js';
import type { GameState } from '../poker/game-types.ts';

type RoomRow = { code: string; state: GameState; version: number };
type Database = {
  public: {
    Tables: {
      poker_rooms: {
        Row: RoomRow;
        Insert: Omit<RoomRow, 'version'>;
        Update: Pick<RoomRow, 'version' | 'state'>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};
declare global {
  var pfMem: Map<string, RoomRow> | undefined;
}

const memory = (globalThis.pfMem ??= new Map<string, RoomRow>());

export function openRoomStore() {
  const client =
    process.env.SUPABASE_URL || process.env.NODE_ENV === 'production'
      ? createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

  return {
    async create(code: string, state: GameState) {
      if (!client) {
        memory.set(code, { code, state, version: 0 });
        return true;
      }
      const { error } = await client.from('poker_rooms').insert({ code, state });
      return !error;
    },
    async read(code: string): Promise<RoomRow | null> {
      if (!client) return structuredClone(memory.get(code) ?? null);
      const { data, error } = await client
        .from('poker_rooms')
        .select('*')
        .eq('code', code)
        .single();
      return error ? null : data;
    },
    // Remove salas sem atividade desde `cutoff` (ms). Devolve quantas foram apagadas.
    async deleteStale(cutoff: number) {
      if (!client) {
        let n = 0;
        for (const [code, row] of memory) {
          if ((row.state.touched ?? Infinity) < cutoff) {
            memory.delete(code);
            n++;
          }
        }
        return n;
      }
      const { data } = await client
        .from('poker_rooms')
        .delete()
        .lt('state->>touched' as never, String(cutoff))
        .select('code');
      return data?.length ?? 0;
    },
    async update(code: string, version: number, state: GameState) {
      if (!client) {
        if (memory.get(code)?.version !== version) return false;
        memory.set(code, { code, state: structuredClone(state), version: version + 1 });
        return true;
      }
      const { data, error } = await client
        .from('poker_rooms')
        .update({ state, version: version + 1 })
        .eq('code', code)
        .eq('version', version)
        .select('version');
      return !error && !!data?.length;
    },
  };
}
