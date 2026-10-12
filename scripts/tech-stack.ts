// docs/tech-stack/index.html → docs/tech-stack.png (1600×900, 배율 2). 로고는 공식 로고 SVG(devicon·simple-icons).
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve('docs/tech-stack/index.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/tech-stack.png' });
await browser.close();
console.log('docs/tech-stack.png');
