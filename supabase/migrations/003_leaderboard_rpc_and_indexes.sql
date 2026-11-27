-- ============================================================================
-- PokerFlow — Migration 003: Índices de Leaderboard e RPC Atômica de Estatísticas
-- Executar no SQL Editor do Supabase.
-- ============================================================================

create index if not exists player_stats_matches_won_idx
  on public.player_stats (matches_won desc, hands_won desc);

create index if not exists player_stats_total_chips_idx
  on public.player_stats (total_chips_won desc, biggest_pot desc);

create index if not exists player_stats_hands_won_idx
  on public.player_stats (hands_won desc, hands_played asc);

create index if not exists player_stats_biggest_pot_idx
  on public.player_stats (biggest_pot desc, total_chips_won desc);

-- Gravação atômica em lote chamada exclusivamente pelo servidor (service_role)
create or replace function public.record_hand_stats(p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_uid uuid;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    return;
  end if;

  for item in select * from jsonb_array_elements(p_entries) loop
    v_uid := (item ->> 'userId')::uuid;
    if v_uid is null then
      continue;
    end if;

    -- Só grava se o perfil existir (evita erro se conta acabou de ser excluída)
    if not exists (select 1 from public.profiles where id = v_uid) then
      continue;
    end if;

    insert into public.player_stats (
      user_id,
      hands_played,
      hands_won,
      matches_played,
      matches_won,
      biggest_pot,
      total_chips_won
    )
    values (
      v_uid,
      greatest(0, coalesce((item ->> 'handsPlayed')::integer, 0)),
      greatest(0, coalesce((item ->> 'handsWon')::integer, 0)),
      greatest(0, coalesce((item ->> 'matchesPlayed')::integer, 0)),
      greatest(0, coalesce((item ->> 'matchesWon')::integer, 0)),
      greatest(0, coalesce((item ->> 'biggestPot')::integer, 0)),
      greatest(0, coalesce((item ->> 'chipsWon')::bigint, 0))
    )
    on conflict (user_id) do update set
      hands_played = public.player_stats.hands_played + excluded.hands_played,
      hands_won = public.player_stats.hands_won + excluded.hands_won,
      matches_played = public.player_stats.matches_played + excluded.matches_played,
      matches_won = public.player_stats.matches_won + excluded.matches_won,
      biggest_pot = greatest(public.player_stats.biggest_pot, excluded.biggest_pot),
      total_chips_won = public.player_stats.total_chips_won + excluded.total_chips_won,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.record_hand_stats(jsonb) from public, anon, authenticated;
grant execute on function public.record_hand_stats(jsonb) to service_role;

notify pgrst, 'reload schema';
