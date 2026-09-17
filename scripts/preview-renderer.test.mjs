import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewRenderer } from '../src/lib/utils/preview-renderer.js';

function fixture() {
  const requests = [];
  const commits = [];
  const states = [];
  const renderer = createPreviewRenderer({
    delay: 60_000,
    render: (input) => new Promise((resolve, reject) => requests.push({ input, resolve, reject })),
    commit: (result) => commits.push(result),
    onState: (state) => states.push(state),
  });
  return { renderer, requests, commits, states };
}

test('export flushes the debounce and concurrent exports share one render', async () => {
  const { renderer, requests, commits } = fixture();
  renderer.schedule({ latex: 'latest' });
  const first = renderer.flush();
  const second = renderer.flush();
  await Promise.resolve();
  assert.equal(requests.length, 1);
  requests[0].resolve({ svg: 'latest svg' });
  assert.equal((await first).latex, 'latest');
  assert.deepEqual(await second, await first);
  assert.deepEqual(commits, [{ svg: 'latest svg' }]);
  renderer.dispose();
});

for (const fails of [false, true]) {
  test(`export follows a newer edit while an obsolete render ${fails ? 'fails' : 'finishes'}`, async () => {
    const { renderer, requests, commits, states } = fixture();
    renderer.schedule({ latex: 'old' });
    const exporting = renderer.flush();
    await Promise.resolve();
    renderer.schedule({ latex: 'new' });
    const latest = renderer.flush();
    await Promise.resolve();
    requests[1].resolve({ svg: 'new svg' });
    await latest;
    if (fails) requests[0].reject(new Error('Obsolete error'));
    else requests[0].resolve({ svg: 'old svg' });
    assert.equal((await exporting).latex, 'new');
    assert.deepEqual(commits, [{ svg: 'new svg' }]);
    assert.equal(states.at(-1).status, 'ready');
    renderer.dispose();
  });
}

test('invalid input rejects exports and the next edit recovers', async () => {
  const { renderer, requests, states } = fixture();
  renderer.schedule({ latex: 'invalid' });
  const invalid = renderer.flush();
  await Promise.resolve();
  requests[0].reject(new Error('Missing close brace'));
  await assert.rejects(invalid, /Missing close brace/);
  await assert.rejects(renderer.flush(), /Missing close brace/);
  assert.equal(states.at(-1).status, 'error');
  renderer.schedule({ latex: 'fixed' });
  const valid = renderer.flush();
  await Promise.resolve();
  requests[1].resolve({ svg: 'fixed' });
  assert.equal((await valid).latex, 'fixed');
  renderer.dispose();
});

test('unmount prevents a late response from committing', async () => {
  const { renderer, requests, commits } = fixture();
  renderer.schedule({ latex: 'x' });
  const exporting = renderer.flush();
  await Promise.resolve();
  renderer.dispose();
  requests[0].resolve({ svg: 'x' });
  await assert.rejects(exporting, /unavailable/);
  assert.deepEqual(commits, []);
});
