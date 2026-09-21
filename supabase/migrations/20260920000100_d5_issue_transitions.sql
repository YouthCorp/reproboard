-- D5: status rules and immutable, version-bound verification history.
alter table public.issues drop constraint issues_status_check;
alter table public.issues add constraint issues_status_check check (status in ('inbox','ready','in_progress','verify','done'));
alter table public.issues add constraint issues_state_fields_check check (
  status='inbox' or (
    steps<>'' and expected<>'' and actual<>'' and environment<>''
    and reproduction in ('reproduced','intermittent') and severity<>'unset' and priority<>'unset'
    and (status='ready' or assignee_id is not null)
    and (status not in ('verify','done') or (fix_note<>'' and target_build<>''))
  )
);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check
  check (event_type in ('issue_created','issue_title_updated','issue_updated','issue_status_changed'));

create table public.verification_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  issue_id uuid not null,
  result text not null check (result in ('pass','fail')),
  tested_build text not null check (tested_build=private.trim_title(tested_build) and char_length(tested_build) between 1 and 120),
  tested_environment text not null check (tested_environment=private.trim_title(tested_environment) and char_length(tested_environment) between 1 and 4000),
  note text not null default '' check (note=private.trim_title(note) and char_length(note)<=4000 and (result='pass' or note<>'')),
  actor_id uuid not null references auth.users(id),
  issue_version_before integer not null check (issue_version_before>0),
  request_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (workspace_id,issue_id) references public.issues(workspace_id,id),
  foreign key (actor_id,workspace_id,request_id) references private.command_receipts(actor_id,workspace_id,request_id) deferrable initially deferred,
  unique (workspace_id,issue_id,issue_version_before),
  unique (actor_id,workspace_id,request_id)
);
create index verification_runs_issue_idx on public.verification_runs(workspace_id,issue_id,created_at,id);
alter table public.verification_runs enable row level security;
create policy verification_read on public.verification_runs for select to authenticated using (private.is_workspace_member(workspace_id));
revoke all on public.verification_runs from public,anon,authenticated,service_role;
grant select on public.verification_runs to authenticated;

-- Pure rule helper: the caller obtains and locks current assignee membership.
create function private.issue_state_errors(p_status text,p_fields jsonb,p_assignee_valid boolean) returns text[]
language plpgsql immutable set search_path='' as $$
declare v_errors text[] := array[]::text[]; v_key text;
begin
  if p_status='inbox' then return v_errors; end if;
  foreach v_key in array array['steps','expected','actual','environment'] loop
    if coalesce(private.trim_title(p_fields->>v_key),'')='' then v_errors:=array_append(v_errors,v_key); end if;
  end loop;
  if coalesce(p_fields->>'reproduction','') not in ('reproduced','intermittent') then v_errors:=array_append(v_errors,'reproduction'); end if;
  if p_fields->>'reproduction'='intermittent' and coalesce(private.trim_title(p_fields->>'reproduction_note'),'')='' then v_errors:=array_append(v_errors,'reproduction_note'); end if;
  if coalesce(p_fields->>'severity','') not in ('S1','S2','S3','S4') then v_errors:=array_append(v_errors,'severity'); end if;
  if coalesce(p_fields->>'priority','') not in ('P0','P1','P2','P3') then v_errors:=array_append(v_errors,'priority'); end if;
  if p_status in ('in_progress','verify','done') and not coalesce(p_assignee_valid,false) then v_errors:=array_append(v_errors,'assignee_id'); end if;
  if p_status in ('verify','done') then
    foreach v_key in array array['fix_note','target_build'] loop
      if coalesce(private.trim_title(p_fields->>v_key),'')='' then v_errors:=array_append(v_errors,v_key); end if;
    end loop;
  end if;
  return v_errors;
end;
$$;
revoke all on function private.issue_state_errors(text,jsonb,boolean) from public,anon,authenticated,service_role;

create function public.transition_issue(p_workspace_id uuid,p_issue_id uuid,p_expected_version integer,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid(); v_role text; v_hash bytea; v_receipt private.command_receipts%rowtype;
  v_issue public.issues%rowtype; v_from text; v_target text; v_reason text := ''; v_verification uuid;
  v_run_result text; v_build text; v_environment text; v_note text := ''; v_key text;
  v_assignee_valid boolean := false; v_missing text[]; v_result jsonb;
begin
  if v_actor is null then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','로그인이 필요합니다.'); end if;
  if p_workspace_id is null or p_request_id is null or p_issue_id is null or p_expected_version is null or p_expected_version<1 then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','팀·이슈·요청 식별자와 기준 버전이 필요합니다.');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||'/'||p_workspace_id::text||'/'||p_request_id::text,0));
  select m.role into v_role from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_actor for share;
  if v_role is null or v_role not in ('owner','member') then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','이 팀의 상태를 변경할 권한이 없습니다.'); end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then return jsonb_build_object('ok',false,'code','VALIDATION','message','전환 입력을 확인하세요.'); end if;
  if not (p_payload ? 'target_status') or jsonb_typeof(p_payload->'target_status')<>'string'
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('target_status','reason','verification')) then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','허용되지 않은 전환 필드입니다.');
  end if;
  v_hash:=pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('operation','transition','issueId',p_issue_id,'expectedVersion',p_expected_version,'payload',p_payload)::text,'UTF8'));
  select r.* into v_receipt from private.command_receipts r where r.actor_id=v_actor and r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_receipt.payload_hash<>v_hash then return jsonb_build_object('ok',false,'code','VALIDATION','message','같은 요청 식별자로 다른 내용을 저장할 수 없습니다.'); end if;
    return v_receipt.result;
  end if;
  select i.* into v_issue from public.issues i where i.workspace_id=p_workspace_id and i.id=p_issue_id for update;
  if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND','message','이슈를 찾을 수 없습니다.'); end if;
  if v_issue.version<>p_expected_version then return jsonb_build_object('ok',false,'code','CONFLICT','message','다른 변경이 먼저 저장됐습니다. 최신 내용을 확인하세요.'); end if;
  v_from:=v_issue.status; v_target:=private.trim_title(p_payload->>'target_status');
  if not ((v_from='inbox' and v_target='ready') or (v_from='ready' and v_target in ('inbox','in_progress'))
    or (v_from='in_progress' and v_target in ('ready','verify')) or (v_from='verify' and v_target in ('in_progress','done')) or (v_from='done' and v_target='inbox')) then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','허용되지 않은 상태 이동입니다.');
  end if;
  if (v_from='ready' and v_target='inbox') or (v_from='in_progress' and v_target='ready') or (v_from='done' and v_target='inbox') then
    if not (p_payload ? 'reason') or jsonb_typeof(p_payload->'reason')<>'string' then return jsonb_build_object('ok',false,'code','VALIDATION','message','이동 사유를 입력하세요.'); end if;
    v_reason:=private.trim_title(p_payload->>'reason');
    if char_length(v_reason) not between 1 and 4000 then return jsonb_build_object('ok',false,'code','VALIDATION','message','이동 사유는 1~4,000자입니다.'); end if;
  elsif p_payload ? 'reason' then return jsonb_build_object('ok',false,'code','VALIDATION','message','이 이동은 사유 필드를 받지 않습니다.');
  end if;
  if v_from='verify' then
    if not (p_payload ? 'verification') or jsonb_typeof(p_payload->'verification')<>'object' then return jsonb_build_object('ok',false,'code','VALIDATION','message','현재 이슈를 재검증하고 결과를 입력하세요.'); end if;
    if exists(select 1 from jsonb_object_keys(p_payload->'verification') k where k not in ('tested_build','tested_environment','note')) then return jsonb_build_object('ok',false,'code','VALIDATION','message','검증 행위자·결과·버전은 서버에서 결정합니다.'); end if;
    foreach v_key in array array['tested_build','tested_environment'] loop
      if not (p_payload->'verification' ? v_key) or jsonb_typeof(p_payload->'verification'->v_key)<>'string' then return jsonb_build_object('ok',false,'code','VALIDATION','message','검증한 앱 버전과 환경을 입력하세요.'); end if;
    end loop;
    if p_payload->'verification' ? 'note' and jsonb_typeof(p_payload->'verification'->'note')<>'string' then return jsonb_build_object('ok',false,'code','VALIDATION','message','검증 메모 형식이 올바르지 않습니다.'); end if;
    v_build:=private.trim_title(p_payload->'verification'->>'tested_build');
    v_environment:=private.trim_title(p_payload->'verification'->>'tested_environment');
    v_note:=private.trim_title(coalesce(p_payload->'verification'->>'note',''));
    v_run_result:=case when v_target='done' then 'pass' else 'fail' end;
    if char_length(v_build) not between 1 and 120 or char_length(v_environment) not between 1 and 4000 or char_length(v_note)>4000 or (v_run_result='fail' and v_note='') then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','검증 버전(1~120자)·환경(1~4,000자)·메모(최대 4,000자)를 확인하세요. 실패 이유는 필수입니다.');
    end if;
    if v_run_result='fail' then v_reason:=v_note; end if;
  elsif p_payload ? 'verification' then return jsonb_build_object('ok',false,'code','VALIDATION','message','Verify에서만 검증 결과를 기록할 수 있습니다.');
  end if;
  if v_issue.assignee_id is not null then
    select m.role into v_role from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_issue.assignee_id for share;
    v_assignee_valid:=coalesce(v_role in ('owner','member'),false);
  end if;
  v_missing:=private.issue_state_errors(v_target,to_jsonb(v_issue),v_assignee_valid);
  if cardinality(v_missing)>0 then return jsonb_build_object('ok',false,'code','VALIDATION','message','이동할 상태의 필수 정보를 먼저 저장하세요. 담당자가 Viewer라면 재지정이 필요합니다.','fields',to_jsonb(v_missing)); end if;
  if v_run_result is not null then
    insert into public.verification_runs(workspace_id,issue_id,result,tested_build,tested_environment,note,actor_id,issue_version_before,request_id)
      values(p_workspace_id,p_issue_id,v_run_result,v_build,v_environment,v_note,v_actor,p_expected_version,p_request_id) returning id into v_verification;
  end if;
  update public.issues set status=v_target,version=version+1,updated_by=v_actor,updated_at=clock_timestamp()
    where id=p_issue_id and workspace_id=p_workspace_id returning * into v_issue;
  insert into public.activity_events(workspace_id,issue_id,actor_id,request_id,event_type,changes)
    values(p_workspace_id,p_issue_id,v_actor,p_request_id,'issue_status_changed',jsonb_build_object('from_status',v_from,'to_status',v_target,'reason',v_reason,'verification_id',v_verification,'version_before',p_expected_version,'version_after',v_issue.version));
  v_result:=jsonb_build_object('ok',true,'data',to_jsonb(v_issue),'requestId',p_request_id);
  insert into private.command_receipts(actor_id,workspace_id,request_id,payload_hash,result) values(v_actor,p_workspace_id,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;
revoke all on function public.transition_issue(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.transition_issue(uuid,uuid,integer,uuid,jsonb) to authenticated;

-- D4 field editing now preserves the current state requirements.
create or replace function private.apply_issue_command(
  p_operation text, p_workspace_id uuid, p_issue_id uuid, p_expected_version integer,
  p_request_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_assignee_role text;
  v_missing text[];
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
    if v_issue.status='done' then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','Done 이슈는 재오픈 후 편집하세요.');
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
  if p_operation='update' then
    if v_next.assignee_id is not null then
      select m.role into v_assignee_role from public.workspace_members m
        where m.workspace_id=p_workspace_id and m.user_id=v_next.assignee_id for share;
    end if;
    v_missing:=private.issue_state_errors(v_issue.status,to_jsonb(v_next),coalesce(v_assignee_role in ('owner','member'),false));
    if cardinality(v_missing)>0 then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','현재 상태의 필수 정보를 지울 수 없습니다. 담당자를 재지정하거나 허용된 이전 상태로 이동하세요.','fields',to_jsonb(v_missing));
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
