create table if not exists public.poker_rooms (code text primary key, version integer not null default 0, state jsonb not null);
alter table public.poker_rooms enable row level security;
revoke all on public.poker_rooms from anon, authenticated;
grant select, insert, update, delete on public.poker_rooms to service_role;
