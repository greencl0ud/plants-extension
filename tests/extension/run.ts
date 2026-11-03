import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { chromium, type Browser, type Frame, type Page } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results', 'extension', new Date().toISOString().replaceAll(':', '-'));
console.log(`Extension test artifacts: ${artifacts}`);
const temporary = await mkdtemp(path.join(tmpdir(), 'code-plants-test-'));
const workspace = path.join(temporary, 'workspace');
const profile = path.join(temporary, 'profile');
const version = '1.100.3'; // Deliberate upgrade: rerun the smoke suite when changing this.
await mkdir(artifacts, { recursive: true });
await mkdir(workspace);
await mkdir(path.join(profile, 'User'), { recursive: true });
await writeFile(path.join(workspace, 'example.txt'), 'Isolated Code Plants test workspace\n');
await writeFile(path.join(profile, 'User', 'settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false,
  'workbench.startupEditor': 'none',
  'workbench.enableExperiments': false,
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'update.mode': 'none',
  'telemetry.telemetryLevel': 'off',
}));

async function waitFor<T>(check: () => Promise<T | false | undefined>, description: string, child: ChildProcess): Promise<T> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const error = await readFile(path.join(temporary, 'host-error.txt'), 'utf8');
      throw new Error(error);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    assert.equal(child.exitCode, null, `VS Code exited while waiting for ${description}`);
    assert.equal(child.signalCode, null, `VS Code was killed while waiting for ${description}`);
    const result = await check();
    if (result) return result;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function session(executablePath: string, name: string, interact: (shelf: Frame) => Promise<void>): Promise<void> {
  await rm(path.join(temporary, 'ready'), { force: true });
  await rm(path.join(temporary, 'attached'), { force: true });
  await rm(path.join(temporary, 'finish'), { force: true });
  const port = await freePort();
  const environment: NodeJS.ProcessEnv = { ...process.env, CODE_PLANTS_TEST_SESSION: temporary };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(executablePath, [workspace,
    `--user-data-dir=${profile}`, `--extensions-dir=${path.join(temporary, 'extensions')}`,
    `--extensionDevelopmentPath=${root}`,
    `--extensionTestsPath=${path.join(root, 'dist/test-extension/host.cjs')}`,
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--new-window',
  ], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  let spawnError: Error | undefined;
  const exited = new Promise<number | null>(resolve => {
    child.once('exit', code => resolve(code));
    child.once('error', error => { spawnError = error; log += String(error); resolve(null); });
  });
  let browser: Browser | undefined;
  let page: Page | undefined;
  const stop = () => child.kill('SIGKILL');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const watchdog = setTimeout(stop, 120000);
  try {
    browser = await waitFor(async () => {
      try { return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }); } catch { return false; }
    }, 'VS Code debugging connection', child);
    if (spawnError) throw spawnError;
    // Attach before revealing the shelf so Chromium reports its cross-origin frames.
    for (const context of browser.contexts()) {
      const observe = (candidate: Page) => {
        candidate.on('console', message => { log += `\n[webview ${message.type()}] ${message.text()}`; });
        candidate.on('pageerror', error => { log += `\n[page error] ${error.stack}`; });
      };
      context.pages().forEach(observe);
      context.on('page', observe);
    }
    await writeFile(path.join(temporary, 'attached'), 'ready');
    await waitFor(async () => {
      try { await access(path.join(temporary, 'ready')); return true; } catch { return false; }
    }, 'extension activation and shelf reveal', child);
    const connectedBrowser = browser;
    page = connectedBrowser.contexts()[0]?.pages()[0];
    const shelf = await waitFor(async () => {
      for (const context of connectedBrowser.contexts()) {
        for (const candidate of context.pages()) {
          for (const frame of candidate.frames()) {
            if (await frame.getByRole('main', { name: 'Plant Shelf', exact: true }).count()) {
              page = candidate;
              return frame;
            }
          }
        }
      }
    }, 'rendered Plant Shelf webview', child);
    assert.ok(page, 'Missing VS Code workbench page');
    page.setDefaultTimeout(15000);
    await shelf.getByRole('button', { name: 'Add', exact: true }).waitFor();
    await shelf.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await interact(shelf);
    await shelf.waitForFunction(() => document.images.length > 0
      && [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(artifacts, `${name}-passed.png`) });
    await writeFile(path.join(temporary, 'finish'), 'passed');
    const code = await exited;
    assert.equal(code, 0, 'Extension host tests must exit successfully');
    console.log(`PASS: ${name}`);
  } catch (error) {
    if (page) {
      console.error('Frames:', page.frames().map(frame => frame.url()));
      await writeFile(path.join(artifacts, `${name}-failed.html`), await page.content()).catch(() => {});
    }
    if (page) await page.screenshot({ path: path.join(artifacts, `${name}-failed.png`), timeout: 5000 }).catch(() => {});
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null && !spawnError) {
      child.kill('SIGKILL');
      await exited;
    }
    clearTimeout(watchdog);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await browser?.close().catch(() => {});
    await writeFile(path.join(artifacts, `${name}.log`), log);
  }
}

async function ownedStringle(shelf: Frame): Promise<void> {
  const card = shelf.getByRole('dialog', { name: 'Plants', exact: true })
    .getByRole('button', { name: /Stringle.*On your shelf/ });
  await card.waitFor();
  assert.equal(await card.isDisabled(), true, 'Owned Stringle must not be addable twice');
}

try {
  const executablePath = await downloadAndUnzipVSCode(version);
  await session(executablePath, 'add-plant', async shelf => {
    assert.equal(await shelf.getByRole('button', { name: /View information about/ }).count(), 0);
    await shelf.getByRole('button', { name: 'Add', exact: true }).click();
    await shelf.getByRole('dialog', { name: 'Plants', exact: true }).waitFor();
    await shelf.getByRole('dialog', { name: 'Plants', exact: true }).getByRole('button', { name: /Stringle/ }).click();
    await ownedStringle(shelf);
    await shelf.getByRole('button', { name: 'Close', exact: true }).click();
    await shelf.getByRole('button', { name: 'View information about Stringle', exact: true }).waitFor();
  });
  // Reuse only this run's temporary workspace/profile to test persisted state.
  await session(executablePath, 'restore-plant', async shelf => {
    await shelf.getByRole('button', { name: 'View information about Stringle', exact: true }).waitFor();
    assert.equal(await shelf.getByRole('button', { name: /View information about/ }).count(), 1);
    await shelf.getByRole('button', { name: 'Add', exact: true }).click();
    await ownedStringle(shelf);
    await shelf.getByRole('dialog', { name: 'Plants', exact: true }).press('Escape');
    await shelf.getByRole('dialog', { name: 'Plants', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await shelf.getByRole('button', { name: 'Add', exact: true })
      .evaluate(button => document.activeElement === button), true, 'Escape must return focus to Add');
  });
} catch (error) {
  await copyFile(path.join(temporary, 'host-error.txt'), path.join(artifacts, 'host-error.txt')).catch(() => {});
  await writeFile(path.join(artifacts, 'failure.txt'), error instanceof Error ? error.stack ?? error.message : String(error));
  console.error(error);
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
