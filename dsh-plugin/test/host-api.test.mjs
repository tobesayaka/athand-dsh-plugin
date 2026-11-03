import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApi } from '../host/api.js';

function createNative() {
  const calls = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      calls.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
      if (request.headers.authorization !== 'Bearer 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
        response.writeHead(401, { 'content-type': 'text/plain' });
        response.end('authentication required');
        return;
      }
      if (request.url === '/api/athand/status') {
        const payload = {
          protocol: 'athand/host-v1', mode: 'native', storage: 'sqlite',
          revision: 7, enabled: true, count: 1, counts: { text: 1, image: 0, snippets: 0 },
          platform: 'darwin', supported: true, watchSupported: true, instanceId: 'native-1',
        };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
        return;
      }
      if (request.url.startsWith('/api/athand/state')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          protocol: 'athand/host-v1', mode: 'native', storage: 'sqlite', revision: 7,
          settings: { layout: 'cards', shortcut: 'primary', maxText: 120, maxImage: 24, maxSnippets: 400, retentionDays: 0 },
          enabled: true,
          items: [{ id: 'bc1', kind: 'text', text: 'from native', image: '', createdAt: 100, pinned: false, source: 'host' }],
          snippets: [], counts: { text: 1, image: 0, snippets: 0 },
        }));
        return;
      }
      if (request.url === '/api/athand/items' && request.method === 'POST') {
        const input = JSON.parse(body);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ item: { id: 'bc2', kind: input.kind || 'text', text: input.text || '', image: '', createdAt: 200, pinned: false, source: input.source || 'manual' }, revision: 8 }));
        return;
      }
      if (request.url === '/api/athand/assets/asset1') {
        response.writeHead(200, { 'content-type': 'image/png', 'content-length': '4', 'cache-control': 'private, max-age=3600' });
        response.end(Buffer.from('PNG!'));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
  });
  return { server, calls };
}

function createHarness({ native, rejection } = {}) {
  let route;
  const webServer = {
    register(candidate) {
      route = candidate;
      return () => { route = null; };
    },
  };
  const ctx = {
    get(name) {
      if (name === 'connection') return { requestRejection: () => rejection };
      return undefined;
    },
  };
  const api = createApi({ webServer, ctx });
  const host = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const matches = route && (url.pathname === route.path || url.pathname.startsWith(route.path + '/'));
    if (!matches) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    route.handler(request, response);
  });
  return { api, host, native, route: () => route };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

test('Host forwards the browser API to the native app and keeps the token server-side', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'athand-proxy-'));
  const native = createNative();
  const nativePort = await listen(native.server);
  const bridge = path.join(directory, 'bridge.json');
  writeFileSync(bridge, JSON.stringify({ protocol: 'athand/native-v1', port: nativePort, token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }), { mode: 0o600 });
  process.env.ATHAND_BRIDGE = bridge;
  const harness = createHarness({ native });
  assert.equal(harness.route().path, '/api/athand');
  const hostPort = await listen(harness.host);
  const base = 'http://127.0.0.1:' + hostPort + '/api/athand';
  try {
    let response = await fetch(base + '/status');
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.equal(body.mode, 'native');
    assert.equal(body.revision, 7);
    assert.equal(native.calls[0].authorization, 'Bearer 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

    response = await fetch(base + '/state?since=7');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].text, 'from native');

    response = await fetch(base + '/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'text', text: 'hello' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).item.text, 'hello');
    assert.equal(JSON.parse(native.calls.at(-1).body).text, 'hello');

    response = await fetch(base + '/assets/asset1');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'PNG!');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    await close(harness.host);
    await close(native.server);
    delete process.env.ATHAND_BRIDGE;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Host rejects an unauthorised browser session before contacting the native app', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'athand-proxy-'));
  const native = createNative();
  const nativePort = await listen(native.server);
  const bridge = path.join(directory, 'bridge.json');
  writeFileSync(bridge, JSON.stringify({ protocol: 'athand/native-v1', port: nativePort, token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }), { mode: 0o600 });
  process.env.ATHAND_BRIDGE = bridge;
  const harness = createHarness({ native, rejection: 401 });
  const hostPort = await listen(harness.host);
  try {
    const response = await fetch('http://127.0.0.1:' + hostPort + '/api/athand/status');
    assert.equal(response.status, 401);
    assert.equal(await response.text(), 'authentication required');
    assert.equal(native.calls.length, 0);
  } finally {
    await close(harness.host);
    await close(native.server);
    delete process.env.ATHAND_BRIDGE;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Host reports a clear 503 when the native app is offline', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'athand-proxy-'));
  const bridge = path.join(directory, 'bridge.json');
  writeFileSync(bridge, JSON.stringify({ protocol: 'athand/native-v1', port: 9, token: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }), { mode: 0o600 });
  process.env.ATHAND_BRIDGE = bridge;
  const harness = createHarness({});
  const hostPort = await listen(harness.host);
  try {
    const response = await fetch('http://127.0.0.1:' + hostPort + '/api/athand/status');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.native, false);
    assert.match(body.error, /not running|connect/i);
  } finally {
    await close(harness.host);
    delete process.env.ATHAND_BRIDGE;
    rmSync(directory, { recursive: true, force: true });
  }
});
