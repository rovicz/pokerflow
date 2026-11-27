-- ============================================================================
-- PokerFlow — Migration 001: Perfis de Usuários & Estatísticas (Base Auth + Leaderboards)
-- Executar no SQL Editor do Supabase (ou via Supabase CLI) após revisão.
-- ============================================================================

-- 1. Perfis públicos (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_style text not null default 'lorelei',
  avatar_seed text not null default '',
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- 2. Estatísticas de jogador (1:1 com profiles — fundação para leaderboards)
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

-- 3. Trigger para atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_player_stats_updated_at on public.player_stats;
create trigger trg_player_stats_updated_at
  before update on public.player_stats
  for each row execute function public.set_updated_at();

-- 4. Trigger automática ao criar conta no Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  clean_username text;
  raw_display text;
begin
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  clean_username := regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g');
  if length(clean_username) < 3 then
    clean_username := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  clean_username := substr(clean_username, 1, 20);

  raw_display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    clean_username
  );

  insert into public.profiles (id, username, display_name, avatar_seed)
  values (new.id, clean_username, substr(raw_display, 1, 24), clean_username)
  on conflict (id) do nothing;

  insert into public.player_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;

-- Perfis públicos legíveis (nunca inclui e-mail; e-mail vive apenas em auth.users)
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Usuário só atualiza o próprio perfil e nunca pode alterar o próprio role
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Estatísticas legíveis publicamente (leaderboards), escritas apenas via service_role no servidor
drop policy if exists "player_stats_select_public" on public.player_stats;
create policy "player_stats_select_public"
  on public.player_stats for select
  using (true);
