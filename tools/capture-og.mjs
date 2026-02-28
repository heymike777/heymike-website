import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(`file://${resolve(__dirname, 'og-template.html')}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: resolve(__dirname, '../files/og-image.png'), type: 'png' });
await browser.close();
console.log('OG image saved to files/og-image.png');
