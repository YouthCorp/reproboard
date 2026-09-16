-- D3: authenticated bootstrap, minimal profiles and single-use Member invitations.
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (char_length(display_name) between 1 and 80)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated, service_role;
grant select on public.profiles to authenticated;

create function private.profile_name(metadata jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(left(private.trim_title(coalesce(
    case when jsonb_typeof(metadata->'display_name') = 'string' then metadata->>'display_name' end,
    case when jsonb_typeof(metadata->'full_name') = 'string' then metadata->>'full_name' end,
    case when jsonb_typeof(metadata->'user_name') = 'string' then metadata->>'user_name' end,
    '팀원')), 80), ''), '팀원');
$$;
insert into public.profiles (user_id, display_name)
  select u.id, private.profile_name(u.raw_user_meta_data) from auth.users u;
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name) values (new.id, private.profile_name(new.raw_user_meta_data));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.create_profile();

-- No membership policy reads itself through RLS. Metadata never controls roles.
create function private.can_read_profile(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (p_user_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  ));
$$;
create policy profile_read on public.profiles for select to authenticated
  using (private.can_read_profile(user_id));

-- Future verification/comment commands must check these same capabilities.
-- D3 exposes no verification/comment write endpoint or table.
create function private.has_workspace_permission(p_workspace_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid()) and
    case p_action
      when 'read' then m.role in ('owner', 'member', 'viewer')
      when 'write' then m.role in ('owner', 'member')
      when 'verify' then m.role in ('owner', 'member')
      when 'comment' then m.role in ('owner', 'member')
      when 'invite' then m.role = 'owner'
      when 'manage_members' then m.role = 'owner'
      else false end);
$$;
create function public.workspace_permissions(p_workspace_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_object_agg(action, private.has_workspace_permission(p_workspace_id, action))
    from unnest(array['read', 'write', 'verify', 'comment', 'invite', 'manage_members']) as action;
$$;
create function public.list_workspace_members(p_workspace_id uuid)
returns table(user_id uuid, display_name text, role text)
language sql stable security invoker set search_path = '' as $$
  select m.user_id, p.display_name, m.role from public.workspace_members m
  join public.profiles p on p.user_id = m.user_id
  where m.workspace_id = p_workspace_id order by m.created_at, m.user_id;
$$;

create table private.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  role text not null default 'member' check (role = 'member'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  check (expires_at = created_at + interval '24 hours'),
  check ((accepted_by is null) = (accepted_at is null))
);
create index workspace_invites_workspace_idx on private.workspace_invites(workspace_id);
alter table private.workspace_invites enable row level security;
revoke all on private.workspace_invites from public, anon, authenticated, service_role;

create function private.apply_workspace_command(
  p_operation text, p_workspace_id uuid, p_request_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_workspace uuid := p_workspace_id;
  v_owner uuid;
  v_role text;
  v_target uuid;
  v_name text;
  v_hash bytea;
  v_token_hash bytea;
  v_invite private.workspace_invites%rowtype;
  v_receipt private.command_receipts%rowtype;
  v_result jsonb;
  v_now timestamptz;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '로그인이 필요합니다.');
  end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_operation is null or p_operation not in ('create_workspace', 'create_invite', 'accept_invite', 'change_member_role') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '올바른 요청이 필요합니다.');
  end if;
  if p_operation = 'create_workspace' then
    if not (p_payload ? 'name') or p_payload - 'name' <> '{}'::jsonb or jsonb_typeof(p_payload->'name') <> 'string' then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '팀 이름만 지정할 수 있습니다.');
    end if;
    v_name := private.trim_title(p_payload->>'name');
    if char_length(v_name) not between 1 and 80 then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '팀 이름은 1~80자여야 합니다.');
    end if;
  elsif p_operation in ('create_invite', 'accept_invite') then
    if not (p_payload ? 'token') or p_payload - 'token' <> '{}'::jsonb or jsonb_typeof(p_payload->'token') <> 'string'
      or (p_payload->>'token') !~ '^[0-9a-f]{64}$' then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '올바른 초대 링크가 필요합니다.');
    end if;
    -- The browser generates 32 random bytes; only this digest ever reaches storage.
    v_token_hash := pg_catalog.sha256(pg_catalog.convert_to(p_payload->>'token', 'UTF8'));
    if p_operation = 'accept_invite' then
      select i.workspace_id into v_workspace from private.workspace_invites i where i.token_hash = v_token_hash;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'INVITE_UNAVAILABLE', 'message', '만료되었거나 사용할 수 없는 초대입니다.');
      end if;
    end if;
  else
    if not (p_payload ?& array['userId', 'role', 'expectedRole']) or p_payload - array['userId', 'role', 'expectedRole'] <> '{}'::jsonb
      or coalesce(p_payload->>'userId', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or coalesce(p_payload->>'role', '') not in ('member', 'viewer')
      or coalesce(p_payload->>'expectedRole', '') not in ('member', 'viewer') then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', 'Member와 Viewer 사이에서만 변경할 수 있습니다.');
    end if;
    v_target := (p_payload->>'userId')::uuid;
  end if;
  if v_workspace is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '팀 식별자가 필요합니다.');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_actor::text || '/' || v_workspace::text || '/' || p_request_id::text, 0));
  if p_operation = 'create_workspace' then
    select w.owner_id into v_owner from public.workspaces w where w.id = v_workspace;
    if found and v_owner <> v_actor then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '이 요청을 처리할 권한이 없습니다.');
    end if;
  elsif p_operation <> 'accept_invite' then
    select m.role into v_role from public.workspace_members m
      where m.workspace_id = v_workspace and m.user_id = v_actor for share;
    if v_role is distinct from 'owner' then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Owner만 초대와 역할을 관리할 수 있습니다.');
    end if;
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('operation', p_operation, 'payload', p_payload)::text, 'UTF8'));
  select r.* into v_receipt from private.command_receipts r
    where r.actor_id = v_actor and r.workspace_id = v_workspace and r.request_id = p_request_id;
  if found then
    if not private.is_workspace_member(v_workspace) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '현재 팀 접근 권한이 없습니다.');
    end if;
    if v_receipt.payload_hash <> v_hash then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '같은 요청 식별자로 다른 내용을 저장할 수 없습니다.');
    end if;
    return v_receipt.result;
  end if;

  if p_operation = 'create_workspace' then
    insert into public.workspaces (id, name, owner_id) values (v_workspace, v_name, v_actor)
      on conflict (id) do nothing returning owner_id into v_owner;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '팀 생성 결과를 다시 조회하세요.');
    end if;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_workspace, v_actor, 'owner');
    v_result := jsonb_build_object('workspaceId', v_workspace);
  elsif p_operation = 'create_invite' then
    v_now := clock_timestamp();
    insert into private.workspace_invites (workspace_id, token_hash, created_by, created_at, expires_at)
      values (v_workspace, v_token_hash, v_actor, v_now, v_now + interval '24 hours')
      on conflict (token_hash) do nothing returning * into v_invite;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', '새 초대 링크를 생성하세요.');
    end if;
    v_result := jsonb_build_object('workspaceId', v_workspace, 'inviteId', v_invite.id, 'expiresAt', v_invite.expires_at);
  elsif p_operation = 'accept_invite' then
    select i.* into v_invite from private.workspace_invites i
      where i.workspace_id = v_workspace and i.token_hash = v_token_hash for update;
    -- Check time *after* waiting for the row lock, not at transaction start.
    if not found or v_invite.accepted_by is not null or v_invite.expires_at <= clock_timestamp() then
      return jsonb_build_object('ok', false, 'code', 'INVITE_UNAVAILABLE', 'message', '만료되었거나 사용할 수 없는 초대입니다.');
    end if;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_workspace, v_actor, 'member')
      on conflict (workspace_id, user_id) do nothing;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'ALREADY_MEMBER', 'message', '이미 참여한 팀입니다. 초대는 사용하지 않았습니다.');
    end if;
    update private.workspace_invites set accepted_by = v_actor, accepted_at = clock_timestamp() where id = v_invite.id;
    v_result := jsonb_build_object('workspaceId', v_workspace);
  else
    select m.role into v_role from public.workspace_members m
      where m.workspace_id = v_workspace and m.user_id = v_target for update;
    if not found or v_role = 'owner' or v_target = v_actor then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', '해당 멤버의 역할을 변경할 수 없습니다.');
    end if;
    if v_role <> p_payload->>'expectedRole' then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT', 'message', '역할이 변경됐습니다. 최신 멤버 목록을 확인하세요.');
    end if;
    update public.workspace_members set role = p_payload->>'role' where workspace_id = v_workspace and user_id = v_target;
    v_result := jsonb_build_object('workspaceId', v_workspace, 'userId', v_target, 'role', p_payload->>'role');
  end if;
  v_result := jsonb_build_object('ok', true, 'data', v_result, 'requestId', p_request_id);
  insert into private.command_receipts (actor_id, workspace_id, request_id, payload_hash, result)
    values (v_actor, v_workspace, p_request_id, v_hash, v_result);
  return v_result;
end;
$$;

create function public.create_workspace(p_workspace_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_workspace_command('create_workspace', p_workspace_id, p_request_id, p_payload);
$$;
create function public.create_invite(p_workspace_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_workspace_command('create_invite', p_workspace_id, p_request_id, p_payload);
$$;
create function public.accept_invite(p_request_id uuid, p_token text)
returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_workspace_command('accept_invite', null, p_request_id, jsonb_build_object('token', p_token));
$$;
create function public.change_member_role(p_workspace_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select private.apply_workspace_command('change_member_role', p_workspace_id, p_request_id, p_payload);
$$;

revoke all on function private.profile_name(jsonb), private.create_profile(), private.can_read_profile(uuid),
  private.has_workspace_permission(uuid, text), private.apply_workspace_command(text, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.can_read_profile(uuid), private.has_workspace_permission(uuid, text) to authenticated;
revoke all on function public.workspace_permissions(uuid), public.list_workspace_members(uuid),
  public.create_workspace(uuid, uuid, jsonb), public.create_invite(uuid, uuid, jsonb),
  public.accept_invite(uuid, text), public.change_member_role(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.workspace_permissions(uuid), public.list_workspace_members(uuid),
  public.create_workspace(uuid, uuid, jsonb), public.create_invite(uuid, uuid, jsonb),
  public.accept_invite(uuid, text), public.change_member_role(uuid, uuid, jsonb) to authenticated;
