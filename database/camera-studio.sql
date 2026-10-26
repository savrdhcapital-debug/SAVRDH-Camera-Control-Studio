-- Dedicated Camera Studio table. No TV OS tables, roles or records are changed.
begin;
create table public.camera_studio_state (
  id text primary key check (id = 'main'),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and
    payload @> '{"version":1}'::jsonb and
    jsonb_typeof(payload->'customers') = 'array' and
    jsonb_typeof(payload->'plans') = 'array' and
    jsonb_typeof(payload->'licenses') = 'array' and
    jsonb_typeof(payload->'models') = 'array' and
    jsonb_typeof(payload->'payments') = 'array' and
    jsonb_typeof(payload->'tickets') = 'array' and
    jsonb_typeof(payload->'studio') = 'array' and
    jsonb_typeof(payload->'audit') = 'array'
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.camera_studio_state enable row level security;
revoke all on public.camera_studio_state from public, anon, authenticated;
grant select, insert, update on public.camera_studio_state to service_role;
comment on table public.camera_studio_state is 'Camera Control Studio admin records only; server access only. Independent from TV OS.';
commit;
