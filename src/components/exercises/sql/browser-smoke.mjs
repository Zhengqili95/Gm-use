// Optional real-browser acceptance check; kept out of npm test/test:sql.
// Uses the same Vite dependency as Astro and the installed Edge, no downloads.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { chromium } from '@playwright/test';

const requireAstro = createRequire(import.meta.resolve('astro'));
const { build, preview } = await import(pathToFileURL(requireAstro.resolve('vite')).href);
const project = fileURLToPath(new URL('../../../../', import.meta.url));
const cache = resolve(project, 'node_modules/.cache/sql-smoke');
await mkdir(cache, { recursive: true });
const output = await mkdtemp(resolve(cache, 'build-'));
let server, browser;
try {
  const config = {
    configFile: false,
    root: fileURLToPath(new URL('./fixtures/browser/', import.meta.url)),
    base: '/Gm-use/',
    build: { outDir: output, emptyOutDir: false },
    preview: { host: '127.0.0.1', port: 0, open: false },
  };
  await build(config);
  server = await preview(config);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const failures = [];
  const wasmRequests = [];
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', r => {
    if (r.url().endsWith('.wasm')) wasmRequests.push({ url: r.url(), status: r.status() });
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/Gm-use/`);
  await page.waitForFunction(() => !!window.sql);
  const outcome = await page.evaluate(async () => {
    const initial = await window.sql.runSql('', 'SELECT 42 AS answer');
    const bad = await window.sql.runSql('', 'SELECT missing');
    const began = performance.now();
    const timeout = await window.sql.runSql('',
      'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n');
    const elapsed = performance.now() - began;
    const after = await window.sql.runSql('', "SELECT 'recovered'");
    const tables = await window.sql.describeTables('CREATE TABLE t(a); INSERT INTO t VALUES(1)');
    return { initial, bad, timeout, elapsed, after, tables };
  });
  assert.deepEqual(outcome.initial.resultSet.rows, [[42]]);
  assert.equal(outcome.bad.status, 'error');
  assert.equal(outcome.timeout.status, 'timeout');
  assert.ok(outcome.elapsed < 4500, `timeout ${outcome.elapsed} ms`);
  assert.deepEqual(outcome.after.resultSet.rows, [['recovered']]);
  assert.deepEqual(outcome.tables, [{ name: 't', columns: ['a'], rows: [[1]] }]);
  assert.ok(wasmRequests.length > 0, 'must fetch actual WASM');
  assert.ok(wasmRequests.every(r => new URL(r.url).pathname.startsWith('/Gm-use/') && r.status === 200));
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ result: 'Edge SQL Worker 通過', timeoutMs: Math.round(outcome.elapsed), wasmRequests }));
} finally {
  await browser?.close();
  await new Promise((done, reject) => server ? server.httpServer.close(e => e ? reject(e) : done()) : done());
  // Delete only this invocation's generated directory, never a project path.
  const child = relative(cache, output);
  if (!child.startsWith('build-') || child.includes('..') || isAbsolute(child)) throw new Error('Unsafe cleanup path');
  await rm(output, { recursive: true, force: true });
}
