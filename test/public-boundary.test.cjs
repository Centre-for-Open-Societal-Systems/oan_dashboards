/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads TypeScript server modules. */
// Regression boundary: no configured registry URL may re-enable a public registry route.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...args);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

test('public BFF preserves aggregate services and rejects former registry entrypoints before upstream access', async () => {
  let calls = 0;
  const server = createServer((request, response) => {
    calls++;
    response.setHeader('Content-Type', 'application/json');
    response.end('[{"grievances":7}]');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.GRIEVANCE_DASHBOARD_API_URL = base;
  process.env.FARMER_REGISTRY_DASHBOARD_API_URL = base;
  process.env.CROPSOWN_REGISTRY_DASHBOARD_API_URL = base;
  process.env.LIVESTOCK_REGISTRY_DASHBOARD_API_URL = base;
  delete process.env.A2C_DASHBOARD_API_URL;
  const { createElysiaApp } = require('../server/elysia-app.ts');
  const app = createElysiaApp('/api');
  const get = target => app.fetch(new Request(`http://review${target}`));
  try {
    const config = await (await get('/api/config')).json();
    assert.deepEqual(config.dashboards, ['grievance']);
    for (const target of ['/api/charts?charts=farmerKpis', '/api/charts?charts=cropKpis',
      '/api/charts?charts=livestockKpis', '/api/charts?charts=grvKpis,farmerKpis',
      '/api/charts/farmerKpis', '/api/data', '/api/dashboard-data', '/api/dashboard/general', '/api/filter-options']) {
      assert.equal((await get(target)).status, 404, target);
    }
    for (const target of ['/api/data', '/api/data/export']) {
      assert.equal((await app.fetch(new Request(`http://review${target}`, { method: 'POST' }))).status, 404);
    }
    assert.equal(calls, 0, 'removed chart IDs must not reach services or the old cache');
    const result = await (await get('/api/charts?charts=grvKpis&region=ET04')).json();
    assert.equal(result.summary.failed, 0);
    assert.equal(result.data.grvKpis.data[0].grievances, 7);
    assert.equal(calls, 1);
    process.env.A2C_DASHBOARD_API_URL = base;
    assert.deepEqual((await (await get('/api/config')).json()).dashboards, ['a2c', 'grievance']);
    for (const suffix of ['', '&region=ET04']) {
      const aggregate = await get('/api/charts?charts=a2cKpis,grvKpis' + suffix);
      assert.equal(aggregate.status, 200);
      const payload = await aggregate.json();
      assert.equal(payload.summary.failed, 0);
      assert.equal(payload.summary.successful, 2);
      assert.equal(payload.data.a2cKpis.data[0].grievances, 7);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
