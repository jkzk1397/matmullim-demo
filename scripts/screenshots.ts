// 발표용 스크린샷 자동 캡처: 1440×900, deviceScaleFactor 2.
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
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✓ ${OUT}/${name}.png`);
}

async function loadSample(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.getByRole('heading', { name: '읽어 낸 값을 원문과 맞춰 보고 확인해 주세요' }).waitFor();
}

async function confirmAndCheck(page: Page, waitMs = 0) {
  if (waitMs) await page.waitForTimeout(waitMs);
  await page.getByRole('button', { name: /확인하고 점검/ }).click();
  await page.getByRole('button', { name: '정렬 맵', exact: true }).waitFor();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
  ctx.setDefaultTimeout(15000);
  try {
    // 1~5: 오류판 → 수정판 흐름
    const page = await ctx.newPage();
    await page.goto(URL);
    await shot(page, '01-upload');

    await loadSample(page, '오류판');
    // 프로그래밍 프로젝트의 만점 칸(표2 3행 5열)을 눌러 원문 하이라이트
    await page.locator('#cell-plan-1-2-4').click();
    await page.waitForTimeout(600);
    await shot(page, '02-confirm');

    await confirmAndCheck(page, 1500);
    await shot(page, '03-results');

    await page.getByRole('button', { name: /채점기준을 분량/ }).click();
    await shot(page, '03b-results-guideline');

    await page.getByRole('button', { name: '정렬 맵' }).first().click();
    await page.getByRole('heading', { name: /성취기준 \d+개/ }).waitFor();
    await shot(page, '04-alignment');

    await page.getByRole('button', { name: '결과로 돌아가기' }).click();
    await page.getByRole('button', { name: /만점은 30점인데/ }).click();
    await page.getByRole('button', { name: '고치기', exact: true }).click();
    await shot(page, '05a-reupload');
    await loadSample(page, '수정판');
    await confirmAndCheck(page, 1200);
    await page.getByRole('button', { name: /이전 점검 대비/ }).click();
    await page.getByRole('heading', { name: /해결됐어요|해결된 지적이 없어요/ }).waitFor();
    await shot(page, '05-recheck');
    await page.close();

    // 정렬 맵: 교사가 연결을 지정하면 회색 카드가 사라짐
    const p2 = await ctx.newPage();
    await p2.goto(URL);
    await loadSample(p2, '오류판');
    await confirmAndCheck(p2);
    await p2.getByRole('button', { name: '정렬 맵' }).first().click();
    await p2.getByRole('button', { name: '[9정05-03] – 프로그래밍 프로젝트' }).click();
    await p2.getByRole('heading', { name: /모두 평가와 연결/ }).waitFor();
    await shot(p2, '04b-alignment-linked');
    await p2.close();

    // 정상판 결과
    const p3 = await ctx.newPage();
    await p3.goto(URL);
    await loadSample(p3, '정상판');
    await confirmAndCheck(p3, 1000);
    await shot(p3, '06-normal-results');
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
