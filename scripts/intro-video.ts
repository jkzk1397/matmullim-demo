// video/intro.html을 프레임 단위로 렌더링해 video/matmullim-intro.mp4(무음)로 만든다.
// 사용: npx tsx scripts/intro-video.ts [--preview t1,t2,...]
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const FPS = 30;
const DURATION = 36;
const args = process.argv.slice(2);
const preview = args[0] === '--preview' ? args[1].split(',').map(Number) : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(resolve('video/intro.html')).href);
await page.evaluate(() => (window as unknown as { ready: Promise<unknown> }).ready);

const frame = async (t: number) => {
  await page.evaluate((tt) => (window as unknown as { render: (t: number) => void }).render(tt), t);
  return page.screenshot({ type: 'jpeg', quality: 92 });
};

if (preview) {
  for (const t of preview) {
    await page.evaluate((tt) => (window as unknown as { render: (t: number) => void }).render(tt), t);
    await page.screenshot({ path: `video/preview-${t}.png` });
  }
} else {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', 'video/matmullim-intro-silent.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < FPS * DURATION; i++) {
    const buf = await frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('video/matmullim-intro-silent.mp4');
}
await browser.close();
