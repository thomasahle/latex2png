import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCustomForeground } from '../src/lib/utils/export-formats.js';

test('custom ink accounts for brightness and color rather than the current theme', () => {
  for (const color of ['#000000', '#0000ff', '#2060c0']) {
    assert.equal(resolveCustomForeground({ background: 'custom', customColor: color }), '#ffffff', color);
  }
  for (const color of ['#ffffff', '#ff0000', '#00ff00', '#808080']) {
    assert.equal(resolveCustomForeground({ background: 'custom', customColor: color }), '#000000', color);
  }
  for (const background of ['transparent', 'solid']) {
    assert.equal(resolveCustomForeground({ background, customColor: '#000000' }), undefined);
  }
});
