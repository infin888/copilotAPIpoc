import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

const start = () =>
  new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });

test('search endpoint returns hits', async () => {
  const { server, baseUrl } = await start();
  const response = await fetch(`${baseUrl}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'vpn' })
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.totalCount, 2);
  assert.ok(Array.isArray(data.searchHits));
  server.close();
});

test('retrieval endpoint includes sensitivity label', async () => {
  const { server, baseUrl } = await start();
  const response = await fetch(`${baseUrl}/api/retrieval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryString: 'vpn onboarding', dataSource: 'oneDrive' })
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.results[0].sensitivityLabelDisplayName, 'Confidential');
  server.close();
});
