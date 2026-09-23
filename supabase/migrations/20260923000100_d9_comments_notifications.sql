-- Append-only comments; issue body/version is deliberately untouched.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  issue_id uuid not null,
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  body text not null check (body = private.trim_title(body) and char_length(body) between 1 and 4000),
  mention_ids uuid[] not null default '{}' check (cardinality(mention_ids) <= 8),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (actor_id, workspace_id, request_id),
  foreign key (workspace_id, issue_id) references public.issues(workspace_id, id),
  foreign key (actor_id, workspace_id, request_id) references private.command_receipts(actor_id, workspace_id, request_id) deferrable initially deferred
);
create index comments_issue_idx on public.comments(workspace_id, issue_id, created_at, id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  comment_id uuid not null,
  recipient_id uuid not null references auth.users(id),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, comment_id),
  foreign key (workspace_id, comment_id) references public.comments(workspace_id, id)
);
create index notifications_recipient_idx on public.notifications(recipient_id, workspace_id, created_at desc, id);
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
create policy comment_read on public.comments for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy notification_read on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and private.is_workspace_member(workspace_id));
revoke all on public.comments, public.notifications from public, anon, authenticated, service_role;
grant select on public.comments, public.notifications to authenticated;

alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check
  check (event_type in ('issue_created','issue_title_updated','issue_updated','issue_status_changed','comment_added'));

create function public.add_comment(p_workspace_id uuid, p_issue_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_hash bytea;
  v_receipt private.command_receipts%rowtype;
  v_comment public.comments%rowtype;
  v_body text;
  v_mentions uuid[];
  v_member uuid;
  v_result jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','로그인이 필요합니다.');
  end if;
  if p_workspace_id is null or p_issue_id is null or p_request_id is null then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','팀·이슈·요청 식별자가 필요합니다.');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||'/'||p_workspace_id::text||'/'||p_request_id::text,0));
  select m.role into v_role from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_actor for share;
  if v_role is null or v_role not in ('owner','member') then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','댓글 작성 권한이 없습니다.');
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','댓글 형식을 확인하세요.');
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('body','mention_ids'))
    or jsonb_typeof(p_payload->'body') is distinct from 'string'
    or jsonb_typeof(p_payload->'mention_ids') is distinct from 'array' then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','댓글과 멘션 목록을 입력하세요.');
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('operation','add_comment','issueId',p_issue_id,'payload',p_payload)::text,'UTF8'));
  select r.* into v_receipt from private.command_receipts r where r.actor_id=v_actor and r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_receipt.payload_hash<>v_hash then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','같은 요청 식별자로 다른 내용을 저장할 수 없습니다.');
    end if;
    return v_receipt.result;
  end if;
  v_body := private.trim_title(p_payload->>'body');
  if char_length(v_body) not between 1 and 4000 then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','댓글은 공백 제거 후 1~4,000자입니다.');
  end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'mention_ids') e where jsonb_typeof(e)<>'string'
    or (e#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','멘션 사용자 식별자를 확인하세요.');
  end if;
  select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}'::uuid[]) into v_mentions from jsonb_array_elements_text(p_payload->'mention_ids');
  if cardinality(v_mentions)>8 then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','멘션은 최대 8명입니다.');
  end if;
  -- Lock the membership rows until commit so a concurrent removal cannot bypass validation.
  foreach v_member in array v_mentions loop
    perform 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_member for share;
    if not found then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','멘션은 같은 팀의 멤버만 선택할 수 있습니다.');
    end if;
  end loop;
  perform 1 from public.issues i where i.workspace_id=p_workspace_id and i.id=p_issue_id;
  if not found then
    return jsonb_build_object('ok',false,'code','NOT_FOUND','message','이슈를 찾을 수 없습니다.');
  end if;
  insert into public.comments(workspace_id,issue_id,actor_id,request_id,body,mention_ids)
    values(p_workspace_id,p_issue_id,v_actor,p_request_id,v_body,v_mentions) returning * into v_comment;
  insert into public.activity_events(workspace_id,issue_id,actor_id,request_id,event_type,changes)
    values(p_workspace_id,p_issue_id,v_actor,p_request_id,'comment_added',jsonb_build_object('comment_id',v_comment.id));
  insert into public.notifications(workspace_id,comment_id,recipient_id)
    select p_workspace_id,v_comment.id,u from unnest(v_mentions) u where u<>v_actor;
  v_result := jsonb_build_object('ok',true,'data',to_jsonb(v_comment));
  insert into private.command_receipts(actor_id,workspace_id,request_id,payload_hash,result)
    values(v_actor,p_workspace_id,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;

create function public.mark_notification_read(p_workspace_id uuid, p_notification_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_hash bytea;
  v_receipt private.command_receipts%rowtype;
  v_notification public.notifications%rowtype;
  v_result jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','로그인이 필요합니다.');
  end if;
  if p_workspace_id is null or p_notification_id is null or p_request_id is null then
    return jsonb_build_object('ok',false,'code','VALIDATION','message','알림과 요청 식별자가 필요합니다.');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||'/'||p_workspace_id::text||'/'||p_request_id::text,0));
  perform 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=v_actor for share;
  if not found then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','팀 접근 권한이 없습니다.');
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('operation','mark_notification_read','notificationId',p_notification_id)::text,'UTF8'));
  select r.* into v_receipt from private.command_receipts r where r.actor_id=v_actor and r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_receipt.payload_hash<>v_hash then
      return jsonb_build_object('ok',false,'code','VALIDATION','message','같은 요청 식별자로 다른 내용을 저장할 수 없습니다.');
    end if;
    return v_receipt.result;
  end if;
  select n.* into v_notification from public.notifications n where n.workspace_id=p_workspace_id and n.id=p_notification_id and n.recipient_id=v_actor for update;
  if not found then
    return jsonb_build_object('ok',false,'code','NOT_FOUND','message','알림을 찾을 수 없습니다.');
  end if;
  update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=v_notification.id returning * into v_notification;
  v_result := jsonb_build_object('ok',true,'data',to_jsonb(v_notification));
  insert into private.command_receipts(actor_id,workspace_id,request_id,payload_hash,result) values(v_actor,p_workspace_id,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;
revoke all on function public.add_comment(uuid,uuid,uuid,jsonb), public.mark_notification_read(uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.add_comment(uuid,uuid,uuid,jsonb), public.mark_notification_read(uuid,uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.comments, public.activity_events, public.notifications;
