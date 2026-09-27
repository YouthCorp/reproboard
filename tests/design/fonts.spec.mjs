/* global document */
import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const fixture=JSON.parse(await readFile('.local/ui-review-fixture.json','utf8'));
test('compare three Korean typefaces on the same real issue', async ({page})=>{
  await mkdir('docs/evidence/ui-fonts',{recursive:true});
  await page.goto('/login');
  await page.getByRole('button',{name:'개발 계정으로 로그인',exact:true}).click();
  await page.locator('#workspace-select').selectOption(fixture.board.workspaceId);
  await page.locator(`[data-issue-id="${fixture.board.rows[8].id}"] .issue-card-link`).click();
  for(const [family,file] of [['Malgun Gothic',null],['SUIT Review','SUIT-Variable.woff2'],['Pretendard Review','PretendardVariable.woff2']]) {
    const font=file?`@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${(await readFile(`.local/font-review/${file}`)).toString('base64')});font-weight:100 900;}`:'';
    const style=await page.addStyleTag({content:`${font}body{font-family:'${family}',sans-serif;font-size:15px} .issue-detail textarea{line-height:1.75}`});
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.issue-detail input[name="title"]')).toHaveValue(fixture.board.rows[8].title);
    await page.screenshot({path:`docs/evidence/ui-fonts/${family.split(' ')[0]}-title.png`});
    await page.locator('.issue-detail textarea[name=steps]').scrollIntoViewIfNeeded();
    await page.screenshot({path:`docs/evidence/ui-fonts/${family.split(' ')[0]}-body.png`});
    await page.locator('.issue-detail').evaluate(el=>el.scrollTo(0,0));
    await style.evaluate(el=>el.remove());
  }
});
