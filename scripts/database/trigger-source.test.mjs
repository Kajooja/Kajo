import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApplicationTriggerSource, triggerNames, compareTriggerSnapshots } from './trigger-source.mjs';

test('application trigger supplement is reconstructed from migration source', async () => {
  const result = await loadApplicationTriggerSource();
  assert.match(result.migrationSourceSha256, /^[a-f0-9]{64}$/);
  assert.match(result.triggerSqlSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.triggerCount >= 20);
  assert.match(result.sql, /profiles_create_system_saved_list/);
  assert.match(result.sql, /provision_kajo_personal_profile/);
});

test('quoted CREATE OR REPLACE names are recognized without an external attachment', () => {
  assert.deepEqual(triggerNames('CREATE OR REPLACE TRIGGER "fixture" BEFORE INSERT ON public.t;'), ['fixture']);
});

test('same-name changed definition, disabled or missing trigger is rejected', () => {
  const expected = [{identity:'public.t:fixture',definition:'BEFORE INSERT',enabled:'O'}];
  compareTriggerSnapshots(expected, expected);
  for (const changes of [{definition:'AFTER INSERT'}, {enabled:'D'}, {identity:'public.other:fixture'}]) {
    assert.throws(() => compareTriggerSnapshots(expected, [{...expected[0],...changes}]));
  }
  assert.throws(() => compareTriggerSnapshots(expected, []), /Empty/);
});
