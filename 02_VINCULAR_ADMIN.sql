-- 1. Antes, crie sua conta em Authentication → Users → Add user → Create new user.
-- 2. Substitua SEU_EMAIL_AQUI pelo e-mail exato dessa conta, mantendo as aspas.
-- 3. Execute este arquivo inteiro no SQL Editor.
do $$
declare
  v_email text := 'SEU_EMAIL_AQUI';
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email)=lower(trim(v_email));
  if v_user is null then
    raise exception 'E-mail não encontrado. Crie a conta em Authentication → Users e substitua SEU_EMAIL_AQUI neste script.';
  end if;
  insert into public.inspec_members(workspace_id,user_id,name,email,role,active)
  values('4b853e1f-019a-4467-949b-924d4414cbaf',v_user,'Administrador',trim(v_email),'admin',true)
  on conflict(workspace_id,user_id) do update set role='admin',active=true;
end $$;
