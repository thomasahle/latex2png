import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerClient } from '../src/lib/services/worker-client.js';

function fixture(t, options = {}) {
  const workers = [];
  const errors = [];
  const client = createWorkerClient({
    createWorker() {
      const worker = {
        messages: [], stopped: false,
        postMessage(message) { this.messages.push(message); },
        terminate() { this.stopped = true; },
        receive(data) { this.onmessage({ data }); },
        ready() { this.receive({ type: 'ready' }); },
        crash() { this.onerror({ message: 'crashed' }); },
        reply(result = 'svg') { this.receive({ id: this.messages.at(-1).id, success: true, result }); },
      };
      workers.push(worker);
      return worker;
    },
    onError: error => errors.push(error), ...options,
  });
  t.after(() => client.terminate());
  return { client, workers, errors };
}

test('waits for readiness and correlates independent requests', async t => {
  const { client, workers } = fixture(t);
  const first = client.request({ latex: 'x' });
  const second = client.request({ latex: 'y' });
  assert.equal(workers[0].messages.length, 0);
  workers[0].ready();
  workers[0].receive({ id: workers[0].messages[1].id, success: true, result: 'y' });
  workers[0].receive({ id: workers[0].messages[0].id, success: true, result: 'x' });
  assert.deepEqual(await Promise.all([first, second]), ['x', 'y']);
});

test('crash retries in a fresh worker and ignores late responses from the old worker', async t => {
  const { client, workers } = fixture(t);
  const result = client.request({ latex: 'x' });
  workers[0].ready();
  workers[0].crash();
  assert.equal(workers[0].stopped, true);
  workers[1].ready();
  workers[0].reply('stale');
  workers[1].reply('fresh');
  assert.equal(await result, 'fresh');
});

test('initialization failure retries only once and the next edit can recover', async t => {
  const { client, workers } = fixture(t);
  const result = client.request({ latex: 'x' });
  const rejected = assert.rejects(result, /initialization failed/);
  workers[0].receive({ type: 'init_error' });
  workers[1].receive({ type: 'init_error' });
  await rejected;
  assert.equal(workers.length, 2);
  const recovered = client.request({ latex: 'y' });
  workers[2].ready();
  workers[2].reply();
  assert.equal(await recovered, 'svg');
});

test('TeX errors reject without restarting a healthy worker', async t => {
  const { client, workers } = fixture(t);
  const result = client.request({ latex: 'invalid' });
  workers[0].ready();
  workers[0].receive({ id: workers[0].messages[0].id, success: false, error: 'Invalid TeX' });
  await assert.rejects(result, /Invalid TeX/);
  const next = client.request({ latex: 'x' });
  workers[0].reply();
  assert.equal(await next, 'svg');
  assert.equal(workers.length, 1);
});

test('superseded and terminated requests settle with AbortError, even before readiness', async t => {
  const { client, workers } = fixture(t);
  const old = client.request({ latex: 'x' }, 'preview');
  const rejected = assert.rejects(old, { name: 'AbortError' });
  const latest = client.request({ latex: 'y' }, 'preview');
  await rejected;
  workers[0].ready();
  workers[0].reply();
  assert.equal(await latest, 'svg');
  const pending = client.request({ latex: 'z' });
  client.terminate();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('a worker that never starts cannot leave exports waiting forever', async t => {
  const { client, workers } = fixture(t, { readyTimeout: 5 });
  await assert.rejects(client.request({ latex: 'x' }), /did not start/);
  assert.equal(workers.length, 2);
  assert.ok(workers.every(worker => worker.stopped));
});

test('a hung render is retried once, then rejects all affected requests', async t => {
  const { client, workers } = fixture(t, { requestTimeout: 5 });
  const one = client.request({ latex: 'x' });
  const two = client.request({ latex: 'y' });
  const checks = Promise.all([assert.rejects(one, /timed out/), assert.rejects(two, /timed out/)]);
  workers[0].ready();
  await new Promise(resolve => setTimeout(resolve, 10));
  workers[1].ready();
  await checks;
  assert.equal(workers.length, 2);
});

test('constructor and postMessage exceptions reject rather than leak requests', async t => {
  let attempts = 0;
  const { client } = fixture(t, { createWorker() { attempts++; throw Error('blocked'); } });
  await assert.rejects(client.request({ latex: 'x' }), /blocked/);
  assert.equal(attempts, 2);
  const f = fixture(t);
  const pending = f.client.request({ latex: 'x' });
  f.workers[0].postMessage = () => { throw Error('send failed'); };
  f.workers[0].ready();
  f.workers[1].postMessage = () => { throw Error('send failed'); };
  f.workers[1].ready();
  await assert.rejects(pending, /send failed/);
});
