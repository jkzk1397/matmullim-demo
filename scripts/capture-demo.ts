// 소개 영상용: 실제 데모 앱을 끝까지 조작하며 단계별 화면(1600×900 @2x)과 버튼·영역 위치를 저장한다.
// 결과: video/demo/*.png, video/demo/boxes.json   사용: npm run build && npx tsx scripts/capture-demo.ts
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Locator, type Page } from 'playwright';

const PORT = 4183;
const URL = `http://localhost:${PORT}/`;
const OUT = 'video/demo';
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* 대기 */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
const box = async (name: string, l: Locator) => {
  const b = (await l.first().boundingBox())!;
  boxes[name] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};
const shot = async (p: Page, name: string) => {
  await p.mouse.move(1599, 899);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
try {
  await page.goto(URL);
  await page.getByRole('heading', { name: /올려 주세요/ }).waitFor();
  await box('open-error', page.getByRole('row', { name: /오류판/ }).getByRole('button'));
  await box('sample-list', page.getByRole('heading', { name: '샘플 문서' }).locator('xpath=ancestor::section[1]'));
  await shot(page, '1-upload');

  await page.getByRole('row', { name: /오류판/ }).getByRole('button').click();
  await page.getByRole('heading', { name: '읽어 낸 값을 확인해 주세요' }).waitFor();
  await page.locator('#cell-plan-1-2-4').click();
  await page.waitForTimeout(1200); // 부드러운 스크롤이 끝난 뒤 위치를 잰다
  await box('cell-30', page.locator('#cell-plan-1-2-4'));
  await box('field-30', page.locator('#f-plan-1-2-4'));
  await box('check-btn', page.getByRole('button', { name: /점검하기/ }));
  await shot(page, '2-confirm');

  await page.getByRole('button', { name: /점검하기/ }).click();
  await page.getByRole('button', { name: '정렬 맵', exact: true }).waitFor();
  await box('result-title', page.locator('h1'));
  await box('result-counts', page.getByRole('button', { name: /^확인된 오류/ }).locator('xpath=..'));
  await box('result-detail', page.locator('article'));
  await box('result-fix', page.getByText('고치는 법').locator('xpath=..'));
  await box('map-btn', page.getByRole('button', { name: '정렬 맵', exact: true }));
  await shot(page, '3-results');

  // 재점검(수정판): 연결을 지정하기 전 상태로 비교
  await page.getByRole('button', { name: '고친 문서 다시 올리기' }).click();
  await page.getByRole('row', { name: /수정판/ }).getByRole('button').click();
  await page.getByRole('heading', { name: '읽어 낸 값을 확인해 주세요' }).waitFor();
  await page.getByRole('button', { name: /점검하기/ }).click();
  await page.getByRole('button', { name: /지난 점검과 비교/ }).click();
  await page.getByRole('heading', { name: /해결됐어요|비교했어요/ }).waitFor();
  await box('recheck-summary', page.getByText(/건 중/).locator('xpath=ancestor::section[1]'));
  await box('recheck-table', page.locator('table'));
  await shot(page, '6-recheck');

  // 정렬 맵: 새 페이지에서 오류판으로
  const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
  await p2.goto(URL);
  await p2.getByRole('row', { name: /오류판/ }).getByRole('button').click();
  await p2.getByRole('button', { name: /점검하기/ }).click();
  await p2.getByRole('button', { name: '정렬 맵', exact: true }).click();
  await p2.getByRole('heading', { name: /성취기준 \d+개/ }).waitFor();
  await box('link-select', p2.getByRole('combobox').last());
  await box('map-table', p2.locator('table'));
  await shot(p2, '4-map');
  await p2.getByRole('combobox').last().selectOption({ label: '프로그래밍 프로젝트' });
  await p2.getByRole('heading', { name: /모두 평가와 연결/ }).waitFor();
  await shot(p2, '5-map-linked');
} finally {
  writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 2));
  await browser.close();
  try {
    process.kill(-server.pid!, 'SIGTERM');
  } catch {
    server.kill();
  }
}
console.log(boxes);
