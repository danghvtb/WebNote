import { spawn } from 'node:child_process';

const port = 4174;
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
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    const page = await context.newPage();
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const startedAt = Date.now();
    await page.goto(`${base}/#/today`, { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible' });
    const firstShellMs = Date.now() - startedAt;
    const demoAction = page.getByRole('button', { name: /Khám phá Chế độ Ngoại tuyến/ });
    let localVaultPrimed = false;
    if (await demoAction.count()) {
      await demoAction.click();
      await page.waitForTimeout(500);
      if ((await page.locator('body').innerText()).includes('Tiếp tục với Google')) {
        throw new Error('Offline Demo action did not open the local app');
      }
      localVaultPrimed = true;
    }
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0];
      return entry ? { domContentLoaded: entry.domContentLoadedEventEnd, load: entry.loadEventEnd } : null;
    });
    if (firstShellMs > 5_000) throw new Error(`App shell exceeded 5 seconds under Fast 4G/CPU 4x (${firstShellMs} ms)`);
    // A second navigation approximates a returning user with browser/app-shell
    // cache. It must stay responsive even while the network is constrained.
    const warmStartedAt = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ state: 'visible' });
    const warmShellMs = Date.now() - warmStartedAt;
    if (warmShellMs > 500) throw new Error(`Warm cached local vault exceeded 500 ms (${warmShellMs} ms)`);
    console.log(JSON.stringify({ profile: 'Fast 4G + CPU 4x', localVaultPrimed, firstShellMs, warmShellMs, navigation }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
