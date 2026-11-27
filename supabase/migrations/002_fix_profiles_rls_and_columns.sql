-- ============================================================================
-- PokerFlow — Migration 002: Garantia Idempotente de Colunas, RLS INSERT e Backfill
-- Segura para rodar mesmo se a migration 001 já foi executada ou se `profiles` já existia.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_style text not null default 'lorelei',
  avatar_seed text not null default '',
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_style text not null default 'lorelei';
alter table public.profiles add column if not exists avatar_seed text not null default '';
alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create table if not exists public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  hands_played integer not null default 0,
  hands_won integer not null default 0,
  matches_played integer not null default 0,
  matches_won integer not null default 0,
  biggest_pot integer not null default 0,
  total_chips_won bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'player');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "player_stats_select_public" on public.player_stats;
create policy "player_stats_select_public"
  on public.player_stats for select
  using (true);

-- Backfill para usuários já cadastrados em auth.users que ainda não tenham linha em profiles/stats
insert into public.profiles (id, username, display_name, avatar_style, avatar_seed)
select
  u.id,
  case
    when length(regexp_replace(coalesce(u.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g')) >= 3
      then substr(regexp_replace(u.raw_user_meta_data ->> 'username', '[^a-zA-Z0-9_]', '', 'g'), 1, 20)
    else 'player_' || substr(replace(u.id::text, '-', ''), 1, 8)
  end as username,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
    'Jogador'
  ) as display_name,
  'lorelei',
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), substr(u.id::text, 1, 8))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into public.player_stats (user_id)
select p.id
from public.profiles p
where not exists (select 1 from public.player_stats s where s.user_id = p.id)
on conflict (user_id) do nothing;

-- Recarrega imediatamente o cache de schema do PostgREST
notify pgrst, 'reload schema';
