-- Execute todo este arquivo no SQL Editor do projeto Supabase.
-- Não apaga tabelas ou registros existentes. Estrutura exclusiva da versão cloud.
begin;
create schema if not exists inspec_private;
revoke all on schema inspec_private from public,anon;
grant usage on schema inspec_private to authenticated;
create table if not exists public.inspec_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
create table if not exists public.inspec_members (
  workspace_id uuid not null references public.inspec_workspaces(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 150),
  email text not null,
  role text not null check (role in ('admin','editor','viewer')),
  active boolean not null default true,
  primary key (workspace_id,user_id)
);
create index if not exists inspec_members_user_idx on public.inspec_members(user_id);
create table if not exists public.inspec_records (
  workspace_id uuid not null references public.inspec_workspaces(id),
  kind text not null check (kind in ('condos','inspections','areas','items','findings','photos','settings')),
  id text not null check (length(id) between 1 and 200 and id ~ '^[a-zA-Z0-9_-]+$'),
  payload jsonb not null check (jsonb_typeof(payload)='object' and payload ? 'id' and payload->>'id'=id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id,kind,id)
);
create or replace function inspec_private.inspec_role(p_workspace uuid)
returns text language sql stable security definer set search_path=''
as $$
  select m.role from public.inspec_members m
  where m.workspace_id=p_workspace and m.user_id=auth.uid() and m.active;
$$;
revoke all on function inspec_private.inspec_role(uuid) from public, anon;
grant execute on function inspec_private.inspec_role(uuid) to authenticated;

create or replace function inspec_private.inspec_touch_record()
returns trigger language plpgsql set search_path=''
as $$ begin new.updated_at=clock_timestamp();return new;end; $$;
drop trigger if exists inspec_record_updated on public.inspec_records;
create trigger inspec_record_updated before update on public.inspec_records
for each row execute function inspec_private.inspec_touch_record();

alter table public.inspec_workspaces enable row level security;
alter table public.inspec_members enable row level security;
alter table public.inspec_records enable row level security;
revoke all on public.inspec_workspaces,public.inspec_members,public.inspec_records from anon,authenticated;
grant select on public.inspec_workspaces,public.inspec_members to authenticated;
grant select,insert,update,delete on public.inspec_records to authenticated;

drop policy if exists inspec_workspace_read on public.inspec_workspaces;
create policy inspec_workspace_read on public.inspec_workspaces for select to authenticated
using (inspec_private.inspec_role(id) is not null);
drop policy if exists inspec_member_read on public.inspec_members;
create policy inspec_member_read on public.inspec_members for select to authenticated
using (inspec_private.inspec_role(workspace_id) is not null);
drop policy if exists inspec_record_read on public.inspec_records;
create policy inspec_record_read on public.inspec_records for select to authenticated
using (inspec_private.inspec_role(workspace_id) is not null);
drop policy if exists inspec_record_insert on public.inspec_records;
create policy inspec_record_insert on public.inspec_records for insert to authenticated
with check (inspec_private.inspec_role(workspace_id) in ('admin','editor')
and (kind<>'settings' or inspec_private.inspec_role(workspace_id)='admin'));
drop policy if exists inspec_record_update on public.inspec_records;
create policy inspec_record_update on public.inspec_records for update to authenticated
using (inspec_private.inspec_role(workspace_id) in ('admin','editor')
and (kind<>'settings' or inspec_private.inspec_role(workspace_id)='admin'))
with check (inspec_private.inspec_role(workspace_id) in ('admin','editor')
and (kind<>'settings' or inspec_private.inspec_role(workspace_id)='admin'));
drop policy if exists inspec_record_delete on public.inspec_records;
create policy inspec_record_delete on public.inspec_records for delete to authenticated
using (inspec_private.inspec_role(workspace_id) in ('admin','editor')
and (kind<>'settings' or inspec_private.inspec_role(workspace_id)='admin'));

-- Vincular contas existentes e alterar perfis: somente administradores da organização.
-- Nunca usa user_metadata informado pelo próprio usuário para conceder privilégios.
create or replace function inspec_private.inspec_set_member(
  p_workspace uuid, p_user uuid, p_name text, p_role text, p_active boolean
) returns void language plpgsql security definer set search_path=''
as $$
declare v_email text;
begin
  if inspec_private.inspec_role(p_workspace) is distinct from 'admin' then
    raise exception 'Somente administrador';
  end if;
  -- Serializa mudanças nos perfis da organização.
  perform 1 from public.inspec_workspaces where id=p_workspace for update;
  if p_user=auth.uid() and (p_role is distinct from 'admin' or p_active is distinct from true) then
    raise exception 'Não remova seu próprio acesso administrador';
  end if;
  if p_role is null or p_role not in ('admin','editor','viewer') or p_active is null then
    raise exception 'Perfil inválido';
  end if;
  select email into v_email from auth.users where id=p_user;
  if v_email is null then raise exception 'User UID não encontrado em Authentication → Users';end if;
  insert into public.inspec_members(workspace_id,user_id,name,email,role,active)
  values(p_workspace,p_user,trim(p_name),v_email,p_role,p_active)
  on conflict (workspace_id,user_id) do update
  set name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
end;
$$;
revoke all on function inspec_private.inspec_set_member(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function inspec_private.inspec_set_member(uuid,uuid,text,text,boolean) to authenticated;

-- Endpoint público mínimo: autorização e mutação ficam na função interna.
create or replace function public.inspec_set_member(
  p_workspace uuid, p_user uuid, p_name text, p_role text, p_active boolean
) returns void language sql security invoker set search_path=''
as $$
  select inspec_private.inspec_set_member(p_workspace,p_user,p_name,p_role,p_active);
$$;
revoke all on function public.inspec_set_member(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.inspec_set_member(uuid,uuid,text,text,boolean) to authenticated;

-- Organização inicial; UUID utilizado apenas para identificação, não é segredo.
insert into public.inspec_workspaces(id,name)
values('4b853e1f-019a-4467-949b-924d4414cbaf','Eng Inspec360')
on conflict (id) do nothing;

-- Cria o bucket caso ele ainda não exista e mantém acesso privado.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('inspec360-arquivos','inspec360-arquivos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,
allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- O caminho dos arquivos começa com o UUID da organização.
-- Comparação textual evita lançar erro ao receber caminhos inválidos.
create or replace function inspec_private.inspec_storage_role(p_path text)
returns text language sql stable security definer set search_path=''
as $$
  select m.role from public.inspec_members m where m.user_id=auth.uid()
  and m.active and m.workspace_id::text=split_part(p_path,'/',1);
$$;
revoke all on function inspec_private.inspec_storage_role(text) from public,anon;
grant execute on function inspec_private.inspec_storage_role(text) to authenticated;
drop policy if exists inspec_file_read on storage.objects;
create policy inspec_file_read on storage.objects for select to authenticated
using(bucket_id='inspec360-arquivos' and inspec_private.inspec_storage_role(name) is not null);
drop policy if exists inspec_file_insert on storage.objects;
create policy inspec_file_insert on storage.objects for insert to authenticated
with check(bucket_id='inspec360-arquivos' and inspec_private.inspec_storage_role(name) in ('admin','editor'));
drop policy if exists inspec_file_delete on storage.objects;
create policy inspec_file_delete on storage.objects for delete to authenticated
using(bucket_id='inspec360-arquivos' and inspec_private.inspec_storage_role(name) in ('admin','editor'));
commit;
