import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(resolve('presentation/slides.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: 'presentation/slides.pdf', printBackground: true, preferCSSPageSize: true });
await browser.close(); console.log('Exported presentation/slides.pdf');
