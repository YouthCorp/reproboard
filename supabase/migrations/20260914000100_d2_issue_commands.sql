-- D2: only Inbox creation/title editing. Later states need their own DB rules.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

-- Match ECMAScript String.trim; length is Unicode code points (not UTF-16 units).
create function private.trim_title(value text) returns text
language sql immutable strict set search_path = '' as $$
  select pg_catalog.btrim(value, E' \t\n\r\f\v' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create unique index workspace_one_owner_idx on public.workspace_members(workspace_id) where role = 'owner';

create sequence private.issue_key_seq;
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  issue_key text not null unique default ('RB-' || nextval('private.issue_key_seq'::regclass)),
  title text not null check (title = private.trim_title(title) and char_length(title) between 1 and 120),
  status text not null default 'inbox' check (status = 'inbox'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index issues_workspace_updated_idx on public.issues(workspace_id, updated_at desc, id);

create table private.command_receipts (
  actor_id uuid not null references auth.users(id),
  workspace_id uuid not null references public.workspaces(id),
  request_id uuid not null,
  payload_hash bytea not null,
  result jsonb not null check (result->>'ok' = 'true'),
  created_at timestamptz not null default now(),
  primary key (actor_id, workspace_id, request_id)
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  issue_id uuid not null,
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  event_type text not null check (event_type in ('issue_created', 'issue_title_updated')),
  changes jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, issue_id) references public.issues(workspace_id, id),
  foreign key (actor_id, workspace_id, request_id)
    references private.command_receipts(actor_id, workspace_id, request_id) deferrable initially deferred,
  unique (actor_id, workspace_id, request_id)
);
create index activity_events_issue_idx on public.activity_events(workspace_id, issue_id, created_at);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.issues enable row level security;
alter table public.activity_events enable row level security;
alter table private.command_receipts enable row level security;

-- Only current auth.uid(), never a caller-supplied user id. Avoid membership RLS recursion.
create function private.is_workspace_member(p_workspace_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;
create policy workspace_read on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
create policy membership_read on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy issue_read on public.issues for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy activity_read on public.activity_events for select to authenticated
  using (private.is_workspace_member(workspace_id));

revoke all on public.workspaces, public.workspace_members, public.issues, public.activity_events
  from public, anon, authenticated, service_role;
revoke all on private.command_receipts, private.issue_key_seq from public, anon, authenticated, service_role;
grant select on public.workspaces, public.workspace_members, public.issues, public.activity_events to authenticated;
revoke all on function private.trim_title(text) from public, anon, authenticated, service_role;
revoke all on function private.is_workspace_member(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated;

-- A single transaction: authorization -> request lock -> receipt -> version lock ->
-- issue + activity + receipt. No receipt survives a rejected/rolled-back command.
create function private.apply_issue_command(
  p_operation text, p_workspace_id uuid, p_issue_id uuid, p_expected_version integer,
  p_request_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_title text;
  v_hash bytea;
  v_receipt private.command_receipts%rowtype;
  v_issue public.issues%rowtype;
  v_previous_title text;
  v_result jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '로그인이 필요합니다.');
  end if;
  if p_workspace_id is null or p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '팀과 요청 식별자가 필요합니다.');
  end if;
  -- A transaction-scoped lock also serializes concurrent *first* submissions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_actor::text || '/' || p_workspace_id::text || '/' || p_request_id::text, 0));
  select m.role into v_role from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = v_actor for share;
  if v_role is null or v_role not in ('owner', 'member') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '이 팀의 이슈를 변경할 권한이 없습니다.');
  end if;
  if p_operation not in ('create', 'update') or p_operation is null
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '허용되지 않은 명령입니다.');
  end if;
  if (select count(*) from jsonb_object_keys(p_payload)) <> 1
    or not (p_payload ? 'title') or jsonb_typeof(p_payload->'title') <> 'string' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '제목 필드만 변경할 수 있습니다.');
  end if;
  v_title := private.trim_title(p_payload->>'title');
  if char_length(v_title) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '제목은 공백 제거 후 1~120자여야 합니다.');
  end if;
  if p_operation = 'update' and (p_issue_id is null or p_expected_version is null or p_expected_version < 1) then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '이슈와 기준 버전이 필요합니다.');
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
    'operation', p_operation, 'issueId', p_issue_id, 'expectedVersion', p_expected_version,
    'payload', p_payload)::text, 'UTF8'));
  select r.* into v_receipt from private.command_receipts r
    where r.actor_id = v_actor and r.workspace_id = p_workspace_id and r.request_id = p_request_id;
  if found then
    if v_receipt.payload_hash <> v_hash then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '같은 요청 식별자로 다른 내용을 저장할 수 없습니다.');
    end if;
    return v_receipt.result;
  end if;

  if p_operation = 'create' then
    -- Serialize capacity checks within a workspace; never silently truncate at 500.
    perform 1 from public.workspaces w where w.id = p_workspace_id for update;
    if (select count(*) from public.issues i where i.workspace_id = p_workspace_id) >= 500 then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '현재 팀은 최대 500개 이슈를 지원합니다.');
    end if;
    insert into public.issues (workspace_id, title, created_by, updated_by)
      values (p_workspace_id, v_title, v_actor, v_actor) returning * into v_issue;
  else
    select i.* into v_issue from public.issues i
      where i.workspace_id = p_workspace_id and i.id = p_issue_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', '이슈를 찾을 수 없습니다.');
    end if;
    if v_issue.version <> p_expected_version then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT', 'message', '다른 변경이 먼저 저장됐습니다. 최신 내용을 확인하세요.');
    end if;
    if v_issue.status <> 'inbox' then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '현재는 Inbox 제목 수정만 지원합니다.');
    end if;
    v_previous_title := v_issue.title;
    update public.issues set title = v_title, version = version + 1,
      updated_by = v_actor, updated_at = clock_timestamp()
      where id = v_issue.id and workspace_id = p_workspace_id returning * into v_issue;
  end if;

  insert into public.activity_events (workspace_id, issue_id, actor_id, request_id, event_type, changes)
    values (p_workspace_id, v_issue.id, v_actor, p_request_id,
      case when p_operation = 'create' then 'issue_created' else 'issue_title_updated' end,
      jsonb_build_object('old_title', v_previous_title, 'new_title', v_issue.title,
        'version_before', case when p_operation = 'create' then null else p_expected_version end,
        'version_after', v_issue.version));
  v_result := jsonb_build_object('ok', true, 'data', to_jsonb(v_issue), 'requestId', p_request_id);
  insert into private.command_receipts (actor_id, workspace_id, request_id, payload_hash, result)
    values (v_actor, p_workspace_id, p_request_id, v_hash, v_result);
  return v_result;
end;
$$;
revoke all on function private.apply_issue_command(text, uuid, uuid, integer, uuid, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_issue(p_workspace_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_issue_command('create', p_workspace_id, null, null, p_request_id, p_payload);
$$;
create function public.update_issue(
  p_workspace_id uuid, p_issue_id uuid, p_expected_version integer, p_request_id uuid, p_payload jsonb
) returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_issue_command('update', p_workspace_id, p_issue_id, p_expected_version, p_request_id, p_payload);
$$;
revoke all on function public.create_issue(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.update_issue(uuid, uuid, integer, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_issue(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_issue(uuid, uuid, integer, uuid, jsonb) to authenticated;
