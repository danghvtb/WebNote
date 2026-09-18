import { spawn } from 'node:child_process';

const port = 4173;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', windowsHide: true });
const waitForServer = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/`)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start.');
};

try {
  await waitForServer();
  const { chromium } = await import('playwright');
  const { AxeBuilder } = await import('@axe-core/playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const desktop = await desktopContext.newPage();
    await desktop.goto(`${base}/#/today`, { waitUntil: 'networkidle' });
    if (await desktop.locator('html[lang="vi"]').count() !== 1) throw new Error('Vietnamese lang metadata missing');
    if (await desktop.locator('link[rel="manifest"]').count() !== 1) throw new Error('PWA manifest link missing');
    const desktopA11y = await new AxeBuilder({ page: desktop }).analyze();
    const desktopCritical = desktopA11y.violations.filter((item) => item.impact === 'critical');
    if (desktopCritical.length) throw new Error(`Desktop axe critical violations: ${desktopCritical.map((item) => item.id).join(', ')}`);

    await desktopContext.close();
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${base}/#/report/e2e`, { waitUntil: 'networkidle' });
    if (await mobile.locator('body').isVisible() !== true) throw new Error('Mobile shell is not visible');
    const mobileA11y = await new AxeBuilder({ page: mobile }).analyze();
    const mobileCritical = mobileA11y.violations.filter((item) => item.impact === 'critical');
    if (mobileCritical.length) throw new Error(`Mobile axe critical violations: ${mobileCritical.map((item) => item.id).join(', ')}`);
    await mobileContext.close();
    console.log('Browser E2E passed: desktop/mobile deep links, PWA metadata and axe critical checks.');
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
