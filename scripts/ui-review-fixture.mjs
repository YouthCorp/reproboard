/* global process, console */
import { writeFile, readFile, access, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createUxFixture, cleanupUxFixture } from '../tests/helpers/ux-fixture.mjs';
import { localDb, localStack, readAccounts } from './local-stack.mjs';
const file = new URL('../.local/ui-review-fixture.json', import.meta.url);
if (!['prepare', 'cleanup'].includes(process.argv[2])) throw new Error('Use prepare or cleanup');
if (process.argv[2] === 'cleanup') {
  const fixture = JSON.parse(await readFile(file, 'utf8'));
  for (const value of [fixture.board, fixture.empty].filter(Boolean)) await cleanupUxFixture(value);
  await unlink(file);
  console.log('UI review fixtures cleaned; existing teams preserved');
} else {
  const exists = await access(file).then(()=>true,()=>false);
  if (exists) throw new Error('Review fixture exists; reuse it, or explicitly cleanup before preparing another');
  const board = await createUxFixture(16);
  await writeFile(file,JSON.stringify({board},null,2));
  const empty = await createUxFixture(0);
  await writeFile(file,JSON.stringify({board,empty},null,2));
  const stack = localStack(), accounts = readAccounts(), account = accounts.find(a=>a.role==='owner');
  const client = createClient(stack.API_URL, stack.PUBLISHABLE_KEY || stack.ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
  const login = await client.auth.signInWithPassword({email:account.email,password:account.password});
  if(login.error) throw new Error('Login failed');
  const titles = ['로그인 후에도 화면이 계속 로딩돼요','결제 내역의 날짜가 하루 전으로 표시됩니다','모바일에서 댓글 입력창이 키보드에 가려집니다','필터를 초기화해도 담당자 조건이 남아 있어요','첨부 파일 이름이 길면 다운로드 버튼을 누를 수 없습니다','알림을 읽어도 배지가 사라지지 않습니다','검색어를 지우면 이전 결과가 잠깐 보여요','초대 링크를 열었을 때 팀 이름이 표시되지 않습니다','여러 줄로 작성한 재현 단계를 저장한 뒤 다시 열면 줄바꿈이 사라지고 한 문장으로 표시되어 내용을 읽기 어렵습니다','담당자를 선택하지 않은 버그가 검색에서 빠집니다','로그아웃 후 뒤로 가면 빈 보드가 보여요','완료한 버그의 검증 환경을 확인할 수 없습니다','대비가 낮아 비활성 버튼을 구분하기 어려워요','한글 검색어를 입력하는 도중 결과가 여러 번 바뀝니다','태블릿에서 상세 화면의 닫기 버튼이 잘립니다','수정한 앱 버전이 검증 기록에 남지 않습니다'];
  for(let index=0;index<board.rows.length;index++) {
    const row = board.rows[index];
    const payload = {title:titles[index], steps:'1. 이메일로 로그인합니다.\n2. 로그인 버튼을 한 번 누릅니다.\n3. 다음 화면으로 이동하는지 확인합니다.\n\n새로고침하면 정상적으로 열리지만, 처음 접속했을 때 같은 문제가 반복됩니다.', expected:'로그인을 마치면 팀 보드와 등록된 버그가 보여야 합니다.', actual:'로딩 표시가 남아 있고, 다른 메뉴로 이동할 수 없습니다.', environment:'Windows 11 · Chrome 153\n앱 버전 0.9.2 · 1440 × 900', severity:index%3===0?'S2':'S3',priority:index%3===0?'P1':'P2',fix_note:'인증이 끝난 뒤 로딩 상태가 해제되도록 수정했습니다.',target_build:'0.9.3-rc.1'};
    if(index===0) Object.assign(payload,{steps:'',expected:'',actual:'',environment:'',reproduction:'unknown',assignee_id:null,fix_note:'',target_build:''});
    const result = await client.rpc('update_issue',{p_workspace_id:board.workspaceId,p_issue_id:row.id,p_expected_version:row.version,p_request_id:randomUUID(),p_payload:payload});
    if(result.error || !result.data.ok) throw new Error('Fixture update failed');
    board.rows[index]=result.data.data;
  }
  const db=await localDb(stack);
  for(const role of ['member','viewer']) await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)',[board.workspaceId,accounts.find(a=>a.role===role).id,role]);
  await db.end(); await client.auth.signOut();
  await writeFile(file,JSON.stringify({board,empty},null,2));
  console.log('Created isolated synthetic UI review fixtures: 16 issues, empty team, Member and Viewer');
}
