import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const port = 4173;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', windowsHide: true });

const waitForServer = async () => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start within 15 seconds.');
};

try {
  await waitForServer();
  const checks = [
    ['desktop shell', {}],
    ['mobile shell', { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } }],
    ['deep-link page', {}],
    ['deep-link report', {}],
  ];
  for (const [name, options] of checks) {
    const path = name === 'deep-link page' ? '/#/page/smoke' : name === 'deep-link report' ? '/#/report/smoke' : '/';
    const response = await fetch(`${base}${path}`, options);
    if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  }
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  if (!manifest.ok) throw new Error(`manifest returned HTTP ${manifest.status}`);
  const manifestData = await manifest.json();
  if (manifestData.lang !== 'vi' || manifestData.display !== 'standalone') throw new Error('manifest metadata is incomplete');
  const index = await (await fetch(`${base}/`)).text();
  if (!index.includes('lang="vi"') || !index.includes('manifest.webmanifest')) throw new Error('accessibility/PWA shell contract failed');
  const dialogSource = await readFile('src/components/common/DialogShell.tsx', 'utf8');
  const toastSource = await readFile('src/components/common/Toasts.tsx', 'utf8');
  const cssSource = await readFile('src/index.css', 'utf8');
  if (!dialogSource.includes('role="dialog"') || !dialogSource.includes('aria-modal="true"')) throw new Error('dialog accessibility contract failed');
  if (!toastSource.includes('aria-live="polite"')) throw new Error('toast live-region contract failed');
  if (!cssSource.includes('min-width: 44px') || !cssSource.includes('min-height: 44px')) throw new Error('touch-target contract failed');
  const modalFiles = ['AIModal.tsx', 'ConfirmModal.tsx', 'CreateNotebookModal.tsx', 'ExportModal.tsx', 'GraphViewModal.tsx', 'ProjectManagerModal.tsx', 'TagManagerModal.tsx', 'TaskManagerModal.tsx', 'TrashModal.tsx'];
  for (const file of modalFiles) {
    const source = await readFile(`src/components/modal/${file}`, 'utf8');
    if (!source.includes('DialogShell')) throw new Error(`dialog primitive missing in ${file}`);
  }
  const settingsSource = await readFile('src/components/settings/SettingsModal.tsx', 'utf8');
  if (!settingsSource.includes('DialogShell')) throw new Error('dialog primitive missing in SettingsModal.tsx');
  for (const file of ['AddScheduleModal.tsx', 'CustomTaskManagerModal.tsx', 'DailyBriefingModal.tsx']) {
    const source = await readFile(`src/components/schedule/${file}`, 'utf8');
    if (!source.includes('DialogShell')) throw new Error(`dialog primitive missing in ${file}`);
  }
  const graphSource = await readFile('src/components/modal/GraphViewModal.tsx', 'utf8');
  if (!graphSource.includes('role="img"') || !graphSource.includes('touch-none')) throw new Error('graph touch/accessibility contract failed');
  const packageSource = JSON.parse(await readFile('package.json', 'utf8'));
  if (!packageSource.scripts?.['test:e2e:browser'] || !packageSource.scripts?.['test:perf:browser']) throw new Error('browser test scripts missing');
  await readFile('.github/workflows/browser-e2e.yml', 'utf8');
  console.log('E2E smoke passed: desktop, mobile, deep links, manifest, lang metadata and modal accessibility contract.');
} finally {
  server.kill();
}
