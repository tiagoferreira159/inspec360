-- Reordenação atômica, com RLS e controle de alterações simultâneas.
create or replace function public.inspec_reorder_areas(
  p_workspace uuid, p_inspection text, p_ids text[], p_versions timestamptz[]
) returns void language plpgsql security invoker set search_path=''
as $$
declare v_count integer;
begin
  if inspec_private.inspec_role(p_workspace) not in ('admin','editor')
     or inspec_private.inspec_role(p_workspace) is null then
    raise exception 'Sem permissão para organizar áreas';
  end if;
  if p_ids is null or p_versions is null or cardinality(p_ids)<>cardinality(p_versions)
    or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Lista de áreas inválida';
  end if;
  -- Serializa as áreas existentes em ordem estável.
  perform 1 from public.inspec_records r
   where r.workspace_id=p_workspace and r.kind='areas' and r.payload->>'inspectionId'=p_inspection
   order by r.id for update;
  select count(*) into v_count from public.inspec_records r
   where r.workspace_id=p_workspace and r.kind='areas' and r.payload->>'inspectionId'=p_inspection;
  if v_count<>cardinality(p_ids) then
    raise exception 'As áreas mudaram. Atualize os dados antes de organizar novamente';
  end if;
  if exists (
    select 1 from unnest(p_ids,p_versions) x(id,version)
    left join public.inspec_records r on r.workspace_id=p_workspace and r.kind='areas'
      and r.id=x.id and r.payload->>'inspectionId'=p_inspection
    where r.id is null or r.updated_at is distinct from x.version
  ) then raise exception 'As áreas foram alteradas por outra pessoa. Atualize os dados';end if;
  update public.inspec_records r
   set payload=jsonb_set(r.payload,'{order}',to_jsonb((x.position-1)::integer),true)
   from unnest(p_ids) with ordinality x(id,position)
   where r.workspace_id=p_workspace and r.kind='areas' and r.id=x.id
    and r.payload->>'inspectionId'=p_inspection;
end;
$$;
revoke all on function public.inspec_reorder_areas(uuid,text,text[],timestamptz[]) from public,anon;
grant execute on function public.inspec_reorder_areas(uuid,text,text[],timestamptz[]) to authenticated;
