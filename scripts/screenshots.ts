// 발표용 스크린샷 자동 캡처: 1366×768, deviceScaleFactor 2. 화면 6개.
// 사용법: npm run build && npm run screenshots
// 이미 떠 있는 서버를 쓰려면 SHOT_URL=http://localhost:5173 npm run screenshots
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';

const OUT = 'screenshots';
const PORT = 4179;
const URL = process.env.SHOT_URL ?? `http://localhost:${PORT}/`;

async function startServer(): Promise<ChildProcess | null> {
  if (process.env.SHOT_URL) return null;
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return p;
    } catch {
      /* 아직 안 뜸 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  stop(p);
  throw new Error('preview 서버를 띄우지 못했어요. 먼저 npm run build를 실행하세요.');
}

function stop(p: ChildProcess) {
  try {
    process.kill(-p.pid!, 'SIGTERM');
  } catch {
    p.kill();
  }
}

async function shot(page: Page, name: string) {
  await page.mouse.move(2, 760);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800); // 형광펜이 그어지는 동작(520ms)이 끝난 뒤
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✓ ${OUT}/${name}.png`);
}

async function loadSample(page: Page, label: string) {
  await page.getByRole('button', { name: '샘플 문서 열기' }).click();
  await page.getByRole('menuitem', { name: label }).click();
  await page.getByRole('heading', { name: '읽어 낸 값을 확인해 주세요' }).waitFor();
}

async function confirmAndCheck(page: Page, waitMs = 0) {
  if (waitMs) await page.waitForTimeout(waitMs);
  await page.getByRole('button', { name: /점검하기/ }).click();
  await page.getByRole('button', { name: '정렬 맵', exact: true }).waitFor();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2, locale: 'ko-KR' });
  ctx.setDefaultTimeout(15000);
  try {
    // 1 올리기 → 2 확인 → 3 결과(오류) → 5 정렬 맵 → 6 재점검 (오류판 → 수정판)
    const page = await ctx.newPage();
    await page.goto(URL);
    await shot(page, '01-upload');

    await loadSample(page, '오류판');
    // 프로그래밍 프로젝트의 만점 칸(표2 3행 5열)을 눌러 원문과 값을 함께 표시
    await page.locator('#cell-plan-1-2-4').click();
    await page.waitForTimeout(600);
    await shot(page, '02-confirm');

    await confirmAndCheck(page, 800);
    await shot(page, '03-results');

    await page.getByRole('button', { name: '정렬 맵', exact: true }).click();
    await page.getByRole('heading', { name: /성취기준 \d+개/ }).waitFor();
    await shot(page, '05-alignment');

    await page.getByRole('button', { name: '결과로 돌아가기' }).click();
    await page.getByRole('button', { name: '고친 문서 다시 올리기' }).click();
    await loadSample(page, '수정판');
    await confirmAndCheck(page, 600);
    await page.getByRole('button', { name: /지난 점검과 비교/ }).click();
    await page.getByRole('heading', { name: /해결됐어요|비교했어요/ }).waitFor();
    await shot(page, '06-recheck');
    await page.close();

    // 4 결과(정상)
    const p3 = await ctx.newPage();
    await p3.goto(URL);
    await loadSample(p3, '정상판');
    await confirmAndCheck(p3, 600);
    await shot(p3, '04-results-normal');
    await p3.close();
  } finally {
    await browser.close();
    if (server) stop(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
