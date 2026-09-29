'use strict';
// 날짜 계산이 음수 시간대(UTC보다 늦은 곳)에서도 요일·날짜를 밀리지 않는지 core.test.js 를 다른 TZ로 다시 돌린다
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('core tests pass in America/Los_Angeles', () => {
  const r = spawnSync(process.execPath, ['--test', path.join(__dirname, 'core.test.js')], { env: { ...process.env, TT_TEST_TZ: 'America/Los_Angeles' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
