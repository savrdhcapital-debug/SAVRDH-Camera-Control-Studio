-- Apply after camera-studio.sql. Camera admins are independent of TV OS roles.
begin;
create table public.camera_studio_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.camera_studio_admins enable row level security;
revoke all on public.camera_studio_admins from public, anon, authenticated;
grant select on public.camera_studio_admins to authenticated;
create policy camera_admin_self_read on public.camera_studio_admins for select to authenticated
 using (user_id=(select auth.uid()) and enabled);
revoke all on public.camera_studio_state from service_role;
grant select,insert,update on public.camera_studio_state to authenticated;
create policy camera_admin_read on public.camera_studio_state for select to authenticated
 using (exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy camera_admin_insert on public.camera_studio_state for insert to authenticated
 with check (exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy camera_admin_update on public.camera_studio_state for update to authenticated
 using (exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled))
 with check (exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled));
commit;
