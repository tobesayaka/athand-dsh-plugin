import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function fakeStorage(seed) {
  const values = new Map(seed || []);
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function loadClient({ storage = fakeStorage(), fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) }) } = {}) {
  let definition;
  const hooks = {};
  const React = { createElement() {} };
  class FakeFileReader {
    readAsDataURL() {
      this.result = 'data:image/png;base64,AAAA';
      if (this.onload) this.onload();
    }
  }
  const window = {
    __ModuleLoader__: { load(value) { definition = value; } },
    __ATHAND_TEST_HOOKS__: hooks,
    localStorage: {
      getItem(key) { return storage.getItem(key); },
      setItem(key, value) { storage.setItem(key, value); },
      removeItem(key) { storage.removeItem(key); },
    },
    addEventListener() {},
    removeEventListener() {},
    location: { hash: '', pathname: '/', search: '' },
  };
  const context = {
    window,
    document: {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
      createElement() { return {}; },
      head: { appendChild() {} },
    },
    navigator: { platform: 'MacIntel', clipboard: {} },
    React,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    AbortController,
    FileReader: FakeFileReader,
    fetch: (...args) => fetchImpl(...args),
    URL,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'client.js' });
  assert.ok(definition, 'module definition');
  const plugin = definition.factory((name) => {
    if (name === 'react') return React;
    throw new Error('unexpected require ' + name);
  });
  assert.ok(plugin);
  return { hooks, storage };
}

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });
const failed = (status) => ({ ok: false, status, json: async () => ({}) });

test('offline queue persists and replays mutations in order', async () => {
  const storage = fakeStorage();
  const offline = loadClient({
    storage,
    fetchImpl: async () => { throw new Error('native offline'); },
  });
  offline.hooks.resetPending();
  offline.hooks.enqueue('addText', { id: 'a', text: 'hello', source: 'manual', createdAt: 1 });
  offline.hooks.enqueue('setPinned', { id: 'a', pinned: true });
  assert.equal(offline.hooks.pendingCount(), 2);
  assert.equal(await offline.hooks.replayPending(), false);
  assert.equal(offline.hooks.pendingCount(), 2);
  assert.equal(JSON.parse(storage.getItem('dsh.athand.pending.v1')).length, 2);

  const requests = [];
  const online = loadClient({
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method, body: init.body });
      return ok();
    },
  });
  assert.equal(online.hooks.pendingCount(), 2);
  assert.equal(await online.hooks.replayPending(), true);
  assert.equal(online.hooks.pendingCount(), 0);
  assert.deepEqual(requests.map((entry) => entry.method), ['POST', 'PATCH']);
  assert.match(requests[0].url, /\/items$/);
  assert.match(requests[1].url, /\/items\/a$/);
  assert.equal(storage.getItem('dsh.athand.pending.v1'), '[]');
});

test('queue replay preserves clear cutoff and treats missing deletes as applied', async () => {
  const requests = [];
  const { hooks } = loadClient({
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method });
      return ok();
    },
  });
  hooks.resetPending();
  hooks.enqueue('clear', { before: 123456 });
  assert.equal(await hooks.replayPending(), true);
  assert.match(requests[0].url, /\/clear\?before=123456$/);

  const missing = loadClient({ fetchImpl: async () => failed(404) });
  missing.hooks.resetPending();
  missing.hooks.enqueue('removeItem', { id: 'gone/item' });
  assert.equal(await missing.hooks.replayPending(), true);
  assert.equal(missing.hooks.pendingCount(), 0);
});

test('permanent replay errors are dropped and storage cap keeps newest entries', async () => {
  const { hooks } = loadClient({ fetchImpl: async () => failed(400) });
  hooks.resetPending();
  hooks.enqueue('addText', { id: 'bad', text: 'x', source: 'manual', createdAt: 1 });
  assert.equal(await hooks.replayPending(), true);
  assert.equal(hooks.pendingCount(), 0);

  hooks.resetPending();
  for (let index = 0; index < 205; index += 1) {
    hooks.enqueue('addText', { id: 'id-' + index, text: 'text-' + index, source: 'manual', createdAt: index });
  }
  assert.equal(hooks.pendingCount(), 200);
  assert.equal(hooks.pending()[0].data.id, 'id-5');
});

test('hosted legacy images are converted to data URLs and failures are counted', async () => {
  const { hooks } = loadClient({
    fetchImpl: async (url) => {
      if (url.includes('/assets/ok')) {
        return { ok: true, status: 200, blob: async () => ({ type: 'image/png' }) };
      }
      throw new Error('asset unavailable');
    },
  });
  const result = await hooks.prepareLegacyPayload({
    items: [
      { kind: 'image', image: '/api/athand/assets/ok' },
      { kind: 'image', image: '/api/athand/assets/missing' },
      { kind: 'text', text: 'keep' },
    ],
  });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].image, 'data:image/png;base64,AAAA');
  assert.equal(result.items[1].text, 'keep');
  assert.equal(result.dropped, 1);
});

test('legacy snapshot imports once and is not replayed after the marker', async () => {
  const storage = fakeStorage([
    ['dsh.athand.v1', JSON.stringify({
      items: [{ id: 'legacy', kind: 'text', text: 'old', source: 'manual', pinned: false, createdAt: 1 }],
      snippets: [],
      settings: {},
    })],
  ]);
  const requests = [];
  const { hooks } = loadClient({
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, method: init.method, body: init.body });
      return ok({ imported: { items: 1, snippets: 0, errors: [] } });
    },
  });
  await hooks.migrate();
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/import$/);
  assert.equal(storage.getItem('dsh.athand.host-migrated.v1'), '1');

  storage.setItem('dsh.athand.v1', JSON.stringify({
    items: [{ id: 'after-clear', kind: 'text', text: 'should not import', source: 'manual', pinned: false, createdAt: 2 }],
    snippets: [],
    settings: {},
  }));
  await hooks.migrate();
  assert.equal(requests.length, 1);
});

test('image capture is rejected when the image limit is zero', () => {
  const { hooks } = loadClient();
  hooks.hydrateHost({
    settings: { layout: 'cards', shortcut: 'primary', maxText: 120, maxImage: 0, maxSnippets: 400, retentionDays: 0 },
    items: [],
    snippets: [],
  });
  assert.equal(hooks.addImage('data:image/png;base64,AAAA', 'manual'), false);
  assert.equal(hooks.addImage('not-an-image', 'manual'), false);
});

test('settings changes cap the local snapshot and queue while offline', async () => {
  const { hooks } = loadClient();
  hooks.resetPending();
  hooks.hydrateHost({
    settings: { layout: 'cards', shortcut: 'primary', maxText: 500, maxImage: 100, maxSnippets: 500, retentionDays: 0 },
    items: Array.from({ length: 120 }, (_, index) => ({
      id: 'text-' + index,
      kind: 'text',
      text: 'text ' + index,
      image: '',
      createdAt: 100 - index,
      pinned: false,
      source: 'host',
    })),
    snippets: [],
  });
  const result = await hooks.updateSettings({ maxText: 100 });
  assert.equal(result.queued, true);
  assert.equal(result.removed, 20);
  assert.equal(hooks.pendingCount(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(hooks.pending()[0])), {
    op: 'updateSettings',
    data: {
      settings: { layout: 'cards', shortcut: 'primary', maxText: 100, maxImage: 100, maxSnippets: 500, retentionDays: 0 },
    },
  });
});
