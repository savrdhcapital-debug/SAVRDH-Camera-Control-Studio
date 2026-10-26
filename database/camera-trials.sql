begin;
create table public.camera_trial_requests (
 id uuid primary key,
 email text not null unique check (email=lower(email) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 customer_name text not null check(length(customer_name) between 2 and 120),
 phone text not null check(length(phone) between 8 and 18),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
create table public.camera_entitlements (
 user_id uuid primary key references auth.users(id) on delete cascade,
 trial_request_id uuid not null unique references public.camera_trial_requests(id),
 status text not null check(status in ('trial','active','suspended')),
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at>starts_at),
 approved_by uuid not null references auth.users(id)
);
alter table public.camera_trial_requests enable row level security;
alter table public.camera_entitlements enable row level security;
revoke all on public.camera_trial_requests,public.camera_entitlements from public,anon,authenticated;
grant insert(id,email,customer_name,phone) on public.camera_trial_requests to anon,authenticated;
grant select on public.camera_trial_requests,public.camera_entitlements to authenticated;
create policy camera_public_trial_request on public.camera_trial_requests for insert to anon,authenticated with check(status='pending' and reviewed_at is null and reviewed_by is null);
create policy camera_trial_admin_read on public.camera_trial_requests for select to authenticated using(exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy camera_entitlement_read on public.camera_entitlements for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.camera_studio_admins a where a.user_id=(select auth.uid()) and a.enabled));
create schema if not exists camera_private;
revoke all on schema camera_private from public,anon,authenticated;
create function public.camera_review_trial(p_request_id uuid,p_decision text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare r public.camera_trial_requests; u uuid; started timestamptz:=now();
begin
 if auth.uid() is null or not exists(select 1 from public.camera_studio_admins where user_id=auth.uid() and enabled) then raise exception 'Camera administrator required' using errcode='42501'; end if;
 select * into r from public.camera_trial_requests where id=p_request_id for update;
 if r.id is null then raise exception 'Trial request not found'; end if;
 if r.status<>'pending' then raise exception 'This request was already reviewed'; end if;
 if p_decision='reject' then
  update public.camera_trial_requests set status='rejected',reviewed_at=started,reviewed_by=auth.uid() where id=r.id;
  return jsonb_build_object('status','rejected');
 end if;
 if p_decision<>'approve' then raise exception 'Choose approve or reject'; end if;
 select id into u from auth.users where lower(email)=r.email and email_confirmed_at is not null;
 if u is null then raise exception 'Customer must create and confirm their Camera Studio account before approval'; end if;
 if exists(select 1 from public.camera_entitlements where user_id=u) then raise exception 'This account already received access; another trial cannot be started'; end if;
 insert into public.camera_entitlements(user_id,trial_request_id,status,starts_at,ends_at,approved_by) values(u,r.id,'trial',started,started+interval '15 days',auth.uid());
 update public.camera_trial_requests set status='approved',reviewed_at=started,reviewed_by=auth.uid() where id=r.id;
 return jsonb_build_object('status','approved','starts_at',started,'ends_at',started+interval '15 days');
end; $$;
revoke all on function public.camera_review_trial(uuid,text) from public,anon,authenticated;
grant execute on function public.camera_review_trial(uuid,text) to authenticated;
commit;
