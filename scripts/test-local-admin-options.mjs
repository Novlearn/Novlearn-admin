import test from 'node:test';
import assert from 'node:assert/strict';
import { localAdminOptions } from './local-admin-options.mjs';
test('all features remain disabled without explicit local options', () =>
  assert.deepEqual(localAdminOptions(['.local/local-admin-123']), {
    workspace: '.local/local-admin-123',
    stop: false,
    engine: false,
    review: false,
    statistics: false,
    users: false,
    userDetail: false,
  }));
test('explicit local review keeps its Engine dependency', () =>
  assert.deepEqual(
    localAdminOptions(['.local/local-admin-123', '--engine', '--review']),
    {
      workspace: '.local/local-admin-123',
      stop: false,
      engine: true,
      review: true,
      statistics: false,
      users: false,
      userDetail: false,
    },
  ));
test('stopping a local process enables no feature', () =>
  assert.deepEqual(localAdminOptions(['.local/local-admin-123', '--stop']), {
    workspace: '.local/local-admin-123',
    stop: true,
    engine: false,
    review: false,
    statistics: false,
    users: false,
    userDetail: false,
  }));
test('statistics require their own explicit local switch', () => {
  const options = localAdminOptions(['.local/local-admin-123', '--statistics']);
  assert.equal(options.statistics, true);
  assert.equal(options.engine, false);
  assert.equal(options.review, false);
});
for (const flags of [
  [],
  ['--engine'],
  ['.local/local-admin-123', '--review'],
  ['.local/local-admin-123', '--engine', '--engine'],
  ['.local/local-admin-123', '--production'],
  ['.local/local-admin-123', '--stop', '--engine'],
  ['.local/local-admin-123', '--stop', '--engine', '--review'],
  ['.local/local-admin-123', '--stop', '--statistics'],
  ['.local/local-admin-123', '--statistics', '--statistics'],
  ['.local/local-admin-123', '--users', '--users'],
  ['.local/local-admin-123', '--stop', '--users'],
  ['.local/local-admin-123', '--user-detail'],
  ['.local/local-admin-123', '--user-detail', '--user-detail'],
  ['.local/local-admin-123', '--stop', '--users', '--user-detail'],
])
  test('refuse invalid options: ' + JSON.stringify(flags), () =>
    assert.throws(() => localAdminOptions(flags)),
  );

test('users require an independent explicit switch', () => {
  const options = localAdminOptions(['.local/local-admin-123', '--users']);
  assert.equal(options.users, true);
  assert.equal(options.statistics, false);
  assert.equal(options.engine, false);
  assert.equal(
    localAdminOptions(['.local/local-admin-123', '--statistics']).users,
    false,
  );
});

test('detail requires its own reviewed local switch and the list', () => {
  const options = localAdminOptions([
    '.local/local-admin-123',
    '--users',
    '--user-detail',
  ]);
  assert.equal(options.userDetail, true);
  assert.equal(options.users, true);
  assert.equal(options.engine, false);
  assert.equal(
    localAdminOptions(['.local/local-admin-123', '--users']).userDetail,
    false,
  );
  assert.equal(
    localAdminOptions(['.local/local-admin-123', '--statistics']).userDetail,
    false,
  );
});
