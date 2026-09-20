-- D4 structured Inbox editing. D5 will introduce state transitions and invariants.
alter table public.issues
  add column steps text not null default '',
  add column expected text not null default '',
  add column actual text not null default '',
  add column environment text not null default '',
  add column reproduction text not null default 'unknown',
  add column reproduction_note text not null default '',
  add column severity text not null default 'unset',
  add column priority text not null default 'unset',
  add column assignee_id uuid,
  add column fix_note text not null default '',
  add column target_build text not null default '',
  add constraint issues_steps_check check (steps = private.trim_title(steps) and char_length(steps) <= 4000),
  add constraint issues_expected_check check (expected = private.trim_title(expected) and char_length(expected) <= 4000),
  add constraint issues_actual_check check (actual = private.trim_title(actual) and char_length(actual) <= 4000),
  add constraint issues_environment_check check (environment = private.trim_title(environment) and char_length(environment) <= 4000),
  add constraint issues_reproduction_check check (reproduction in ('unknown','reproduced','intermittent','not_reproduced')),
  add constraint issues_reproduction_note_check check (reproduction_note = private.trim_title(reproduction_note) and char_length(reproduction_note) <= 4000 and (reproduction <> 'intermittent' or reproduction_note <> '')),
  add constraint issues_severity_check check (severity in ('unset','S1','S2','S3','S4')),
  add constraint issues_priority_check check (priority in ('unset','P0','P1','P2','P3')),
  add constraint issues_assignee_fkey foreign key (workspace_id, assignee_id) references public.workspace_members(workspace_id, user_id),
  add constraint issues_fix_note_check check (fix_note = private.trim_title(fix_note) and char_length(fix_note) <= 4000),
  add constraint issues_target_build_check check (target_build = private.trim_title(target_build) and char_length(target_build) <= 120);

alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check
  check (event_type in ('issue_created','issue_title_updated','issue_updated'));

create or replace function private.apply_issue_command(
  p_operation text, p_workspace_id uuid, p_issue_id uuid, p_expected_version integer,
  p_request_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_hash bytea;
  v_receipt private.command_receipts%rowtype;
  v_issue public.issues%rowtype;
  v_next public.issues%rowtype;
  v_before jsonb;
  v_fields jsonb;
  v_field text;
  v_value text;
  v_result jsonb;
  v_allowed constant text[] := array['title','steps','expected','actual','environment','reproduction','reproduction_note','severity','priority','assignee_id','fix_note','target_build'];
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','로그인이 필요합니다.');
  end if;
  if p_workspace_id is null or p_request_id is null then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','팀과 요청 식별자가 필요합니다.');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_actor::text || '/' || p_workspace_id::text || '/' || p_request_id::text, 0));
  select m.role into v_role from public.workspace_members m
    where m.workspace_id=p_workspace_id and m.user_id=v_actor for share;
  if v_role is null or v_role not in ('owner','member') then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','이 팀의 이슈를 변경할 권한이 없습니다.');
  end if;
  if p_operation is null or p_operation not in ('create','update') or p_payload is null
    or jsonb_typeof(p_payload)<>'object' then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','허용되지 않은 명령입니다.');
  end if;
  if p_payload='{}'::jsonb or exists (select 1 from jsonb_object_keys(p_payload) k where not (k=any(v_allowed)))
    or (p_operation='create' and not (p_payload ? 'title')) then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','허용된 이슈 필드를 입력하세요. 생성에는 제목이 필요합니다.');
  end if;
  if p_operation='update' and (p_issue_id is null or p_expected_version is null or p_expected_version<1) then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','이슈와 기준 버전이 필요합니다.');
  end if;
  -- Keep the D2 hash format: old title-only commands remain replayable.
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
    'operation',p_operation,'issueId',p_issue_id,'expectedVersion',p_expected_version,'payload',p_payload)::text,'UTF8'));
  select r.* into v_receipt from private.command_receipts r
    where r.actor_id=v_actor and r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_receipt.payload_hash<>v_hash then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','같은 요청 식별자로 다른 내용을 저장할 수 없습니다.');
    end if;
    return v_receipt.result;
  end if;
  if p_operation='create' then
    perform 1 from public.workspaces w where w.id=p_workspace_id for update;
    if (select count(*) from public.issues i where i.workspace_id=p_workspace_id)>=500 then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','현재 팀은 최대 500개 이슈를 지원합니다.');
    end if;
    v_fields := jsonb_build_object('title','','steps','','expected','','actual','','environment','',
      'reproduction','unknown','reproduction_note','','severity','unset','priority','unset',
      'assignee_id',null,'fix_note','','target_build','');
  else
    select i.* into v_issue from public.issues i where i.workspace_id=p_workspace_id and i.id=p_issue_id for update;
    if not found then
      return jsonb_build_object('ok',false,'code','NOT_FOUND','message','이슈를 찾을 수 없습니다.');
    end if;
    if v_issue.version<>p_expected_version then
      return jsonb_build_object('ok',false,'code','CONFLICT','message','다른 변경이 먼저 저장됐습니다. 최신 내용을 확인하세요.');
    end if;
    if v_issue.status<>'inbox' then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','현재는 Inbox 편집만 지원합니다.');
    end if;
    select jsonb_object_agg(k,v) into v_before from jsonb_each(to_jsonb(v_issue)) e(k,v) where k=any(v_allowed);
    v_fields := v_before;
  end if;
  for v_field in select jsonb_object_keys(p_payload) loop
    if v_field='assignee_id' and p_payload->v_field='null'::jsonb then
      v_fields := jsonb_set(v_fields,array[v_field],'null'::jsonb);
      continue;
    end if;
    if jsonb_typeof(p_payload->v_field)<>'string' then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','필드 형식이 올바르지 않습니다.');
    end if;
    v_value := private.trim_title(p_payload->>v_field);
    if v_field='assignee_id' then
      if v_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return jsonb_build_object('ok',false,'code','VALIDATION','message','담당자 식별자가 올바르지 않습니다.');
      end if;
    elsif char_length(v_value)>(case when v_field in ('title','target_build') then 120 else 4000 end) then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','필드의 최대 길이를 초과했습니다.');
    end if;
    v_fields := jsonb_set(v_fields,array[v_field],to_jsonb(v_value));
  end loop;
  select * into v_next from jsonb_populate_record(null::public.issues,v_fields);
  if v_next.title='' or v_next.reproduction not in ('unknown','reproduced','intermittent','not_reproduced')
    or v_next.severity not in ('unset','S1','S2','S3','S4') or v_next.priority not in ('unset','P0','P1','P2','P3')
    or (v_next.reproduction='intermittent' and v_next.reproduction_note='') then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','제목·분류·재현 상태를 확인하세요. 간헐적 재현은 발생 조건이 필요합니다.');
  end if;
  -- A demoted existing assignee remains visible for reassignment; new assignments require a writer.
  if v_next.assignee_id is not null and (p_operation='create' or v_next.assignee_id is distinct from v_issue.assignee_id) then
    select m.role into v_role from public.workspace_members m
      where m.workspace_id=p_workspace_id and m.user_id=v_next.assignee_id for share;
    if v_role is null or v_role not in ('owner','member') then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','담당자는 같은 팀의 Owner 또는 Member여야 합니다.');
    end if;
  end if;
  if p_operation='create' then
    insert into public.issues (workspace_id,title,steps,expected,actual,environment,reproduction,reproduction_note,
      severity,priority,assignee_id,fix_note,target_build,created_by,updated_by)
    values (p_workspace_id,v_next.title,v_next.steps,v_next.expected,v_next.actual,v_next.environment,
      v_next.reproduction,v_next.reproduction_note,v_next.severity,v_next.priority,v_next.assignee_id,
      v_next.fix_note,v_next.target_build,v_actor,v_actor) returning * into v_issue;
  else
    update public.issues set title=v_next.title,steps=v_next.steps,expected=v_next.expected,actual=v_next.actual,
      environment=v_next.environment,reproduction=v_next.reproduction,reproduction_note=v_next.reproduction_note,
      severity=v_next.severity,priority=v_next.priority,assignee_id=v_next.assignee_id,fix_note=v_next.fix_note,
      target_build=v_next.target_build,version=version+1,updated_by=v_actor,updated_at=clock_timestamp()
      where id=p_issue_id and workspace_id=p_workspace_id returning * into v_issue;
  end if;
  select jsonb_object_agg(k,v) into v_fields from jsonb_each(to_jsonb(v_issue)) e(k,v) where k=any(v_allowed);
  insert into public.activity_events (workspace_id,issue_id,actor_id,request_id,event_type,changes)
    values (p_workspace_id,v_issue.id,v_actor,p_request_id,
      case when p_operation='create' then 'issue_created' when p_payload=jsonb_build_object('title',p_payload->'title') then 'issue_title_updated' else 'issue_updated' end,
      jsonb_build_object('old_title',v_before->'title','new_title',v_issue.title,'old_fields',v_before,'new_fields',v_fields,
        'version_before',case when p_operation='create' then null else p_expected_version end,'version_after',v_issue.version));
  v_result := jsonb_build_object('ok',true,'data',to_jsonb(v_issue),'requestId',p_request_id);
  insert into private.command_receipts (actor_id,workspace_id,request_id,payload_hash,result)
    values (v_actor,p_workspace_id,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;
-- CREATE OR REPLACE preserves grants, restate the boundary for migration review.
revoke all on function private.apply_issue_command(text,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
revoke insert,update,delete on public.issues from public,anon,authenticated,service_role;
